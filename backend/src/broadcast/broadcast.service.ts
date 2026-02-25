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

  /** Recommended max daily sends per number to reduce block risk (WhatsApp best practices). */
  getMaxDailySendsRecommendation(): { uazapi: number; official: number; message: string } {
    const uazapi = Math.max(50, parseInt(this.configService.get('BROADCAST_MAX_DAILY_UAZAPI') || '250', 10));
    const official = 1000;
    return {
      uazapi,
      official,
      message: `Recomendação: até ${uazapi} disparos/dia (Uazapi) e até ${official} (API Oficial). Respeite intervalos entre mensagens para evitar bloqueio.`,
    };
  }

  /** Returns how many broadcasts were sent today for a channel (Uazapi). Used to show remaining quota. */
  async getDailySentCount(channelId: string, organizationId: string): Promise<{ sentToday: number; maxDaily: number }> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId },
    });
    if (!channel || (channel as { provider?: string }).provider !== 'uazapi') {
      return { sentToday: 0, maxDaily: 250 };
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const row = await this.prisma.broadcastDailySent.findUnique({
      where: { channelId_date: { channelId, date: todayStr } },
    });
    const maxDaily = Math.max(50, parseInt(this.configService.get('BROADCAST_MAX_DAILY_UAZAPI') || '250', 10));
    return { sentToday: row?.count ?? 0, maxDaily };
  }

  async getCampaigns(organizationId: string) {
    return this.prisma.broadcastCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
          skipSendToChannel: true,
        },
        organizationId,
      );
    } catch (err) {
      // Log but do not fail the broadcast count; message was already sent via provider
      console.error(`Broadcast: failed to record conversation/message for ${phoneNormalized}`, err);
    }
  }

  async send(dto: SendBroadcastDto, organizationId: string): Promise<{ sent: number; failed: number; errors: string[]; campaignId?: string }> {
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
    const useText = !!dto.message?.trim() || provider !== 'whatsapp-official' || dto.mediaUrl?.trim();
    if (!useTemplate && !useText) {
      throw new BadRequestException('Para API Oficial use um template aprovado (templateName). Para Uazapi informe a mensagem (message) ou mídia (mediaUrl).');
    }
    if (provider === 'uazapi' && dto.messageType === 'button' && (!dto.buttonChoices?.length || dto.buttonChoices.every((c) => !c?.trim()))) {
      throw new BadRequestException('Para mensagem com botões informe ao menos uma opção em buttonChoices.');
    }
    if (provider === 'uazapi' && dto.messageType === 'list') {
      if (!dto.listButton?.trim()) throw new BadRequestException('Para mensagem tipo lista informe listButton.');
      if (!dto.buttonChoices?.length || dto.buttonChoices.every((c) => !c?.trim())) {
        throw new BadRequestException('Para lista informe as opções em buttonChoices (use [Seção] para títulos).');
      }
    }
    if (provider === 'uazapi' && dto.mediaUrl?.trim() && !dto.mediaType) {
      throw new BadRequestException('Ao informar mediaUrl defina mediaType (image, video, audio ou document).');
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const maxDailyUazapi = Math.max(50, parseInt(this.configService.get('BROADCAST_MAX_DAILY_UAZAPI') || '250', 10));
    if (provider === 'uazapi') {
      const daily = await this.prisma.broadcastDailySent.findUnique({
        where: { channelId_date: { channelId: dto.channelId, date: todayStr } },
      });
      const alreadySent = daily?.count ?? 0;
      if (phones.length > 0 && alreadySent >= maxDailyUazapi) {
        throw new BadRequestException(
          `Limite diário de disparos (${maxDailyUazapi}) já atingido para este canal hoje. Amanhã o contador é zerado. Evite banimento.`,
        );
      }
      const wouldExceed = alreadySent + phones.length;
      if (wouldExceed > maxDailyUazapi) {
        throw new BadRequestException(
          `Este envio (${phones.length} números) excederia o limite diário. Já enviados hoje: ${alreadySent}. Máximo: ${maxDailyUazapi}. Reduza a lista ou aguarde até amanhã.`,
        );
      }
    }

    const accessToken = config?.accessToken || channel.accessToken || this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = config?.phoneNumberId || this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = config?.token || this.configService.get<string>('UAZAPI_INSTANCE_TOKEN');
    const serverUrl = config?.serverUrl;

    const uazapiVariations = [dto.message, ...(dto.messageVariations || [])].filter((m): m is string => !!m?.trim());

    let campaignId: string | null = null;
    if (dto.campaignName?.trim()) {
      const campaign = await this.prisma.broadcastCampaign.create({
        data: {
          name: dto.campaignName.trim(),
          channelId: dto.channelId,
          organizationId,
          sentCount: 0,
        },
      });
      campaignId = campaign.id;
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const normalizePhone = (p: string) => {
      let n = p.replace(/\D/g, '');
      if (n.length === 10 || n.length === 11) n = '55' + n;
      return n;
    };

    const pickRandomMessage = (): string => {
      if (provider !== 'uazapi' || uazapiVariations.length === 0) return dto.message || '';
      return uazapiVariations[Math.floor(Math.random() * uazapiVariations.length)]!;
    };

    // Delays following WhatsApp best practices: 30–60s (Meta), 15–45s (Uazapi) with jitter to avoid pattern detection
    const delayMetaMinMs = Math.max(25000, parseInt(this.configService.get('BROADCAST_DELAY_META_MIN_MS') || '30000', 10));
    const delayMetaMaxMs = Math.max(delayMetaMinMs, parseInt(this.configService.get('BROADCAST_DELAY_META_MAX_MS') || '60000', 10));
    const delayUazapiMinMs = Math.max(15000, parseInt(this.configService.get('BROADCAST_DELAY_UAZAPI_MIN_MS') || '15000', 10));
    const delayUazapiMaxMs = Math.max(delayUazapiMinMs, parseInt(this.configService.get('BROADCAST_DELAY_UAZAPI_MAX_MS') || '45000', 10));
    const jitterMs = 5000;

    for (let i = 0; i < phones.length; i++) {
      const raw = phones[i];
      const to = normalizePhone(raw);

      // Wait before each send (except the first) – WhatsApp best practices: random 15–45s (Uazapi) or 30–60s (Meta)
      if (i > 0) {
        const minMs = provider === 'uazapi' ? delayUazapiMinMs : delayMetaMinMs;
        const maxMs = provider === 'uazapi' ? delayUazapiMaxMs : delayMetaMaxMs;
        const delay = minMs + Math.floor(Math.random() * (maxMs - minMs + 1)) + Math.floor(Math.random() * (jitterMs + 1));
        await sleep(delay);
      }

      try {
        if (provider === 'uazapi') {
          if (!token) {
            errors.push(`${to}: canal sem token Uazapi`);
            failed++;
            continue;
          }
          const textToSend = pickRandomMessage();
          let ok = false;

          if (dto.mediaUrl?.trim() && dto.mediaType) {
            ok = await this.uazapiService.sendMediaMessage(
              to,
              dto.mediaUrl.trim(),
              dto.mediaType,
              textToSend || '',
              token,
              serverUrl,
              'whatsapp',
              undefined,
            );
          } else if (dto.messageType === 'button' && dto.buttonChoices?.length) {
            ok = await this.uazapiService.sendMenu(
              to,
              {
                type: 'button',
                text: dto.message?.trim() || 'Escolha uma opção:',
                choices: dto.buttonChoices.filter(Boolean).slice(0, 5),
                footerText: dto.footerText?.trim(),
                imageButton: dto.imageButtonUrl?.trim(),
                delay: 1000 + Math.floor(Math.random() * 1000),
              },
              token,
              serverUrl,
              'whatsapp',
            );
          } else if (dto.messageType === 'list' && dto.buttonChoices?.length && dto.listButton?.trim()) {
            ok = await this.uazapiService.sendMenu(
              to,
              {
                type: 'list',
                text: dto.message?.trim() || 'Selecione uma opção:',
                choices: dto.buttonChoices.filter(Boolean),
                listButton: dto.listButton.trim(),
                footerText: dto.footerText?.trim(),
                delay: 1000 + Math.floor(Math.random() * 1000),
              },
              token,
              serverUrl,
              'whatsapp',
            );
          } else {
            ok = await this.uazapiService.sendMessage(
              to,
              textToSend,
              token,
              serverUrl,
              'whatsapp',
            );
          }

          if (ok) {
            sent++;
            const contentToRecord =
              dto.mediaUrl && dto.mediaType
                ? `[Mídia: ${dto.mediaType}] ${textToSend || '(sem legenda)'}`
                : dto.messageType === 'button'
                  ? `${dto.message?.trim() || ''} [Botões]`
                  : dto.messageType === 'list'
                    ? `${dto.message?.trim() || ''} [Lista]`
                    : textToSend;
            await this.ensureConversationAndRecordMessage(organizationId, dto.channelId, to, contentToRecord);
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

    if (campaignId && sent > 0) {
      await this.prisma.broadcastCampaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: sent } },
      });
    }

    if (provider === 'uazapi' && sent > 0) {
      await this.prisma.broadcastDailySent.upsert({
        where: { channelId_date: { channelId: dto.channelId, date: todayStr } },
        create: { channelId: dto.channelId, date: todayStr, count: sent },
        update: { count: { increment: sent } },
      });
    }

    return { sent, failed, errors, campaignId: campaignId ?? undefined };
  }
}
