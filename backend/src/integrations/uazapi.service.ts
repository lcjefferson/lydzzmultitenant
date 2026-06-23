import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { looksLikePhoneNumber, normalizeServiceUrl } from '../common/channel-credentials.util';

interface UazapiTextMessage {
  number: string;
  text: string;
}

function pickField(
  obj: unknown,
  ...keys: string[]
): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const val = record[key];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }
  const byLower = new Map(
    Object.keys(record).map((k) => [k.toLowerCase(), k]),
  );
  for (const key of keys) {
    const actual = byLower.get(key.toLowerCase());
    if (!actual) continue;
    const val = record[actual];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }
  return undefined;
}

function jidToPhone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return value.trim().replace(/@.+$/, '');
}

function firstString(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    return firstString(value[0]);
  }
  return '';
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

  private async requestWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    data: any = null,
    config: any = {},
    retries: number = 3,
    delay: number = 1000
  ): Promise<any> {
    try {
      if (method === 'get') {
        return await axios.get(url, config);
      } else {
        return await axios.post(url, data, config);
      }
    } catch (error) {
      const err = error as any;
      if (retries > 0 && err.response && err.response.status === 429) {
        this.logger.warn(`Rate limit exceeded for ${url}. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry(method, url, data, config, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  /**
   * Send a text message via Uazapi
   */
  async sendMessage(
    to: string,
    message: string,
    token: string,
    apiUrl?: string,
    channelType: string = 'whatsapp',
  ): Promise<boolean> {
    try {
      // Endpoint identified via user documentation
      const baseUrl = apiUrl || this.apiUrl;
      const url = `${baseUrl}/send/text`;
      
      // Sanitize number only for WhatsApp to remove non-digits
      const cleanNumber = channelType === 'whatsapp' ? to.replace(/\D/g, '') : to;

      const payload = {
        number: cleanNumber,
        text: message,
      };

      this.logger.log(`Sending Uazapi message to ${url} with payload: ${JSON.stringify(payload)}`);

      const response = await this.requestWithRetry(
        'post',
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'token': token, // Token identifies the instance
          },
        }
      );
      this.logger.log(`Message sent to ${to} via Uazapi. Status: ${(response as any).status}`);
      return true;

    } catch (error) {
      const err = error as any;
      this.logger.error(
        `Failed to send Uazapi message: ${err.message ?? 'unknown'}`,
      );
      if (err.response) {
          this.logger.error(`Uazapi error response data: ${JSON.stringify(err.response.data)}`);
          this.logger.error(`Uazapi error response status: ${err.response.status}`);
          this.logger.error(`Uazapi error response headers: ${JSON.stringify(err.response.headers)}`);
      }
      return false;
    }
  }

  /**
   * Send interactive menu (buttons, list, poll or carousel) via Uazapi.
   * @see https://docs.uazapi.com/endpoint/post/send~menu
   */
  async sendMenu(
    to: string,
    payload: {
      type: 'button' | 'list' | 'poll' | 'carousel';
      text: string;
      choices: string[];
      footerText?: string;
      listButton?: string;
      imageButton?: string;
      selectableCount?: number;
      delay?: number;
    },
    token: string,
    apiUrl?: string,
    channelType: string = 'whatsapp',
  ): Promise<boolean> {
    try {
      const baseUrl = (apiUrl || this.apiUrl).replace(/\/$/, '');
      const url = `${baseUrl}/send/menu`;
      const cleanNumber = channelType === 'whatsapp' ? to.replace(/\D/g, '') : to;

      const body: Record<string, unknown> = {
        number: cleanNumber,
        type: payload.type,
        text: payload.text,
        choices: payload.choices,
      };
      if (payload.footerText) body.footerText = payload.footerText;
      if (payload.listButton) body.listButton = payload.listButton;
      if (payload.imageButton) body.imageButton = payload.imageButton;
      if (payload.selectableCount != null) body.selectableCount = payload.selectableCount;
      if (payload.delay != null) body.delay = Math.min(5000, Math.max(0, payload.delay)) as number;

      this.logger.log(`Sending Uazapi menu (${payload.type}) to ${cleanNumber}`);
      const response = await this.requestWithRetry('post', url, body, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'token': token,
        },
      });
      this.logger.log(`Menu sent to ${to} via Uazapi. Status: ${(response as any)?.status}`);
      return true;
    } catch (error) {
      const err = error as any;
      this.logger.error(`Failed to send Uazapi menu: ${err.message ?? 'unknown'}`);
      if (err.response) {
        this.logger.error(`Uazapi menu error: ${JSON.stringify(err.response.data)}`);
      }
      return false;
    }
  }

  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption: string,
    token: string,
    apiUrl?: string,
    channelType: string = 'whatsapp',
    fileName?: string,
  ): Promise<boolean> {
    try {
      const baseUrl = apiUrl || this.apiUrl;
      let url = `${baseUrl}/send/media`;
      
      // Sanitize number only for WhatsApp
      const cleanNumber = channelType === 'whatsapp' ? to.replace(/\D/g, '') : to;

      let fileToSend = mediaUrl;
      const appUrl = this.configService.get<string>('APP_URL');

      // Check if it's an audio file that needs special PTT (Push To Talk) treatment
      const isAudio = mediaType === 'audio' || (fileName && fileName.toLowerCase().endsWith('.webm'));
      const endpoint = isAudio ? 'ptt' : 'media';
      url = `${baseUrl}/send/${endpoint}`;

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
        number: cleanNumber,
        type: isAudio ? 'audio' : mediaType,
        file: fileToSend,
      };

      if (caption) {
          payload.message = caption; // Assuming 'message' field for caption based on standard patterns
      }

      if (fileName) {
          payload.fileName = fileName;
      }

      this.logger.log(`Sending Uazapi media to ${url} with payload: ${JSON.stringify({ ...payload, file: payload.file.substring(0, 50) + '...' })}`);

      const response = await this.requestWithRetry(
        'post',
        url,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'token': token,
          },
        }
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
  async downloadMedia(
    messageId: string,
    token: string,
    apiUrl?: string,
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    if (!token) {
        this.logger.error('Download media failed: No token provided');
        return null;
    }

    try {
        this.logger.log(`Attempting to download media for message ${messageId}`);
        const baseUrl = apiUrl || this.apiUrl;
        const url = `${baseUrl}/message/download`;
        const payload = {
            id: messageId,
            return_base64: true, // Request base64 directly
            generate_mp3: false,
            return_link: true,   // Request link as fallback
            transcribe: false,
            download_quoted: false
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'token': token,
            },
            timeout: 15000 // 15s timeout
        });

        this.logger.log(`Download media response status: ${response.status}`);

        // Handle case where Uazapi returns data with keys like base64Data, fileURL, etc.
        const responseData = response.data as any;
        const base64Data = responseData.base64 || responseData.base64Data;
        
        if (base64Data) {
            this.logger.log(`Download media success. Base64 length: ${base64Data.length}`);
            // Check if base64 has prefix
            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            
            let buffer: Buffer;
            let mimetype = responseData.mimetype || 'application/octet-stream';
            
            if (matches && matches.length === 3) {
                mimetype = matches[1];
                buffer = Buffer.from(matches[2], 'base64');
            } else {
                buffer = Buffer.from(base64Data, 'base64');
            }
            
            return {
                buffer,
                mimetype,
                filename: responseData.filename
            };
        } else if (responseData.link || responseData.fileURL) {
             const link = responseData.link || responseData.fileURL;
             this.logger.log(`Base64 missing, attempting to download from link: ${link}`);
             try {
                 const linkResponse = await axios.get(link, { 
                     responseType: 'arraybuffer',
                     timeout: 15000 
                 });
                 const buffer = Buffer.from(linkResponse.data);
                 const mimetype = linkResponse.headers['content-type'] || responseData.mimetype || 'application/octet-stream';
                 this.logger.log(`Downloaded media from link. Size: ${buffer.length}`);
                 return {
                     buffer,
                     mimetype,
                     filename: responseData.filename
                 };
             } catch (linkError) {
                 this.logger.error(`Failed to download from link: ${(linkError as Error).message}`);
             }
        }
        
        this.logger.error(`Download media response missing base64 and link. Data keys: ${Object.keys(response.data || {}).join(', ')}`);
        if (response.data) {
             this.logger.error(`Response data: ${JSON.stringify(response.data)}`);
        }
        

        return null;
    } catch (error) {
        const err = error as any;
        const baseUrl = apiUrl || this.apiUrl;
        const targetUrl = `${baseUrl}/message/download`;
        this.logger.error(`Error downloading media from Uazapi [${targetUrl}]: ${err.message}`);
        
        // Log connection details for debugging
        if (err.code === 'ECONNREFUSED') {
             this.logger.error(`Connection refused! Check if UAZAPI_API_URL (${baseUrl}) is correct and reachable from inside the docker container.`);
        }
        
        if (err.response) {
            this.logger.error(`Uazapi error response status: ${err.response.status}`);
            this.logger.error(`Uazapi error response data: ${JSON.stringify(err.response.data)}`);
            this.logger.error(`Uazapi error response headers: ${JSON.stringify(err.response.headers)}`);
        }
        return null;
    }
  }

  async checkConnection(token: string, apiUrl?: string): Promise<{ success: boolean; instanceId?: string }> {
    try {
      const baseUrl = apiUrl || this.apiUrl;
      // Endpoint /instance/status is common for Uazapi/Evolution
      const url = `${baseUrl}/instance/status`;
      
      const response = await axios.get(url, {
        headers: { 'token': token }
      });

      if (response.status === 200) {
          const data = response.data;
          // Try to find instanceId in various common fields
          const instanceId = data.instanceId || data.id || (data.instance && data.instance.instanceId);
          return { success: true, instanceId };
      }
      return { success: false };
    } catch (error) {
      this.logger.error(`Uazapi connection check failed: ${(error as Error).message}`);
      return { success: false };
    }
  }

  async findMessages(
    chatId: string,
    limit: number = 20,
    offset: number = 0,
    token: string,
    apiUrl?: string,
  ): Promise<any[]> {
    try {
        const baseUrl = apiUrl || this.apiUrl;
        const url = `${baseUrl}/message/find`;
        const payload = {
            chatid: chatId,
            limit,
            offset
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'token': token,
            }
        });

        if (response.data && Array.isArray(response.data)) {
            return response.data;
        } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
            // Some APIs return { data: [...] }
            return response.data.data;
        }

        return [];
    } catch (error) {
        this.logger.error(`Error finding messages from Uazapi: ${(error as Error).message}`);
        return [];
    }
  }

  parseIncomingMessage(payload: any): {
    from: string;
    message: string;
    messageId: string;
    timestamp: string;
    type: string;
    instanceId?: string;
    serverUrl?: string;
    token?: string;
    contactName?: string;
    isGroup?: boolean;
    fromMe?: boolean;
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
      const rawEvent = payload.event ?? payload.EventType;
      const eventType =
        typeof rawEvent === 'string'
          ? rawEvent
          : (pickField(rawEvent, 'type', 'Type', 'event', 'Event') as
              | string
              | undefined);

      // Handle "messages.upsert" event structure (Baileys/Uazapi common)
      if ((eventType === 'messages.upsert' || eventType === 'messages_upsert') && payload.data) {
        messageData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
      } else if ((eventType === 'messages' || eventType === 'MESSAGE') && payload.message) {
         // Uazapi "messages" event structure
         messageData = typeof payload.message === 'string' ? JSON.parse(payload.message) : payload.message;
         // Map root owner to instanceId only when it is a real instance id (not a phone)
         if (payload.owner && !payload.instanceId && !looksLikePhoneNumber(payload.owner)) {
             (payload as any).instanceId = payload.owner;
         }
      } else if (
        (eventType === 'messages' || eventType === 'MESSAGE') &&
        rawEvent &&
        typeof rawEvent === 'object' &&
        !Array.isArray(rawEvent)
      ) {
        messageData = rawEvent;
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
      } else if (
        rawEvent &&
        typeof rawEvent === 'object' &&
        !Array.isArray(rawEvent) &&
        messageData === payload &&
        pickField(rawEvent, 'Chat', 'Sender', 'sender_pn', 'Text', 'Message', 'Body', 'chatid')
      ) {
        // Fortalabs/Uazapi: message fields live under payload.event as an object
        messageData = rawEvent;
      }

      // Check if it's just a status update (has status but no content usually)
      if (
        messageData.status &&
        !messageData.message &&
        !pickField(messageData, 'content', 'text', 'Text', 'Message', 'Body')
      ) {
          this.logger.log('Ignoring status update event');
          return null;
      }

      // Handle FileDownloaded event (Uazapi Async Media)
      if (payload.type === 'FileDownloadedMessage' && payload.event) {
          const evt = payload.event;
          const from = evt.Chat ? evt.Chat.replace(/@.+/, '') : '';
          const messageId = evt.MessageIDs ? evt.MessageIDs[0] : '';
          const mimetype = evt.MimeType || '';
          const fileUrl = evt.FileURL;
          const timestamp = evt.Timestamp || new Date().toISOString();
          const instanceId = payload.owner || payload.instanceName;

          let type = 'file';
          if (mimetype.startsWith('image')) type = 'image';
          else if (mimetype.startsWith('audio')) type = 'audio';
          else if (mimetype.startsWith('video')) type = 'video';

          return {
              from,
              message: `[${type.charAt(0).toUpperCase() + type.slice(1)}]`,
              messageId,
              timestamp,
              type,
              instanceId,
              media: {
                  type: type as any,
                  url: fileUrl,
                  mimetype: mimetype,
                  fileName: path.basename(fileUrl)
              }
          };
      }

      // Detect if it is a group message
      let isGroup = false;
      const remoteJid =
        messageData.key?.remoteJid ||
        pickField(messageData, 'from', 'chat', 'Chat', 'chatid', 'Sender', 'sender') ||
        '';
      if (typeof remoteJid === 'string' && remoteJid.endsWith('@g.us')) {
          isGroup = true;
      }

      // Detect if it is from me
      const fromMe = Boolean(
        messageData.key?.fromMe ||
          pickField(messageData, 'fromMe', 'FromMe', 'from_me'),
      );

      // Extract 'from' (Baileys + Fortalabs/Uazapi flat payloads)
      const fromRaw =
        pickField(
          messageData,
          'sender_pn',
          'Sender_pn',
          'Sender',
          'sender',
          'Chat',
          'chat',
          'chatid',
          'chatId',
          'phone',
          'from',
        ) || messageData.key?.remoteJid;
      let from = jidToPhone(fromRaw);

      // Extract text content
      let textBody = '';
      const fortalabsText = pickField(
        messageData,
        'Text',
        'Message',
        'Body',
        'messageText',
        'msg',
        'content',
        'text',
        'body',
      );
      if (typeof fortalabsText === 'string') {
        textBody = fortalabsText;
      } else if (
        fortalabsText &&
        typeof fortalabsText === 'object' &&
        !Array.isArray(fortalabsText)
      ) {
        const nested = fortalabsText as Record<string, unknown>;
        textBody =
          firstString(nested.conversation) ||
          firstString(nested.text) ||
          firstString(nested.body) ||
          '';
        if (!textBody && nested.extendedTextMessage && typeof nested.extendedTextMessage === 'object') {
          textBody = firstString(
            (nested.extendedTextMessage as Record<string, unknown>).text,
          );
        }
      }

      if (!textBody && messageData.message?.conversation) {
        textBody = messageData.message.conversation;
      } else if (!textBody && messageData.message?.extendedTextMessage?.text) {
        textBody = messageData.message.extendedTextMessage.text;
      } else if (!textBody && messageData.content?.text) {
         textBody = messageData.content.text;
      } else if (!textBody && messageData.text?.body) {
        textBody = messageData.text.body;
      } else if (!textBody && typeof messageData.text === 'string') {
        textBody = messageData.text;
      } else if (!textBody && messageData.content) {
        textBody = typeof messageData.content === 'string' ? messageData.content : JSON.stringify(messageData.content);
      } else if (!textBody && messageData.body) {
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
      const messageId =
        firstString(messageData.key?.id) ||
        firstString(
          pickField(
            messageData,
            'messageid',
            'messageId',
            'MessageID',
            'MessageIDs',
            'id',
          ),
        ) ||
        '';
      const timestampRaw = pickField(
        messageData,
        'messageTimestamp',
        'timestamp',
        'Timestamp',
      );
      const timestamp = timestampRaw
        ? new Date(Number(timestampRaw)).toISOString()
        : new Date().toISOString();
      
      let type =
        firstString(pickField(messageData, 'type', 'messageType', 'MessageType')) ||
        'text';
      
      // Fix: specific handling for generic 'media' type when specific messageType is available
      if (type === 'media' && messageData.messageType) {
          type = messageData.messageType;
      }

      if (type === 'ExtendedTextMessage') type = 'text';
      if (type === 'ImageMessage') type = 'image';
      if (type === 'VideoMessage') type = 'video';
      if (type === 'AudioMessage') type = 'audio';
      if (type === 'DocumentMessage' || type === 'documentMessage' || type === 'documentWithCaptionMessage') type = 'document'; // or 'file'
      if (type === 'StickerMessage') type = 'sticker';
      if (type === 'conversation') type = 'text';

      const serverUrl =
        normalizeServiceUrl(
          pickField(payload, 'BaseUrl', 'baseUrl', 'serverUrl', 'ServerUrl'),
        ) ||
        normalizeServiceUrl(
          pickField(messageData, 'BaseUrl', 'baseUrl', 'serverUrl', 'ServerUrl'),
        );

      const token = firstString(
        pickField(payload, 'token', 'Token', 'apikey', 'apiKey'),
      ) || firstString(pickField(messageData, 'token', 'Token', 'apikey', 'apiKey'));

      let instanceId =
        firstString(
          pickField(payload, 'instanceId', 'instance_id', 'InstanceId'),
        ) ||
        firstString(
          pickField(messageData, 'instanceId', 'InstanceId', 'instance_id'),
        ) ||
        firstString(
          pickField(payload, 'instanceName', 'InstanceName'),
        ) ||
        firstString(
          pickField(messageData, 'instanceName', 'InstanceName'),
        );

      const ownerCandidate =
        pickField(payload, 'owner', 'Owner') ??
        pickField(messageData, 'owner', 'Owner');
      if (!instanceId && ownerCandidate && !looksLikePhoneNumber(ownerCandidate)) {
        instanceId = firstString(ownerCandidate);
      }
      const contactName =
        firstString(
          pickField(
            messageData,
            'pushName',
            'senderName',
            'notifyName',
            'contactName',
            'ContactName',
            'SenderName',
          ),
        ) ||
        messageData.contact?.name ||
        payload.chat?.contactName;

      // Extract media details
      let media: any = undefined;
      
      // Helper to check if content is media-like
      const isMediaContent = (content: any) => content && typeof content === 'object' && (content.url || content.URL || content.mimetype);

      if (messageData.message) {
        let msg = messageData.message;
        
        // Unwrap common Baileys message wrappers
        if (msg.ephemeralMessage?.message) {
            msg = msg.ephemeralMessage.message;
        } else if (msg.viewOnceMessage?.message) {
            msg = msg.viewOnceMessage.message;
        } else if (msg.documentWithCaptionMessage?.message) {
            msg = msg.documentWithCaptionMessage.message;
        }

        if (msg.imageMessage) {
            type = 'image'; // Enforce type
            media = {
                type: 'image',
                url: msg.imageMessage.url,
                mimetype: msg.imageMessage.mimetype,
                caption: msg.imageMessage.caption,
                base64: msg.imageMessage.base64 || (typeof msg.imageMessage.url === 'string' && msg.imageMessage.url.startsWith('data:') ? msg.imageMessage.url : undefined),
                mediaKey: msg.imageMessage.mediaKey
            };
        } else if (msg.videoMessage) {
             type = 'video';
             media = {
                type: 'video',
                url: msg.videoMessage.url,
                mimetype: msg.videoMessage.mimetype,
                caption: msg.videoMessage.caption,
                base64: msg.videoMessage.base64,
                mediaKey: msg.videoMessage.mediaKey
            };
        } else if (msg.audioMessage) {
             type = 'audio';
             media = {
                type: 'audio',
                url: msg.audioMessage.url,
                mimetype: msg.audioMessage.mimetype,
                base64: msg.audioMessage.base64,
                mediaKey: msg.audioMessage.mediaKey
            };
        } else if (msg.documentMessage) {
             type = 'document';
             media = {
                type: 'document',
                url: msg.documentMessage.url,
                mimetype: msg.documentMessage.mimetype,
                caption: msg.documentMessage.caption,
                fileName: msg.documentMessage.fileName || msg.documentMessage.title || 'document',
                base64: msg.documentMessage.base64,
                mediaKey: msg.documentMessage.mediaKey
            };
        } else if (msg.documentWithCaptionMessage && msg.documentWithCaptionMessage.message && msg.documentWithCaptionMessage.message.documentMessage) {
            // Fallback explicit check for documentWithCaptionMessage
             const docMsg = msg.documentWithCaptionMessage.message.documentMessage;
             type = 'document';
             media = {
                type: 'document',
                url: docMsg.url,
                mimetype: docMsg.mimetype,
                caption: docMsg.caption,
                fileName: docMsg.fileName || docMsg.title || 'document',
                base64: docMsg.base64,
                mediaKey: docMsg.mediaKey
            };
        }
      } else if (messageData.content && isMediaContent(messageData.content)) {
          // Handle Uazapi flat structure where content is the media object
          const content = messageData.content;
          if (type === 'image') {
               media = {
                  type: 'image',
                  url: content.URL || content.url,
                  mimetype: content.mimetype,
                  caption: content.caption || messageData.caption,
                  base64: content.base64,
                  mediaKey: content.mediaKey,
                  fileName: content.fileName
               };
          } else if (type === 'video') {
               media = {
                  type: 'video',
                  url: content.URL || content.url,
                  mimetype: content.mimetype,
                  caption: content.caption || messageData.caption,
                  base64: content.base64,
                  mediaKey: content.mediaKey
               };
          } else if (type === 'audio') {
               media = {
                  type: 'audio',
                  url: content.URL || content.url,
                  mimetype: content.mimetype,
                  base64: content.base64,
                  mediaKey: content.mediaKey
               };
          } else if (type === 'document' || type === 'file') {
               type = 'document'; // normalize
               media = {
                  type: 'document',
                  url: content.URL || content.url,
                  mimetype: content.mimetype,
                  caption: content.caption || messageData.caption,
                  fileName: content.fileName || content.title,
                  base64: content.base64,
                  mediaKey: content.mediaKey
               };
          }
      }

      // Re-evaluate textBody if it looks like JSON or if we found media
      if (media) {
          if (!textBody || textBody.startsWith('{')) {
              textBody = media.caption || `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
          }
      } else {
          // If no media, but textBody is JSON, try to clean it
           if (textBody && textBody.startsWith('{') && messageData.content && typeof messageData.content === 'object') {
               // It was likely stringified content. If it's not media, what is it?
               // Check if it has mimetype
               if (messageData.content.mimetype) {
                   // It IS media, but type might have been wrong or missed
                   const content = messageData.content;
                   const mime = content.mimetype;
                   if (mime.startsWith('image/')) type = 'image';
                   else if (mime.startsWith('video/')) type = 'video';
                   else if (mime.startsWith('audio/')) type = 'audio';
                   else type = 'document';
                   
                   media = {
                      type: type as any,
                      url: content.URL || content.url,
                      mimetype: mime,
                      caption: content.caption,
                      fileName: content.fileName || content.title,
                      base64: content.base64,
                      mediaKey: content.mediaKey
                   };
                   textBody = media.caption || `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
               }
           }
      }

      // If we still don't have textBody, but we have media, ensure we have a placeholder
      if (!textBody && media) {
           textBody = `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
      }

      // Final fallback for "Missing required fields" - if we have an ID and it looks like a message, 
      // but textBody is missing, maybe it's a media message that we failed to parse as media?
      if (from && !textBody) {
          if (type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'sticker') {
              textBody = `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
              // If media is still undefined, try to populate it from messageData directly if possible
              if (!media) {
                  media = {
                      type: type as any,
                      url: messageData.url || messageData.URL,
                      mimetype: messageData.mimetype,
                      base64: messageData.base64,
                      mediaKey: messageData.mediaKey
                  };
              }
          } else if (messageData.mimetype) {
               // It has mimetype but we missed it?
               const mime = messageData.mimetype;
               if (mime.startsWith('image')) { type = 'image'; textBody = '[Imagem]'; }
               else if (mime.startsWith('video')) { type = 'video'; textBody = '[Vídeo]'; }
               else if (mime.startsWith('audio')) { type = 'audio'; textBody = '[Áudio]'; }
               else { type = 'document'; textBody = '[Arquivo]'; }
               
               if (!media) {
                   media = {
                       type: type as any,
                       url: messageData.url || messageData.URL,
                       mimetype: messageData.mimetype,
                       base64: messageData.base64,
                       mediaKey: messageData.mediaKey,
                       fileName: messageData.fileName || messageData.filename
                   };
               }
          }
      }

      this.logger.log(`Extracted data - From: ${from}, Msg: ${textBody}, Type: ${type}, Inst: ${instanceId}`);

      if (!from || !textBody) {
        const hasFortalabsMeta = Boolean(
          pickField(messageData, 'Chat', 'Sender', 'chatid', 'BaseUrl', 'sender_pn'),
        );
        if (hasFortalabsMeta && !textBody) {
          this.logger.log(
            'Ignoring Uazapi/Fortalabs event without message content',
          );
          return null;
        }
        this.logger.warn(`Missing required fields (from or message). From: '${from}', TextBody: '${textBody}'`);
        this.logger.warn(`Dump messageData: ${JSON.stringify(messageData, null, 2)}`);
        return null;
      }

      return {
        from,
        message: textBody,
        messageId,
        timestamp,
        type,
        instanceId: instanceId || undefined,
        serverUrl,
        token: token || undefined,
        contactName,
        isGroup,
        fromMe,
        media,
      };
    } catch (error) {
      this.logger.error('Error parsing Uazapi webhook:', error);
      return null;
    }
  }
}
