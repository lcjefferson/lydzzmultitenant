import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface WhatsAppTextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl = 'https://graph.facebook.com/v18.0';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a text message via WhatsApp Business API
   */
  async sendMessage(
    to: string,
    message: string,
    phoneNumberId: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      const payload: WhatsAppTextMessage = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await axios.post<unknown>(
        `${this.apiUrl}/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as { messages?: Array<{ id?: string }> };
      this.logger.log(`Message sent to ${to}: ${data.messages?.[0]?.id}`);
      return true;
    } catch (error) {
      const err = error as { message?: string };
      this.logger.error(
        `Failed to send WhatsApp message: ${err.message ?? 'unknown'}`,
      );
      return false;
    }
  }

  /**
   * Verify webhook challenge from Meta
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string,
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }
    this.logger.warn('Webhook verification failed');
    return null;
  }

  /**
   * Parse incoming WhatsApp webhook payload
   */
  parseIncomingMessage(payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            id?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
            image?: { caption?: string };
            document?: { filename?: string };
            audio?: { id?: string };
            video?: { caption?: string };
            interactive?: {
              type?: string;
              button_reply?: { id?: string; title?: string };
              list_reply?: {
                id?: string;
                title?: string;
                description?: string;
              };
            };
          }>;
          metadata?: { phone_number_id?: string };
          contacts?: Array<{
            profile?: { name?: string };
          }>;
        };
      }>;
    }>;
  }): {
    from: string;
    message: string;
    messageId: string;
    timestamp: string;
    type: string;
    phoneNumberId?: string;
    contactName?: string;
  } | null {
    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) {
        this.logger.warn('No message found in webhook payload');
        return null;
      }

      const msgType = message.type || (message.text ? 'text' : 'unknown');
      let content = '';
      switch (msgType) {
        case 'text':
          content = message.text?.body || '';
          break;
        case 'interactive':
          content =
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            '';
          break;
        case 'image':
          content = message.image?.caption || '[imagem]';
          break;
        case 'video':
          content = message.video?.caption || '[vídeo]';
          break;
        case 'document':
          content = message.document?.filename || '[documento]';
          break;
        case 'audio':
          content = '[áudio]';
          break;
        default:
          content = '[mensagem]';
      }

      return {
        from: message.from ?? '',
        message: content,
        messageId: message.id ?? '',
        timestamp: message.timestamp ?? '',
        type: msgType,
        phoneNumberId: value?.metadata?.phone_number_id,
        contactName: value?.contacts?.[0]?.profile?.name,
      };
    } catch {
      this.logger.error('Failed to parse incoming message');
      return null;
    }
  }
}
