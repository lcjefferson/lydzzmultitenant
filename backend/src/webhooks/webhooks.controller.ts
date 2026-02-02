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
  Headers as RequestHeaders,
  HttpCode,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import axios from 'axios';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsAppService } from '../integrations/whatsapp.service';
import { UazapiService } from '../integrations/uazapi.service';
import { FacebookService } from '../integrations/facebook.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly whatsAppService: WhatsAppService,
    private readonly uazapiService: UazapiService,
    private readonly facebookService: FacebookService,
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
    const cfg = (channel as any)?.config as unknown;
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
    const cfg = (channel as any)?.config as unknown;
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

  // Facebook Webhook Verification (GET)
  @Get('facebook')
  async verifyFacebookWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const defaultToken = process.env.FACEBOOK_VERIFY_TOKEN || 'facebook_leads_verify_token';
    let verifyToken = defaultToken;
    
    // Check if configured in any facebook_leads channel
    const channel = await this.prisma.channel.findFirst({
      where: { type: 'facebook_leads' },
    });
    const cfg = (channel as any)?.config as unknown;
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

    const result = this.facebookService.verifyWebhook(
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

  // Facebook Webhook (POST) - Receive leads
  @Post('facebook')
  @HttpCode(200)
  async handleFacebookWebhook(@Body() payload: any) {
    return this.facebookService.handleWebhookPayload(payload);
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
            typeof (ch as any).config === 'object' && (ch as any).config
              ? ((ch as any).config as { phoneNumberId?: string })
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
        include: { conversation: true } as any,
      });

      const lead =
        existingLead ||
        (await this.prisma.lead.create({
          data: {
            name: incomingMessage.contactName || incomingMessage.from,
            phone: incomingMessage.from,
            status: 'Lead Novo',
            temperature: 'cold' as any,
            source: channel.type,
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
        } as any,
      });

      if (!conversation && ((existingLead as any)?.conversation || lead)) {
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
          } as any,
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
          data: { contactName: incomingMessage.contactName } as any,
        });
      }

      const msgTypeRaw = incomingMessage.type || 'text';
      const mappedType: 'text' | 'image' | 'file' | 'audio' | 'video' =
        msgTypeRaw === 'image'
          ? 'image'
          : msgTypeRaw === 'audio'
            ? 'audio'
          : msgTypeRaw === 'video'
            ? 'video'
            : msgTypeRaw === 'document'
              ? 'file'
              : 'text';

      let attachments: Record<string, unknown> | undefined;
      if (mappedType !== 'text' && incomingMessage.mediaId) {
        const cfg =
          typeof (channel as any).config === 'object' && (channel as any).config
            ? ((channel as any).config as {
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

  // Uazapi Health Check (GET) - Avoid 401 on browser check
  @Get('uazapi')
  uazapiHealth() {
    return { status: 'ok', message: 'Uazapi webhook endpoint is ready (POST to this URL to send events)' };
  }

  // Uazapi Webhook (POST) - Receive messages
  @Post('uazapi')
  @HttpCode(200)
  async handleUazapiWebhook(@Body() payload: any, @RequestHeaders() headers: any) {
    try {
      this.logger.log('Incoming Uazapi webhook');
      this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
      if (headers) {
          this.logger.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
      }
      
      const incomingMessage = this.uazapiService.parseIncomingMessage(payload);
      if (!incomingMessage) {
        this.logger.warn('Incoming Uazapi webhook ignored: no message found in parseIncomingMessage');
        return { status: 'ignored' };
      }
      
      // Sanitize phone number (remove non-digits)
      if (incomingMessage.from) {
          incomingMessage.from = incomingMessage.from.replace(/\D/g, '');
      }
      
      if (incomingMessage.isGroup) {
          this.logger.log(`Ignoring group message from ${incomingMessage.from}`);
          return { status: 'ignored_group' };
      }

      if (incomingMessage.fromMe) {
          this.logger.log(`Ignoring message sent by me (echo) from ${incomingMessage.from}`);
          return { status: 'ignored_from_me' };
      }

      this.logger.log(`Parsed message: ${JSON.stringify(incomingMessage, null, 2)}`);

      const channels = await this.prisma.channel.findMany({
        where: { type: { in: ['whatsapp', 'instagram', 'facebook'] } },
        include: { organization: true },
      });
      this.logger.log(`Found ${channels.length} channels (whatsapp/instagram/facebook)`);
      
      // Debug log for channels
      channels.forEach(ch => {
          const cfg = (ch as any).config || {};
          this.logger.log(`Channel [${ch.id}]: Name=${ch.name}, Provider=${ch.provider}, InstanceId=${cfg.instanceId}`);
      });

      let channel: any = null;

      // 1. Try to match by instanceId (Most accurate for Uazapi)
      if (incomingMessage.instanceId) {
        channel = channels.find((ch) => {
          const cfg =
            typeof (ch as any).config === 'object' && (ch as any).config
              ? ((ch as any).config as { instanceId?: string })
              : undefined;
          return cfg?.instanceId === incomingMessage.instanceId;
        });
        
        if (channel) {
            this.logger.log(`Matched channel by InstanceId: ${channel.name} (${channel.id})`);
        } else {
            this.logger.warn(`No channel matched for InstanceId: ${incomingMessage.instanceId}`);
        }
      }

      // 1.5 Try to match by Token in headers (Fallback if instanceId missing/mismatch)
      if (!channel && headers) {
          // Check for 'token' or 'apikey' or 'authorization' in headers
          const headerToken = headers['token'] || headers['apikey'] || headers['authorization'];
          
          if (headerToken) {
               channel = channels.find((ch) => {
                  const cfg = typeof (ch as any).config === 'object' ? (ch as any).config as any : {};
                  return cfg.token === headerToken || (cfg.token && `Bearer ${cfg.token}` === headerToken);
              });
              
              if (channel) {
                  this.logger.log(`Matched channel by Header Token: ${channel.name} (${channel.id})`);
              }
          }
      }

      // 2. Fallback: Find first Uazapi provider if no instanceId matched
      if (!channel) {
          const uazapiChannels = channels.filter(ch => {
              // Use the provider column as the primary source of truth
              if (ch.provider === 'uazapi') return true;

              // Fallback to config for legacy or inconsistent data
              const cfg = typeof (ch as any).config === 'object' ? (ch as any).config as any : {};
              return cfg.provider === 'uazapi';
          });

          if (uazapiChannels.length === 1) {
              channel = uazapiChannels[0];
              this.logger.log(`Using fallback channel (single Uazapi instance found): ${channel.name} (${channel.id})`);
          } else if (uazapiChannels.length > 1) {
              this.logger.warn(`Multiple Uazapi channels found (${uazapiChannels.length}) and no instanceId matched. Cannot determine target channel safely.`);
              this.logger.warn(`Channels found: ${uazapiChannels.map(c => `${c.name} (${c.id})`).join(', ')}`);
          } else {
              this.logger.warn('No Uazapi channel found in fallback search.');
          }
      }
      
      if (!channel) {
        this.logger.error(`No channel found for Uazapi instance: ${incomingMessage.instanceId}`);
        this.logger.error(`Available channels: ${channels.map(c => `${c.name} (${(c as any).config?.instanceId})`).join(', ')}`);
        return { status: 'no_channel' };
      }

      const existingLead = await this.prisma.lead.findFirst({
        where: {
          organizationId: channel.organization.id,
          phone: incomingMessage.from,
        },
        include: { conversation: true } as any,
      });

      const lead =
        existingLead ||
        (await this.prisma.lead.create({
          data: {
            name: incomingMessage.contactName || incomingMessage.from,
            phone: incomingMessage.from,
            status: 'Lead Novo',
            temperature: 'cold' as any,
            source: channel.type,
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
        } as any,
      });

      if (!conversation && ((existingLead as any)?.conversation || lead)) {
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
          } as any,
        });
      } else if (!conversation.leadId) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
      }

      this.logger.log(`Processing Uazapi message from ${incomingMessage.from}, type: ${incomingMessage.type}`);

      const msgTypeRaw = (incomingMessage.type || 'text').toLowerCase();
      let mappedType: 'text' | 'image' | 'file' | 'audio' | 'video' =
        msgTypeRaw === 'image'
          ? 'image'
          : msgTypeRaw === 'audio'
            ? 'audio'
          : msgTypeRaw === 'video'
            ? 'video'
            : (msgTypeRaw === 'document' || msgTypeRaw === 'file')
              ? 'file'
              : 'text';

      let attachments: Record<string, unknown> | undefined;

      // Handle media from Uazapi
      if (incomingMessage.media) {
         try {
             let buffer: Buffer | undefined;
             let mimetype = incomingMessage.media.mimetype;
             let filename = incomingMessage.media.fileName;

             // If we have base64, use it
             if (incomingMessage.media.base64) {
                 const matches = incomingMessage.media.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                 if (matches && matches.length === 3) {
                     buffer = Buffer.from(matches[2], 'base64');
                 } else {
                     buffer = Buffer.from(incomingMessage.media.base64, 'base64');
                 }
             } 
             // If we have no base64 but have mediaKey/messageId, try to download
             else if (incomingMessage.messageId) {
                 const cfg = (channel?.config && typeof channel.config === 'object' ? channel.config : {}) as { token?: string; serverUrl?: string };
                 let token = cfg.token;
                 const serverUrl = cfg.serverUrl;
                 
                 // If token is missing in channel config, try env var
                 if (!token) {
                     token = process.env.UAZAPI_INSTANCE_TOKEN;
                     if (token) this.logger.log('Using UAZAPI_INSTANCE_TOKEN from env as fallback');
                 }

                 this.logger.log(`Processing media for message ${incomingMessage.messageId}. Token available: ${!!token}`);

                 if (token) {
                    this.logger.log(`Attempting to download media for message ${incomingMessage.messageId} using token ${token.substring(0, 5)}...`);
                    const downloaded = await this.uazapiService.downloadMedia(incomingMessage.messageId, token, serverUrl);
                    if (downloaded) {
                        buffer = downloaded.buffer;
                        mimetype = downloaded.mimetype;
                        filename = filename || downloaded.filename;
                        this.logger.log(`Media downloaded successfully: ${mimetype} (${buffer.length} bytes)`);
                    } else {
                        this.logger.warn(`Failed to download media for message ${incomingMessage.messageId} using token. Will attempt fallback to URL if available.`);
                    }
                 } else {
                     this.logger.warn(`No token found for media download (Channel config or ENV) for message ${incomingMessage.messageId}`);
                 }
             }

             // If buffer is still null, but we have a URL (e.g. from FileDownloaded event), try to download from URL
             if (!buffer && incomingMessage.media.url && incomingMessage.media.url.startsWith('http')) {
                 try {
                     this.logger.log(`Attempting to download media from URL: ${incomingMessage.media.url}`);
                     
                     // Create HTTPS agent to ignore self-signed certificates for fallback download
                     const httpsAgent = new https.Agent({ rejectUnauthorized: false });

                     const response = await axios.get(incomingMessage.media.url, { 
                         responseType: 'arraybuffer',
                         timeout: 30000,
                         headers: {
                             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                         },
                         httpsAgent: httpsAgent
                     });
                     const contentType = response.headers['content-type'];
                     if (contentType && (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain'))) {
                         this.logger.warn(`Downloaded content from URL is ${contentType}, likely an error page or expired link. Discarding.`);
                         if (response.data.length < 1000) {
                             this.logger.debug(`Content preview: ${response.data.toString()}`);
                         }
                     } else {
                         buffer = Buffer.from(response.data);
                         mimetype = contentType || mimetype;
                         this.logger.log(`Downloaded media from URL. Size: ${buffer.length}, Type: ${mimetype}`);
                     }
                 } catch (err) {
                     this.logger.error(`Failed to download media from URL: ${incomingMessage.media.url}. Error: ${(err as Error).message}`);
                     if (axios.isAxiosError(err) && err.response) {
                         this.logger.error(`Fallback download status: ${err.response.status}`);
                     }
                 }
             }

             if (buffer) {
                 // Fix for generic octet-stream mimetypes when we know the type
                 if (mimetype === 'application/octet-stream') {
                     if (mappedType === 'image') {
                         mimetype = 'image/jpeg';
                     } else if (mappedType === 'audio') {
                         mimetype = 'audio/ogg'; // WhatsApp audios are usually ogg
                     } else if (mappedType === 'video') {
                         mimetype = 'video/mp4';
                     } else if (filename) {
                         // Attempt to guess from extension
                         const ext = path.extname(filename).toLowerCase();
                         if (ext === '.pdf') mimetype = 'application/pdf';
                         else if (ext === '.doc') mimetype = 'application/msword';
                         else if (ext === '.docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                         else if (ext === '.xls') mimetype = 'application/vnd.ms-excel';
                         else if (ext === '.xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                         else if (ext === '.txt') mimetype = 'text/plain';
                     }
                 }

                 let ext = 'bin';
                 if (mimetype) {
                    if (mimetype === 'application/pdf') ext = 'pdf';
                    else if (mimetype === 'application/msword') ext = 'doc';
                    else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
                    else if (mimetype === 'application/vnd.ms-excel') ext = 'xls';
                    else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ext = 'xlsx';
                    else if (mimetype === 'text/plain') ext = 'txt';
                    else if (mimetype === 'image/jpeg') ext = 'jpg';
                    else if (mimetype === 'image/png') ext = 'png';
                    else if (mimetype === 'audio/ogg') ext = 'ogg';
                    else if (mimetype === 'audio/mpeg') ext = 'mp3';
                    else if (mimetype === 'video/mp4') ext = 'mp4';
                    else {
                        ext = mimetype.split('/')[1].replace('; codecs=opus', '');
                    }
                 }

                 let finalFilename = filename;
                 const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
                 
                 if (!finalFilename) {
                     finalFilename = `${uniquePrefix}.${ext}`;
                 } else {
                     // Ensure filename has extension
                     if (!path.extname(finalFilename)) {
                         finalFilename = `${finalFilename}.${ext}`;
                     }
                     // Prepend unique prefix to prevent overwrites and caching issues
                     finalFilename = `${uniquePrefix}-${finalFilename}`;
                 }

                 const uploadDir = path.join(process.cwd(), 'uploads');
                 if (!fs.existsSync(uploadDir)) {
                     fs.mkdirSync(uploadDir, { recursive: true });
                 }
                 const filepath = path.join(uploadDir, finalFilename);
                 
                 fs.writeFileSync(filepath, buffer);
                this.logger.log(`Saved media from Uazapi to ${filepath}`);
                
                const url = `/uploads/${encodeURIComponent(finalFilename)}`;
                
                attachments = {
                    url: url,
                    path: `/uploads/${finalFilename}`,
                    mimetype: mimetype,
                    filename: finalFilename,
                    name: incomingMessage.media.fileName || finalFilename,
                    size: buffer.length,
                    source: 'uazapi'
                };

                // Ensure mappedType is correct if we have a file
                if (mappedType === 'text') {
                    if (mimetype && mimetype.startsWith('image/')) mappedType = 'image';
                    else if (mimetype && mimetype.startsWith('audio/')) mappedType = 'audio';
                    else if (mimetype && mimetype.startsWith('video/')) mappedType = 'video';
                    else mappedType = 'file';
                    
                    this.logger.log(`Corrected message type from text to ${mappedType} based on attachments`);
                }
             } else {
                 this.logger.warn(`Failed to process media for message ${incomingMessage.messageId}. No valid buffer or URL available.`);
                 // Fallback to text to avoid "loading forever" in frontend
                 mappedType = 'text';
                 incomingMessage.message = incomingMessage.message 
                    ? `${incomingMessage.message} (Erro: Mídia não disponível)`
                    : '[Erro: Mídia não disponível - Falha no download]';
             }
         } catch (error) {
             this.logger.error('Error processing Uazapi media', error);
         }
      }

      // Check if message already exists to avoid duplicates
      // Especially for Uazapi which might send updates (like FileDownloadedMessage)
      const existingMessage = await this.prisma.message.findFirst({
        where: {
           conversationId: conversation.id,
           metadata: {
              path: ['providerMessageId'],
              equals: incomingMessage.messageId
           }
        }
      });

      if (existingMessage) {
        this.logger.log(`Message ${incomingMessage.messageId} already exists. Checking for updates...`);
        
        // If the new message has attachments and the existing one doesn't (or has broken one), update it.
        // Or if we just want to ensure we have the best version.
        if (attachments && Object.keys(attachments).length > 0) {
             this.logger.log(`Updating existing message ${existingMessage.id} with new attachments.`);
             await this.messagesService.update(existingMessage.id, {
                 attachments: attachments,
                 type: mappedType
             });
             return { status: 'updated' };
        }
        
        this.logger.log(`Message ${incomingMessage.messageId} is a duplicate and adds no new info. Ignoring.`);
        return { status: 'ignored_duplicate' };
      }

      await this.messagesService.create({
        conversationId: conversation.id,
        content: incomingMessage.message,
        senderType: 'contact',
        type: mappedType,
        attachments,
        metadata: { providerMessageId: incomingMessage.messageId }
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
  create(
    @Body() createWebhookDto: CreateWebhookDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.webhooksService.create(createWebhookDto, organizationId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@GetUser('organizationId') organizationId: string) {
    return this.webhooksService.findAll(organizationId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.webhooksService.findOne(id, organizationId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.webhooksService.update(id, updateWebhookDto, organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.webhooksService.remove(id, organizationId);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testWebhook(
    @Body() body: { event: string; payload: any },
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.webhooksService.triggerWebhook(
      body.event,
      body.payload,
      organizationId,
    );
    return { message: 'Webhook triggered' };
  }
}
