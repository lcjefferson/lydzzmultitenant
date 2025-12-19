import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface UazapiTextMessage {
  number: string;
  text: string;
}

@Injectable()
export class UazapiService {
  private readonly logger = new Logger(UazapiService.name);
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('UAZAPI_API_URL') ??
      'https://api.uazapi.dev';
  }

  /**
   * Send a text message via Uazapi
   */
  async sendMessage(
    to: string,
    message: string,
    instanceId: string,
    token: string,
  ): Promise<boolean> {
    try {
      // Endpoint identified via user documentation
      const url = `${this.apiUrl}/send/text`;
      
      const payload = {
        number: to,
        text: message,
      };

      this.logger.log(`Sending Uazapi message to ${url} with payload: ${JSON.stringify(payload)}`);

      const response = await axios.post<unknown>(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'token': token, // Token identifies the instance
          },
        },
      );
      this.logger.log(`Message sent to ${to} via Uazapi. Status: ${(response as any).status}`);
      return true;

    } catch (error) {
      const err = error as any;
      this.logger.error(
        `Failed to send Uazapi message: ${err.message ?? 'unknown'}`,
      );
      if (err.response) {
          this.logger.error(`Uazapi error response: ${JSON.stringify(err.response.data)}`);
      }
      return false;
    }
  }

  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption: string,
    instanceId: string,
    token: string,
  ): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/send/media`;
      
      let fileToSend = mediaUrl;
      const appUrl = this.configService.get<string>('APP_URL');

      // Attempt to convert local file URL to Base64 to bypass ngrok/network issues
      if (appUrl && mediaUrl.startsWith(appUrl)) {
        try {
          const relativePath = mediaUrl.replace(appUrl, '');
          // Remove leading slash if present
          const safePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
          const absolutePath = path.join(process.cwd(), safePath);

          if (fs.existsSync(absolutePath)) {
            const fileBuffer = fs.readFileSync(absolutePath);
            const mimeType = this.getMimeType(absolutePath);
            const base64 = fileBuffer.toString('base64');
            fileToSend = `data:${mimeType};base64,${base64}`;
            this.logger.log(`Converted local file to Base64: ${absolutePath}`);
          } else {
            this.logger.warn(`Local file not found for Base64 conversion: ${absolutePath}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to convert local file to Base64: ${error.message}`);
        }
      }
      
      const payload: any = {
        number: to,
        type: mediaType,
        file: fileToSend,
      };

      if (caption) {
          payload.message = caption; // Assuming 'message' field for caption based on standard patterns
      }

      this.logger.log(`Sending Uazapi media to ${url} with payload: ${JSON.stringify({ ...payload, file: payload.file.substring(0, 50) + '...' })}`);

      const response = await axios.post<unknown>(
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'token': token,
          },
        },
      );
      this.logger.log(`Media sent to ${to} via Uazapi. Status: ${(response as any).status}`);
      return true;

    } catch (error) {
      const err = error as any;
      this.logger.error(
        `Failed to send Uazapi media: ${err.message ?? 'unknown'}`,
      );
      if (err.response) {
          this.logger.error(`Uazapi error response: ${JSON.stringify(err.response.data)}`);
      }
      return false;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      case '.pdf': return 'application/pdf';
      case '.mp4': return 'video/mp4';
      case '.mov': return 'video/quicktime';
      case '.avi': return 'video/x-msvideo';
      case '.mp3': return 'audio/mpeg';
      case '.ogg': return 'audio/ogg';
      case '.wav': return 'audio/wav';
      case '.webm': return 'audio/webm';
      case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls': return 'application/vnd.ms-excel';
      case '.doc': return 'application/msword';
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Parse incoming Uazapi webhook payload
   * This structure is a placeholder and needs to be updated based on actual Uazapi webhook documentation.
   */
  parseIncomingMessage(payload: any): {
    from: string;
    message: string;
    messageId: string;
    timestamp: string;
    type: string;
    instanceId?: string;
    contactName?: string;
    media?: {
      type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
      url?: string;
      mimetype?: string;
      caption?: string;
      base64?: string;
      fileName?: string;
      mediaKey?: string;
    };
  } | null {
    try {
      this.logger.log(`Parsing payload keys: ${Object.keys(payload).join(', ')}`);
      
      // Determine the root message object
      let messageData = payload;
      const eventType = payload.event || payload.EventType;
      
      // Handle "messages.upsert" event structure (Baileys/Uazapi common)
      if (eventType === 'messages.upsert' && payload.data) {
        messageData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
      } else if ((eventType === 'messages' || eventType === 'MESSAGE') && payload.message) {
         // Uazapi "messages" event structure
         messageData = typeof payload.message === 'string' ? JSON.parse(payload.message) : payload.message;
         // Map root owner to instanceId if available
         if (payload.owner && !payload.instanceId) {
             (payload as any).instanceId = payload.owner;
         }
      } else if (payload.messages?.[0]) {
        messageData = payload.messages[0];
      } else if (eventType === 'messages.update' && payload.data) {
        // Handle message update (often just status updates, but sometimes edits)
        // For now, if it has content, treat as message, otherwise ignore or handle status
        messageData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
      } else if (payload.data && !eventType) {
        // Fallback: if data exists but event is missing, assume data is the message object
        // This handles cases where event name might be missing or different
        messageData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
      }

      // Check if it's just a status update (has status but no content usually)
      if (messageData.status && !messageData.message && !messageData.content && !messageData.text) {
          this.logger.log('Ignoring status update event');
          return null;
      }

      // Extract 'from'
      let from = '';
      if (messageData.sender_pn) {
         // Preferred for Uazapi/Baileys as it contains the raw phone number
         from = messageData.sender_pn.replace(/@.+/, '');
      } else if (messageData.key?.remoteJid) {
        from = messageData.key.remoteJid.replace(/@.+/, '');
      } else if (messageData.sender) {
        from = messageData.sender.replace(/@.+/, '');
      } else if (messageData.from) {
        from = messageData.from;
      } else if (messageData.phone) {
        from = messageData.phone;
      }

      // Extract text content
      let textBody = '';
      if (messageData.message?.conversation) {
        textBody = messageData.message.conversation;
      } else if (messageData.message?.extendedTextMessage?.text) {
        textBody = messageData.message.extendedTextMessage.text;
      } else if (messageData.content?.text) {
         textBody = messageData.content.text;
      } else if (messageData.text?.body) {
        textBody = messageData.text.body;
      } else if (typeof messageData.text === 'string') {
        textBody = messageData.text;
      } else if (messageData.content) {
        textBody = typeof messageData.content === 'string' ? messageData.content : JSON.stringify(messageData.content);
      } else if (messageData.body) {
        textBody = messageData.body;
      }

      // If textBody is still empty but we have a message object, try to find caption (for media)
      if (!textBody && messageData.message) {
          const msg = messageData.message;
          textBody = msg.imageMessage?.caption || msg.videoMessage?.caption || msg.documentMessage?.caption || '';
          
          // If still empty, use a placeholder for media messages so they aren't dropped
          if (!textBody) {
             if (msg.imageMessage) textBody = '[Imagem]';
             else if (msg.videoMessage) textBody = '[Vídeo]';
             else if (msg.audioMessage) textBody = '[Áudio]';
             else if (msg.documentMessage) textBody = '[Documento]';
             else if (msg.stickerMessage) textBody = '[Sticker]';
          }
      }

      // Extract other fields
      const messageId = messageData.key?.id || messageData.messageid || messageData.id || '';
      const timestamp = messageData.messageTimestamp ? new Date(Number(messageData.messageTimestamp)).toISOString() : (messageData.timestamp || new Date().toISOString());
      
      let type = messageData.type || messageData.messageType || 'text';
      if (type === 'ExtendedTextMessage') type = 'text';

      const instanceId = payload.instanceId || payload.instance_id || payload.owner;
      const contactName = messageData.pushName || messageData.senderName || messageData.contact?.name || messageData.notifyName || payload.chat?.contactName;

      // Extract media details
      let media: any = undefined;
      if (messageData.message) {
        const msg = messageData.message;
        if (msg.imageMessage) {
            media = {
                type: 'image',
                url: msg.imageMessage.url,
                mimetype: msg.imageMessage.mimetype,
                caption: msg.imageMessage.caption,
                base64: msg.imageMessage.base64 || (typeof msg.imageMessage.url === 'string' && msg.imageMessage.url.startsWith('data:') ? msg.imageMessage.url : undefined),
                mediaKey: msg.imageMessage.mediaKey
            };
        } else if (msg.videoMessage) {
             media = {
                type: 'video',
                url: msg.videoMessage.url,
                mimetype: msg.videoMessage.mimetype,
                caption: msg.videoMessage.caption,
                base64: msg.videoMessage.base64,
                mediaKey: msg.videoMessage.mediaKey
            };
        } else if (msg.audioMessage) {
             media = {
                type: 'audio',
                url: msg.audioMessage.url,
                mimetype: msg.audioMessage.mimetype,
                base64: msg.audioMessage.base64,
                mediaKey: msg.audioMessage.mediaKey
            };
        } else if (msg.documentMessage) {
             media = {
                type: 'document',
                url: msg.documentMessage.url,
                mimetype: msg.documentMessage.mimetype,
                caption: msg.documentMessage.caption,
                fileName: msg.documentMessage.fileName || msg.documentMessage.title,
                base64: msg.documentMessage.base64,
                mediaKey: msg.documentMessage.mediaKey
            };
        }
      }

      this.logger.log(`Extracted data - From: ${from}, Msg: ${textBody}, Type: ${type}, Inst: ${instanceId}`);

      if (!from || !textBody) {
        this.logger.warn('Missing required fields (from or message)');
        return null;
      }

      return {
        from,
        message: textBody,
        messageId,
        timestamp,
        type,
        instanceId, 
        contactName, 
        media,
      };
    } catch (error) {
      this.logger.error('Error parsing Uazapi webhook:', error);
      return null;
    }
  }
}
