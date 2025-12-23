import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import * as fs from 'fs';
import * as path from 'path';

import { ConversationsGateway } from '../conversations/conversations.gateway';

import { OpenAIService } from '../common/openai.service';
import { WhatsAppService } from '../integrations/whatsapp.service';
import { UazapiService } from '../integrations/uazapi.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
    private readonly openAIService: OpenAIService,
    private readonly whatsAppService: WhatsAppService,
    private readonly uazapiService: UazapiService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async syncMessages(conversationId: string): Promise<number> {
    try {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { channel: true },
        });

        if (!conversation || conversation.channel.type !== 'whatsapp') {
            return 0;
        }

        const channelConfig = conversation.channel.config as any;
        const token = channelConfig?.token || this.configService.get<string>('UAZAPI_INSTANCE_TOKEN');
        if (!token) {
            this.logger.error('No Uazapi token found for sync');
            return 0;
        }

        const contactPhone = conversation.contactIdentifier.replace(/\D/g, '');
        const chatId = `${contactPhone}@s.whatsapp.net`;

        this.logger.log(`Syncing messages for chat ${chatId} using token ${token.slice(0, 10)}...`);

        const uazapiMessages = await this.uazapiService.findMessages(chatId, 50, 0, token);

        if (!uazapiMessages || !Array.isArray(uazapiMessages)) {
            this.logger.log(`No messages found for chat ${chatId}`);
            return 0;
        }

        this.logger.log(`Found ${uazapiMessages.length} messages from Uazapi`);
        
        let importedCount = 0;

        // Process messages from oldest to newest if they are returned new-to-old
        // Usually APIs return newest first. Let's reverse to insert in order.
        // But findMessages order depends on API. Let's assume newest first and reverse.
        const messagesToProcess = [...uazapiMessages].reverse();

        for (const msg of messagesToProcess) {
            // Filter out group messages
            const remoteJid = msg.key?.remoteJid || '';
            if (remoteJid.endsWith('@g.us')) {
                continue;
            }

            // Determine sender
            const isFromMe = msg.key?.fromMe === true;
            const senderType = isFromMe ? 'user' : 'contact'; // 'user' represents the system/agent

            // Extract content
            let content = '';
            if (msg.message?.conversation) content = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage?.caption) content = msg.message.imageMessage.caption;
            else if (msg.message?.videoMessage?.caption) content = msg.message.videoMessage.caption;
            else if (msg.message?.documentMessage?.caption) content = msg.message.documentMessage.caption;
            
            if (!content) {
                if (msg.message?.imageMessage) content = '[Imagem]';
                else if (msg.message?.videoMessage) content = '[Vídeo]';
                else if (msg.message?.audioMessage) content = '[Áudio]';
                else if (msg.message?.documentMessage) content = '[Documento]';
                else if (msg.message?.stickerMessage) content = '[Sticker]';
            }

            if (!content && !msg.message) continue;

            // Timestamp
            const messageTimestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date();

            // Check for duplicates
            // We use a fuzzy check on content and approximate timestamp (within 1 second)
            // Or strictly check if we have stored providerMessageId
            const providerId = msg.key?.id;
            
            // Check by providerId in metadata if possible, but we haven't been saving it consistently.
            // Check by content and time range.
            const existing = await this.prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: content,
                    createdAt: {
                        gte: new Date(messageTimestamp.getTime() - 2000),
                        lte: new Date(messageTimestamp.getTime() + 2000)
                    },
                    senderType: senderType
                }
            });

            if (existing) {
                // Check if we need to backfill media for existing messages
                if ((existing.type === 'image' || existing.type === 'video' || existing.type === 'audio' || existing.type === 'file') && 
                    (!existing.attachments || Object.keys(existing.attachments as object).length === 0)) {
                    
                    let attachments: any = undefined;
                    if (msg.message?.imageMessage) attachments = await this.processSyncedMedia(msg, 'image', token);
                    else if (msg.message?.videoMessage) attachments = await this.processSyncedMedia(msg, 'video', token);
                    else if (msg.message?.audioMessage) attachments = await this.processSyncedMedia(msg, 'audio', token);
                    else if (msg.message?.documentMessage) attachments = await this.processSyncedMedia(msg, 'document', token);

                    if (attachments) {
                         this.logger.log(`Backfilled media for message ${existing.id}`);
                         await this.prisma.message.update({
                             where: { id: existing.id },
                             data: { attachments }
                         });
                         importedCount++; 
                    }
                }
                continue;
            }

            // Handle Media
            let attachments: any = undefined;
            let type = 'text';
            
            if (msg.message?.imageMessage) {
                type = 'image';
                attachments = await this.processSyncedMedia(msg, 'image', token);
            } else if (msg.message?.videoMessage) {
                type = 'video';
                attachments = await this.processSyncedMedia(msg, 'video', token);
            } else if (msg.message?.audioMessage) {
                type = 'audio';
                attachments = await this.processSyncedMedia(msg, 'audio', token);
            } else if (msg.message?.documentMessage) {
                type = 'file';
                attachments = await this.processSyncedMedia(msg, 'document', token);
            }

            await this.create({
                conversationId: conversation.id,
                content: content,
                senderType: senderType,
                type: type,
                attachments,
                skipAI: true,
                metadata: {
                    providerMessageId: providerId,
                    synced: true
                }
            });
            importedCount++;
        }

        return importedCount;
    } catch (error) {
        this.logger.error(`Error syncing messages: ${(error as Error).message}`);
        return 0;
    }
  }

  private async processSyncedMedia(msg: any, type: string, token: string): Promise<any> {
      try {
        const messageId = msg.key?.id;
        if (!messageId) return undefined;

        // Try to download media
        // Note: findMessages might not return base64 or url directly.
        // We might need to call downloadMedia.
        
        // Check if url is present and valid?
        // Usually url in message object is internal WhatsApp URL, not accessible.
        // So we must download.
        
        const downloaded = await this.uazapiService.downloadMedia(messageId, token);
        if (!downloaded) return undefined;

        const ext = downloaded.mimetype ? downloaded.mimetype.split('/')[1].replace('; codecs=opus', '') : 'bin';
        const filename = downloaded.filename || `${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filepath = path.join(uploadDir, filename);
        
        fs.writeFileSync(filepath, downloaded.buffer);
        
        return {
            url: `/uploads/${filename}`,
            path: `/uploads/${filename}`,
            mimetype: downloaded.mimetype,
            filename: filename,
            source: 'uazapi-sync'
        };
      } catch (e) {
          this.logger.error(`Failed to process synced media: ${e}`);
          return undefined;
      }
  }

  async create(dto: CreateMessageDto): Promise<any> {
    const message = await this.prisma.message.create({
      data: {
        type: dto.type ?? 'text',
        content: dto.content,
        senderType: dto.senderType,
        confidence: dto.confidence,
        metadata: dto.metadata,
        attachments: dto.attachments,
        conversation: {
          connect: { id: dto.conversationId },
        },
      },
    });

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: new Date() },
    });

    this.gateway.emitNewMessage(dto.conversationId, message);

    if (dto.senderType === 'contact') {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
        include: { channel: true },
      });

      if (conversation) {
        const existingLead = await this.prisma.lead.findFirst({
          where: {
            organizationId: conversation.organizationId,
            phone: conversation.contactIdentifier,
          },
        });

        const lead =
          existingLead ||
          (await this.prisma.lead.create({
            data: {
              name: conversation.contactName || conversation.contactIdentifier,
              phone: conversation.contactIdentifier,
              status: 'Lead Novo',
              temperature: 'cold',
              source: conversation.channel.type,
              organizationId: conversation.organizationId,
            },
          }));

        if (!conversation.leadId) {
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { leadId: lead.id },
          });
        }

        if (lead.assignedToId) {
          await this.notificationsService.create({
            type: 'lead_message_received',
            entityId: lead.id,
            userId: lead.assignedToId,
            organizationId: lead.organizationId,
            data: {
              leadId: lead.id,
              leadName: lead.name,
              messageContent: dto.content,
              conversationId: conversation.id,
            },
          });
        }
      }

      if (conversation && !conversation.agentId) {
        const defaultAgent = await this.prisma.agent.findFirst({
          where: {
            organizationId: conversation.organizationId,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (defaultAgent) {
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { agentId: defaultAgent.id },
          });
        }
      }

      if (!dto.skipAI) {
        this.handleAIResponse(dto.conversationId, dto.content);
        await this.qualifyLeadForConversation(dto.conversationId, dto.content);
      }
    }

    if (dto.senderType === 'user') {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
        include: { channel: true },
      });

      if (conversation && conversation.channel.type === 'whatsapp') {
        let mediaUrl: string | undefined;
        let mediaType: 'image' | 'video' | 'audio' | 'document' | undefined;

        // Handle media messages (image, file, audio, video)
        if (dto.type === 'image' || dto.type === 'file' || dto.type === 'audio' || dto.type === 'video') {
            const relativePath = dto.attachments?.url || dto.metadata?.file?.path || dto.attachments?.path;
            
            if (relativePath) {
                // Construct full URL for Uazapi if path is relative
                if (!relativePath.startsWith('http')) {
                    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3001';
                    // Ensure relativePath doesn't start with / if we add one, or handle it
                    // relativePath from upload is likely "/uploads/..."
                    mediaUrl = `${appUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
                } else {
                    mediaUrl = relativePath;
                }
            }

            // Determine media type for Uazapi
            if (dto.type === 'image') mediaType = 'image';
            else if (dto.type === 'audio') mediaType = 'audio';
            else if (dto.type === 'video') mediaType = 'video';
            else mediaType = 'document'; // Default for 'file'
        }

        const success = await this.sendWhatsAppMessage(conversation, dto.content, mediaUrl, mediaType);
        
        if (!success) {
            this.logger.error(`Failed to send message ${message.id} via WhatsApp`);
            // Update metadata to indicate failure
            await this.prisma.message.update({
                where: { id: message.id },
                data: {
                    metadata: {
                        ...(message.metadata as object || {}),
                        status: 'failed',
                        error: 'Failed to send to provider'
                    }
                }
            });
        } else {
            // Update metadata to indicate success (optional, or rely on lack of error)
             await this.prisma.message.update({
                where: { id: message.id },
                data: {
                    metadata: {
                        ...(message.metadata as object || {}),
                        status: 'sent',
                        sentAt: new Date().toISOString()
                    }
                }
            });
        }
      }

      if (conversation && !conversation.agentId) {
        const defaultAgent = await this.prisma.agent.findFirst({
          where: {
            organizationId: conversation.organizationId,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (defaultAgent) {
          await this.prisma.conversation.update({
            where: { id: conversation.id },
            data: { agentId: defaultAgent.id },
          });
        }
      }

      this.handleAIResponse(dto.conversationId, dto.content);
    }

    return message;
  }

  private async qualifyLeadForConversation(
    conversationId: string,
    latestMessage: string,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });
    const lead = conv?.lead;
    if (!lead) return;
    const text = (latestMessage || '').toLowerCase();
    const hotKeywords = [
      'comprar',
      'preço',
      'proposta',
      'orçamento',
      'contratar',
      'assinar',
      'pagamento',
      'fechar',
      'negócio',
      'pedido',
    ];
    const warmKeywords = [
      'interesse',
      'mais detalhes',
      'reunião',
      'agenda',
      'demo',
      'teste',
      'avaliar',
    ];
    let scoreDelta = 0;
    if (hotKeywords.some((k) => text.includes(k))) scoreDelta += 50;
    else if (warmKeywords.some((k) => text.includes(k))) scoreDelta += 30;
    if (text.includes('?')) scoreDelta += 5;
    const base = Math.max(lead.score || 0, 10);
    const nextScore = Math.max(0, Math.min(100, base + scoreDelta));
    const nextTemp =
      nextScore >= 70 ? 'hot' : nextScore >= 40 ? 'warm' : 'cold';
    const nextStatus = lead.status === 'new' ? 'contacted' : lead.status;
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        score: nextScore,
        temperature: nextTemp,
        status: nextStatus,
        lastContactAt: new Date(),
      },
    });
  }

  private handleAIResponse(conversationId: string, userMessage: string) {
    setTimeout(() => {
      void (async () => {
        try {
          const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { agent: true },
          });

          if (!conversation || !conversation.agentId) {
            return;
          }

          if (conversation.agent && !conversation.agent.isActive) {
             return;
          }

          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey || apiKey.includes('your-') || apiKey.length < 10) {
             // Silently skip if no valid key is configured to avoid logs spam
             return;
          }

          const aiResponse = await this.openAIService.generateResponse(
            conversationId,
            userMessage,
          );

          if (aiResponse) {
            const aiMessage = await this.prisma.message.create({
              data: {
                type: 'text',
                content: aiResponse,
                senderType: 'ai',
                conversation: {
                  connect: { id: conversationId },
                },
              },
              include: {
                conversation: {
                  include: {
                    channel: true,
                  },
                },
              },
            });

            await this.prisma.conversation.update({
              where: { id: conversationId },
              data: { lastMessageAt: new Date() },
            });

            this.gateway.emitNewMessage(conversationId, aiMessage);

            if (aiMessage.conversation.channel.type === 'whatsapp') {
              await this.sendWhatsAppMessage(
                aiMessage.conversation,
                aiResponse,
              );
            }
          }
        } catch (error) {
          console.error('Error handling AI response:', error);
        }
      })();
    }, 1000);
  }

  private async sendWhatsAppMessage(
    conversation: {
      contactIdentifier: string;
      channel: {
        config: any;
        accessToken?: string | null;
      };
    },
    message: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document',
  ) {
    try {
      const channel = conversation.channel;
      const config =
        typeof channel.config === 'object' && channel.config !== null
          ? (channel.config as {
              phoneNumberId?: string;
              accessToken?: string;
              instanceId?: string;
              token?: string;
              serverUrl?: string;
              provider?: 'whatsapp-official' | 'uazapi';
            })
          : null;

      const envToken = this.configService.get<string>('UAZAPI_INSTANCE_TOKEN');

      let provider = (channel as unknown as { provider?: string }).provider;

      // Smart provider detection logic
      // If provider says 'whatsapp-official' (default) but config looks like Uazapi, switch to Uazapi
      if (!provider || provider === 'whatsapp-official') {
          const hasUazapiToken = !!(config?.token || envToken);
          const hasOfficialConfig = !!(config?.phoneNumberId || channel.accessToken || this.configService.get('WHATSAPP_ACCESS_TOKEN'));
          
          // If we have Uazapi token but no explicit Official config in the channel itself (ignoring env fallback for official for a moment to be safe, or checking if env fallback is actually used)
          // Actually, let's prioritize Uazapi if explicit config is present
          if (config?.token || config?.instanceId) {
             provider = 'uazapi';
          } else if (hasUazapiToken && !hasOfficialConfig) {
             provider = 'uazapi';
          }
      }
      
      // Explicit override from config
      if (config?.provider) {
          provider = config.provider;
      }

      console.log(`Sending message via provider: ${provider}, to: ${conversation.contactIdentifier}`);

      if (provider === 'uazapi') {
        // Use logic OR (||) to fallback to envToken if config.token is empty string
        const token = config?.token || envToken;
        console.log(`Uazapi config - Token: ${token ? '***' + token.slice(-4) : 'missing'}`);
        
        if (!token) {
          console.error('Uazapi channel missing configuration');
          return false;
        }

        if (mediaUrl && mediaType) {
          const success = await this.uazapiService.sendMediaMessage(
            conversation.contactIdentifier,
            mediaUrl,
            mediaType,
            message,
            token,
            config?.serverUrl,
          );
          if (!success) {
            this.logger.error(`Failed to send media message via Uazapi to ${conversation.contactIdentifier}`);
            return false;
          }
          return true;
        } else {
          const success = await this.uazapiService.sendMessage(
            conversation.contactIdentifier,
            message,
            token,
            config?.serverUrl,
          );
          if (!success) {
            this.logger.error(`Failed to send text message via Uazapi to ${conversation.contactIdentifier}`);
            return false;
          }
          return true;
        }
      }

      const accessToken = config?.accessToken || channel.accessToken || this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = config?.phoneNumberId || this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');

      if (!phoneNumberId || !accessToken) {
        console.error('WhatsApp channel missing configuration');
        return false;
      }

      await this.whatsAppService.sendMessage(
        conversation.contactIdentifier,
        message,
        phoneNumberId,
        accessToken,
      );
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  async findAll(conversationId: string): Promise<any[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<any | null> {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async update(id: string, data: any): Promise<any> {
    const updated = await this.prisma.message.update({
      where: { id },
      data,
    });
    this.gateway.emitMessageUpdated(updated.conversationId, updated);
    return updated;
  }

  async remove(id: string): Promise<any> {
    return this.prisma.message.delete({ where: { id } });
  }
}
