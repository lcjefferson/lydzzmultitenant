import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from '../integrations/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly whatsAppService: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}
  private readonly logger = new Logger(WebhooksController.name);

  // WhatsApp Webhook Verification (GET)
  @Get('whatsapp')
  async verifyWhatsAppWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const defaultToken =
      process.env.WHATSAPP_VERIFY_TOKEN || 'smarterchat_verify_token';
    let verifyToken = defaultToken;
    const channel = await this.prisma.channel.findFirst({
      where: { type: 'whatsapp' },
    });
    const cfg = channel?.config as unknown;
    let configured: string | undefined;
    if (
      typeof cfg === 'object' &&
      cfg !== null &&
      'verifyToken' in (cfg as Record<string, unknown>) &&
      typeof (cfg as { verifyToken?: unknown }).verifyToken === 'string'
    ) {
      configured = (cfg as { verifyToken: string }).verifyToken;
    }
    verifyToken = configured || defaultToken;
    const result = this.whatsAppService.verifyWebhook(
      mode,
      token,
      challenge,
      verifyToken,
    );

    if (result) {
      return result;
    }
    return { error: 'Verification failed' };
  }

  @Get('url')
  async getWebhookUrl() {
    const url = await this.webhooksService.getWhatsAppWebhookUrl();
    return { webhookUrl: url };
  }

  @Get('health')
  async getWebhookHealth() {
    const publicWebhookUrl = await this.webhooksService.getWhatsAppWebhookUrl();

    const defaultToken =
      process.env.WHATSAPP_VERIFY_TOKEN || 'smarterchat_verify_token';
    let verifyToken = defaultToken;
    const channel = await this.prisma.channel.findFirst({
      where: { type: 'whatsapp' },
    });
    const cfg = channel?.config as unknown;
    let configured: string | undefined;
    if (
      typeof cfg === 'object' &&
      cfg !== null &&
      'verifyToken' in (cfg as Record<string, unknown>) &&
      typeof (cfg as { verifyToken?: unknown }).verifyToken === 'string'
    ) {
      configured = (cfg as { verifyToken: string }).verifyToken;
    }
    verifyToken = configured || defaultToken;

    const whatsappChannels = await this.prisma.channel.findMany({
      where: { type: 'whatsapp' },
      select: { id: true },
    });
    const channelIds = whatsappChannels.map((c) => c.id);
    const conversations = await this.prisma.conversation.findMany({
      where: { channelId: { in: channelIds } },
      select: { id: true },
    });
    const convIds = conversations.map((c) => c.id);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const inbound24hCount = await this.prisma.message.count({
      where: {
        senderType: 'contact',
        conversationId: { in: convIds },
        createdAt: { gte: since },
      },
    });

    const lastInbound = await this.prisma.message.findFirst({
      where: {
        senderType: 'contact',
        conversationId: { in: convIds },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      publicWebhookUrl,
      verifyToken,
      whatsappChannelCount: channelIds.length,
      inbound24hCount,
      lastInboundMessageAt: lastInbound?.createdAt ?? null,
    };
  }

  // WhatsApp Webhook (POST) - Receive messages
  @Post('whatsapp')
  @HttpCode(200)
  async handleWhatsAppWebhook(
    @Body()
    payload: {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from?: string;
              text?: { body?: string };
              id?: string;
              timestamp?: string;
            }>;
          };
        }>;
      }>;
    },
  ) {
    try {
      this.logger.log('Incoming WhatsApp webhook');
      const incomingMessage =
        this.whatsAppService.parseIncomingMessage(payload);

      if (!incomingMessage) {
        this.logger.warn('Incoming WhatsApp webhook ignored: no message');
        return { status: 'ignored' };
      }

      const activeChannels = await this.prisma.channel.findMany({
        where: { type: 'whatsapp' },
        include: { organization: true },
      });

      let channel = activeChannels[0] || null;
      if (incomingMessage.phoneNumberId) {
        const matched = activeChannels.find((ch) => {
          const cfg =
            typeof ch.config === 'object' && ch.config
              ? (ch.config as { phoneNumberId?: string })
              : undefined;
          return cfg?.phoneNumberId === incomingMessage.phoneNumberId;
        });
        channel = matched || channel;
      }

      if (!channel) {
        this.logger.error('No WhatsApp channel found for incoming message');
        return { status: 'no_channel' };
      }

      const existingLead = await this.prisma.lead.findFirst({
        where: {
          organizationId: channel.organization.id,
          phone: incomingMessage.from,
        },
        include: { conversation: true },
      });

      const lead =
        existingLead ||
        (await this.prisma.lead.create({
          data: {
            name: incomingMessage.contactName || incomingMessage.from,
            phone: incomingMessage.from,
            status: 'new',
            temperature: 'cold',
            source: 'whatsapp',
            organizationId: channel.organization.id,
          },
        }));

      if (
        existingLead &&
        incomingMessage.contactName &&
        (!existingLead.name || existingLead.name === existingLead.phone)
      ) {
        await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: { name: incomingMessage.contactName },
        });
      }

      let conversation = await this.prisma.conversation.findFirst({
        where: {
          contactIdentifier: incomingMessage.from,
          channelId: channel.id,
        },
      });

      if (!conversation && (existingLead?.conversation || lead)) {
        const convByLead = await this.prisma.conversation.findFirst({
          where: { leadId: existingLead?.id ?? lead.id },
        });
        conversation = convByLead || conversation;
      }

      if (!conversation) {
        const defaultAgent = await this.prisma.agent.findFirst({
          where: { organizationId: channel.organization.id, isActive: true },
          orderBy: { updatedAt: 'desc' },
        });

        conversation = await this.prisma.conversation.create({
          data: {
            contactName: incomingMessage.contactName || incomingMessage.from,
            contactIdentifier: incomingMessage.from,
            channelId: channel.id,
            status: 'waiting',
            organizationId: channel.organization.id,
            leadId: lead.id,
            agentId: defaultAgent?.id,
          },
        });
      } else if (!conversation.leadId) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
      }

      if (
        conversation &&
        incomingMessage.contactName &&
        (!conversation.contactName ||
          conversation.contactName === conversation.contactIdentifier)
      ) {
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { contactName: incomingMessage.contactName },
        });
      }

      const msgTypeRaw = incomingMessage.type || 'text';
      const mappedType: 'text' | 'image' | 'file' | 'audio' =
        msgTypeRaw === 'image'
          ? 'image'
          : msgTypeRaw === 'audio'
            ? 'audio'
            : msgTypeRaw === 'video' || msgTypeRaw === 'document'
              ? 'file'
              : 'text';

      await this.messagesService.create({
        conversationId: conversation.id,
        content: incomingMessage.message,
        senderType: 'contact',
        type: mappedType,
      });
      this.logger.log(
        `Inbound message persisted: conversation=${conversation.id} type=${mappedType}`,
      );

      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error handling WhatsApp webhook', error as Error);
      return { status: 'error' };
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createWebhookDto: CreateWebhookDto) {
    return this.webhooksService.create(createWebhookDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.webhooksService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.webhooksService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateWebhookDto: UpdateWebhookDto) {
    return this.webhooksService.update(id, updateWebhookDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testWebhook(
    @Body() body: { event: string; payload: Prisma.InputJsonValue },
  ) {
    await this.webhooksService.triggerWebhook(body.event, body.payload);
    return { message: 'Webhook triggered' };
  }
}
