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
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('WHATSAPP_API_URL')?.replace(/\/$/, '') ||
      'https://graph.facebook.com/v18.0';
    this.logger.log(`WhatsApp API base URL: ${this.apiUrl}`);
  }

  /**
   * Send a text message via WhatsApp Business API
   */
  async sendMessage(
    to: string,
    message: string,
    phoneNumberId: string,
    accessToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Clean phone number ID (ensure it's just numbers)
      const cleanPhoneId = phoneNumberId.replace(/\D/g, '');

      // Clean phone number (remove +, spaces, dashes)
      let cleanTo = to.replace(/\D/g, '');

      // Heuristic for Brazilian numbers: if 10 or 11 digits, likely missing country code 55
      if (cleanTo.length === 10 || cleanTo.length === 11) {
        cleanTo = '55' + cleanTo;
        this.logger.log(`Added country code 55 to number. Original: ${to}, New: ${cleanTo}`);
      }
      
      const payload: WhatsAppTextMessage = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'text',
        text: {
          body: message,
        },
      };

      this.logger.log(`Sending WhatsApp message to ${cleanTo} using PhoneID ${cleanPhoneId}`);

      const response = await axios.post<unknown>(
        `${this.apiUrl}/${cleanPhoneId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as { messages?: Array<{ id?: string }> };
      this.logger.log(`Message sent to ${cleanTo}: ${data.messages?.[0]?.id}`);
      return { success: true };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = `Status: ${error.response?.status}. Data: ${JSON.stringify(error.response?.data)}`;
        this.logger.error(`Failed to send WhatsApp message. ${errorMessage}`);
      } else {
        const err = error as { message?: string };
        errorMessage = err.message ?? 'unknown';
        this.logger.error(`Failed to send WhatsApp message: ${errorMessage}`);
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a media message via WhatsApp Business API
   */
  async sendMediaMessage(
    to: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption: string | undefined,
    phoneNumberId: string,
    accessToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Clean phone number ID
      const cleanPhoneId = phoneNumberId.replace(/\D/g, '');

      // Clean phone number
      let cleanTo = to.replace(/\D/g, '');

      // Heuristic for Brazilian numbers
      if (cleanTo.length === 10 || cleanTo.length === 11) {
        cleanTo = '55' + cleanTo;
      }

      // Validate media URL
      let validMediaUrl = mediaUrl;
      try {
          // Check if it's a valid URL and encode if necessary
          const urlObj = new URL(mediaUrl);
          validMediaUrl = urlObj.toString();
      } catch (e) {
          // If it's not a valid URL (e.g. local path), try to fix it or throw error
          this.logger.error(`Invalid Media URL provided: ${mediaUrl}`);
          return { success: false, error: `Invalid Media URL: ${mediaUrl}` };
      }

      // Check for WebM and ensure it's treated as audio if possible, or keep as audio
      // WhatsApp Official API supports .ogg (with opus) for audio/voice notes.
      // WebM is often used by browsers for recording.
      let finalMediaType = mediaType;
      const urlObj = new URL(validMediaUrl);
      
      // If it's a webm or ogg audio, we'll keep it as 'audio'
      const isWebm = validMediaUrl.endsWith('.webm') || urlObj.pathname.endsWith('.webm');
      const isOgg = validMediaUrl.endsWith('.ogg') || urlObj.pathname.endsWith('.ogg');
      if (mediaType === 'audio' || isWebm || isOgg) {
          finalMediaType = 'audio';
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: finalMediaType,
      };

      // Map internal types to WhatsApp types
      const mediaObject: any = {
          link: validMediaUrl
      };

      // Ensure HTTPS for non-localhost URLs as required by Meta
      if (mediaObject.link.startsWith('http://') && !mediaObject.link.includes('localhost') && !mediaObject.link.includes('127.0.0.1')) {
          this.logger.log(`Upgrading media URL to HTTPS for Meta compatibility: ${mediaObject.link}`);
          mediaObject.link = mediaObject.link.replace('http://', 'https://');
      }

      // WhatsApp Cloud API specifically requires audio files to NOT have a caption
      if (caption && finalMediaType !== 'audio') {
          mediaObject.caption = caption;
      }

      // Voice Note (PTT) hint for WhatsApp Cloud API
      if (finalMediaType === 'audio') {
          mediaObject.voice = true;
      }

      // If it's a document, set filename
      if (finalMediaType === 'document') {
          mediaObject.filename = urlObj.pathname.split('/').pop() || 'file';
      }

      payload[finalMediaType] = mediaObject;

      this.logger.log(`Sending WhatsApp ${finalMediaType} to ${cleanTo} using PhoneID ${cleanPhoneId}. Payload: ${JSON.stringify(payload)}`);

      if (validMediaUrl.includes('localhost')) {
          this.logger.warn(`Media URL contains 'localhost'. WhatsApp cannot download the file. Set APP_URL to a public URL (e.g. ngrok).`);
      }
      if (finalMediaType === 'audio' && validMediaUrl.toLowerCase().includes('webm')) {
          this.logger.warn(`WhatsApp does not support WebM. Audio should be converted to OGG on upload.`);
      }

      const response = await axios.post<unknown>(
        `${this.apiUrl}/${cleanPhoneId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`WhatsApp API Response: ${JSON.stringify(response.data)}`);
      const data = response.data as { messages?: Array<{ id?: string }> };
      return { success: true };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        this.logger.error(`WhatsApp API Error Details: ${JSON.stringify(errorData)}`);
        return { 
          success: false, 
          error: `WhatsApp API Error: ${error.response?.status} - ${JSON.stringify(errorData)}` 
        };
      }
      this.logger.error(`Error sending WhatsApp media message: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
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

  async getMediaInfo(
    mediaId: string,
    accessToken: string,
  ): Promise<{
    url?: string;
    mime_type?: string;
    sha256?: string;
    file_size?: number;
  } | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = response.data as {
        url?: string;
        mime_type?: string;
        sha256?: string;
        file_size?: number;
      };
      return data;
    } catch (error) {
      const err = error as { message?: string };
      this.logger.error(
        `Failed to get media info: ${err.message ?? 'unknown'}`,
      );
      return null;
    }
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
            image?: { caption?: string; id?: string };
            document?: { filename?: string; id?: string };
            audio?: { id?: string };
            video?: { caption?: string; id?: string };
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
    mediaId?: string;
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
      let mediaId: string | undefined;
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
          mediaId = message.image?.id;
          break;
        case 'video':
          content = message.video?.caption || '[vídeo]';
          mediaId = message.video?.id;
          break;
        case 'document':
          content = message.document?.filename || '[documento]';
          mediaId = message.document?.id;
          break;
        case 'audio':
          content = '[áudio]';
          mediaId = message.audio?.id;
          break;
        default:
          content = '[mensagem]';
      }

      const rawPhoneNumberId = value?.metadata?.phone_number_id;
      return {
        from: message.from ?? '',
        message: content,
        messageId: message.id ?? '',
        timestamp: message.timestamp ?? '',
        type: msgType,
        phoneNumberId: rawPhoneNumberId != null ? String(rawPhoneNumberId) : undefined,
        contactName: value?.contacts?.[0]?.profile?.name,
        mediaId,
      };
    } catch {
      this.logger.error('Failed to parse incoming message');
      return null;
    }
  }
}
