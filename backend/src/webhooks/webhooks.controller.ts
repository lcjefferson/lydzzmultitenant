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
import * as fs from 'fs';
import * as path from 'path';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from '../integrations/whatsapp.service';
import { UazapiService } from '../integrations/uazapi.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly whatsAppService: WhatsAppService,
    private readonly uazapiService: UazapiService,
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
    const uazapiUrl = await this.webhooksService.getUazapiWebhookUrl();
    return { webhookUrl: url, uazapiWebhookUrl: uazapiUrl };
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
            status: 'Lead Novo',
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

      let attachments: Record<string, unknown> | undefined;
      if (mappedType !== 'text' && incomingMessage.mediaId) {
        const cfg =
          typeof channel.config === 'object' && channel.config
            ? (channel.config as {
                phoneNumberId?: string;
                accessToken?: string;
              })
            : undefined;
        const accessToken =
          cfg?.accessToken || channel.accessToken || undefined;
        if (accessToken) {
          const media = await this.whatsAppService.getMediaInfo(
            incomingMessage.mediaId,
            accessToken,
          );
          const port = process.env.PORT || 3001;
          const base =
            process.env.APP_URL?.replace(/\/$/, '') ||
            `http://localhost:${port}`;
          const proxiedUrl = `${base}/api/media/whatsapp/${incomingMessage.mediaId}${incomingMessage.phoneNumberId ? `?phoneNumberId=${encodeURIComponent(incomingMessage.phoneNumberId)}` : ''}`;
          attachments = {
            url: proxiedUrl,
            mimeType: media?.mime_type,
            mediaId: incomingMessage.mediaId,
            source: 'whatsapp',
          };
        }
      }

      await this.messagesService.create({
        conversationId: conversation.id,
        content: incomingMessage.message,
        senderType: 'contact',
        type: mappedType,
        attachments,
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

  // Uazapi Webhook (POST) - Receive messages
  @Post('uazapi')
  @HttpCode(200)
  async handleUazapiWebhook(@Body() payload: any) {
    this.logger.log(`Received Uazapi webhook: ${JSON.stringify(payload)}`); // Log full body to find instance name
    try {
      this.logger.log('Incoming Uazapi webhook');
      this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
      
      const incomingMessage = this.uazapiService.parseIncomingMessage(payload);
      if (!incomingMessage) {
        this.logger.warn('Incoming Uazapi webhook ignored: no message found in parseIncomingMessage');
        return { status: 'ignored' };
      }
      this.logger.log(`Parsed message: ${JSON.stringify(incomingMessage, null, 2)}`);

      const channels = await this.prisma.channel.findMany({
        where: { type: 'whatsapp' },
        include: { organization: true },
      });
      this.logger.log(`Found ${channels.length} whatsapp channels`);

      let channel =
        channels.find((ch) => {
          const cfg =
            typeof ch.config === 'object' && ch.config
              ? (ch.config as { instanceId?: string; token?: string; provider?: string })
              : undefined;
          return cfg?.provider === 'uazapi' || (!!cfg?.instanceId && !!cfg?.token);
        }) || null;

      if (incomingMessage.instanceId) {
        const matched = channels.find((ch) => {
          const cfg =
            typeof ch.config === 'object' && ch.config
              ? (ch.config as { instanceId?: string })
              : undefined;
          return cfg?.instanceId === incomingMessage.instanceId;
        });
        channel = matched || channel;
      }

      if (!channel) {
        this.logger.error('No Uazapi channel found for incoming message');
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
            status: 'Lead Novo',
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

      const msgTypeRaw = incomingMessage.type || 'text';
      const mappedType: 'text' | 'image' | 'file' | 'audio' =
        msgTypeRaw === 'image'
          ? 'image'
          : msgTypeRaw === 'audio'
            ? 'audio'
            : msgTypeRaw === 'video' || msgTypeRaw === 'document'
              ? 'file'
              : 'text';

      let attachments: Record<string, unknown> | undefined;

      // Handle media from Uazapi
      if (incomingMessage.media) {
         try {
             if (incomingMessage.media.base64) {
                 // Save base64 to file
                 const matches = incomingMessage.media.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                 let buffer: Buffer;
                 if (matches && matches.length === 3) {
                     buffer = Buffer.from(matches[2], 'base64');
                 } else {
                     buffer = Buffer.from(incomingMessage.media.base64, 'base64');
                 }
                 
                 const ext = incomingMessage.media.mimetype ? incomingMessage.media.mimetype.split('/')[1].replace('; codecs=opus', '') : 'bin';
                 const filename = `${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;
                 const uploadDir = path.join(process.cwd(), 'uploads');
                 if (!fs.existsSync(uploadDir)) {
                     fs.mkdirSync(uploadDir, { recursive: true });
                 }
                 const filepath = path.join(uploadDir, filename);
                 
                 fs.writeFileSync(filepath, buffer);
                 this.logger.log(`Saved media from Uazapi to ${filepath}`);
                 
                 const port = process.env.PORT || 3001;
                 const appUrl = process.env.APP_URL || `http://localhost:${port}`;
                 const url = `/uploads/${filename}`;
                 
                 attachments = {
                     url: url,
                     path: `/uploads/${filename}`,
                     mimetype: incomingMessage.media.mimetype,
                     filename: incomingMessage.media.fileName || filename,
                     source: 'uazapi'
                 };
             } else if (incomingMessage.media.url) {
                 // Use URL directly if no base64
                 attachments = {
                     url: incomingMessage.media.url,
                     mimetype: incomingMessage.media.mimetype,
                     filename: incomingMessage.media.fileName,
                     source: 'uazapi'
                 };
             }
         } catch (error) {
             this.logger.error('Error processing Uazapi media', error);
         }
      }

      await this.messagesService.create({
        conversationId: conversation.id,
        content: incomingMessage.message,
        senderType: 'contact',
        type: mappedType,
        attachments,
      });
      this.logger.log(
        `Inbound Uazapi message persisted: conversation=${conversation.id} type=${mappedType}`,
      );

      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error handling Uazapi webhook', error as Error);
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
