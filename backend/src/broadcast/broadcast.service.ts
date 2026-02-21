import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../integrations/whatsapp.service';
import { UazapiService } from '../integrations/uazapi.service';
import { ConfigService } from '@nestjs/config';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { SendBroadcastDto } from './dto/send-broadcast.dto';

/** Delay between sends to avoid Meta rate limits and block risk. No delay before first send. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jitter: add 0..maxMs to base delay so intervals aren't identical (reduces pattern detection). */
function jitter(baseMs: number, maxJitterMs: number): number {
  return baseMs + Math.floor(Math.random() * (maxJitterMs + 1));
}

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly uazapiService: UazapiService,
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async getChannelsForBroadcast(organizationId: string) {
    return this.prisma.channel.findMany({
      where: {
        organizationId,
        type: 'whatsapp',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        config: true,
        identifier: true,
      },
    });
  }

  async getTemplatesForChannel(channelId: string, organizationId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    const config = typeof channel.config === 'object' && channel.config !== null
      ? (channel.config as { wabaId?: string; accessToken?: string; phoneNumberId?: string })
      : null;
    const provider = (channel as { provider?: string }).provider;

    if (provider !== 'whatsapp-official') {
      return [];
    }

    const wabaId = config?.wabaId;
    const accessToken = config?.accessToken || channel.accessToken || this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!wabaId || !accessToken) {
      return [];
    }

    return this.whatsAppService.listMessageTemplates(wabaId, accessToken);
  }

  async getLeadStatuses(organizationId: string): Promise<string[]> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId },
      select: { status: true },
      distinct: ['status'],
    });
    return leads.map((l) => l.status).filter(Boolean).sort();
  }

  async getLeadsByStatuses(organizationId: string, statuses: string[]) {
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        status: { in: statuses },
        phone: { not: null },
      },
      select: { id: true, name: true, phone: true, status: true },
    });
  }

  /**
   * Ensures a lead and conversation exist for the contact and records the outbound broadcast message
   * so it appears in the omnichannel.
   */
  private async ensureConversationAndRecordMessage(
    organizationId: string,
    channelId: string,
    phoneNormalized: string,
    messageContent: string,
  ): Promise<void> {
    try {
      const conversation = await this.conversationsService.create(
        {
          contactName: phoneNormalized,
          contactIdentifier: phoneNormalized,
          channelId,
        },
        organizationId,
      );
      await this.messagesService.create(
        {
          conversationId: conversation.id,
          content: messageContent,
          senderType: 'user',
          type: 'text',
        },
        organizationId,
      );
    } catch (err) {
      // Log but do not fail the broadcast count; message was already sent via provider
      console.error(`Broadcast: failed to record conversation/message for ${phoneNormalized}`, err);
    }
  }

  async send(dto: SendBroadcastDto, organizationId: string): Promise<{ sent: number; failed: number; errors: string[] }> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: dto.channelId, organizationId },
      include: { organization: true },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    let phones: string[] = [];
    if (dto.numbers?.length) {
      phones = dto.numbers
        .map((n) => n.replace(/\D/g, ''))
        .filter((n) => n.length >= 10);
      if (phones.length === 0) throw new BadRequestException('Nenhum número válido na lista');
    } else if (dto.leadStatuses?.length) {
      const leads = await this.getLeadsByStatuses(organizationId, dto.leadStatuses);
      phones = leads
        .map((l) => (l.phone || '').replace(/\D/g, ''))
        .filter((n) => n.length >= 10);
      if (phones.length === 0) throw new BadRequestException('Nenhum lead com telefone encontrado para os status selecionados');
    } else {
      throw new BadRequestException('Informe uma lista de números ou selecione status do pipeline (leads)');
    }

    const config = typeof channel.config === 'object' && channel.config !== null
      ? (channel.config as {
          phoneNumberId?: string;
          accessToken?: string;
          wabaId?: string;
          token?: string;
          instanceId?: string;
          serverUrl?: string;
          provider?: string;
        })
      : null;
    const provider = (channel as { provider?: string }).provider ?? (config?.phoneNumberId ? 'whatsapp-official' : 'uazapi');

    const useTemplate = !!dto.templateName && provider === 'whatsapp-official';
    const useText = !!dto.message?.trim() || provider !== 'whatsapp-official';
    if (!useTemplate && !useText) {
      throw new BadRequestException('Para API Oficial use um template aprovado (templateName). Para Uazapi informe a mensagem (message).');
    }

    const accessToken = config?.accessToken || channel.accessToken || this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = config?.phoneNumberId || this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = config?.token || this.configService.get<string>('UAZAPI_INSTANCE_TOKEN');
    const serverUrl = config?.serverUrl;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const normalizePhone = (p: string) => {
      let n = p.replace(/\D/g, '');
      if (n.length === 10 || n.length === 11) n = '55' + n;
      return n;
    };

    // Delays to avoid Meta block: configurable via env, conservative defaults
    const delayMetaMs = Math.max(1000, parseInt(this.configService.get('BROADCAST_DELAY_META_MS') || '2000', 10));
    const delayUazapiMs = Math.max(200, parseInt(this.configService.get('BROADCAST_DELAY_UAZAPI_MS') || '500', 10));
    const jitterMs = 500; // 0..500ms random extra

    for (let i = 0; i < phones.length; i++) {
      const raw = phones[i];
      const to = normalizePhone(raw);

      // Wait before each send (except the first) to stay under Meta limits and avoid block
      if (i > 0) {
        const delay = provider === 'uazapi'
          ? jitter(delayUazapiMs, jitterMs)
          : jitter(delayMetaMs, jitterMs);
        await sleep(delay);
      }

      try {
        if (provider === 'uazapi') {
          if (!token) {
            errors.push(`${to}: canal sem token Uazapi`);
            failed++;
            continue;
          }
          const ok = await this.uazapiService.sendMessage(
            to,
            dto.message || '',
            token,
            serverUrl,
            'whatsapp',
          );
          if (ok) {
            sent++;
            await this.ensureConversationAndRecordMessage(organizationId, dto.channelId, to, dto.message || '');
          } else {
            failed++;
            errors.push(`${to}: falha Uazapi`);
          }
        } else {
          if (!phoneNumberId || !accessToken) {
            errors.push(`${to}: canal sem Phone Number ID ou Access Token`);
            failed++;
            continue;
          }
          if (useTemplate) {
            // Send template message (Meta Cloud API)
            const axios = await import('axios');
            const apiUrl = this.configService.get<string>('WHATSAPP_API_URL')?.replace(/\/$/, '') || 'https://graph.facebook.com/v18.0';
            await axios.default.post(
              `${apiUrl}/${phoneNumberId.replace(/\D/g, '')}/messages`,
              {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: { name: dto.templateName, language: { code: 'pt_BR' } },
              },
              { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 },
            );
            sent++;
            await this.ensureConversationAndRecordMessage(
              organizationId,
              dto.channelId,
              to,
              `[Template: ${dto.templateName}]`,
            );
          } else {
            const result = await this.whatsAppService.sendMessage(to, dto.message || '', phoneNumberId, accessToken);
            if (result.success) {
              sent++;
              await this.ensureConversationAndRecordMessage(organizationId, dto.channelId, to, dto.message || '');
            } else {
              failed++;
              errors.push(`${to}: ${result.error}`);
            }
          }
        }
      } catch (err: unknown) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${to}: ${msg}`);
      }
    }

    return { sent, failed, errors };
  }
}
