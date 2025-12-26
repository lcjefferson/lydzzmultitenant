import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async generateResponse(
    conversationId: string,
    userMessage: string,
  ): Promise<string | null> {
    try {
      // 1. Fetch conversation with organization and agent
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          organization: true,
          agent: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10, // Context window
          },
        },
      });

      if (!conversation || !conversation.organization) {
        this.logger.error(
          `Conversation or Organization not found for ID: ${conversationId}`,
        );
        return null;
      }

      const { organization, agent } = conversation;

      const envKey =
        this.configService.get<string>('OPENAI_API_KEY') ||
        process.env.OPENAI_API_KEY;

      const encryptedKey = agent?.apiKeyEncrypted || organization.openaiApiKey;
      let apiKey: string | undefined;
      if (encryptedKey) {
        try {
          apiKey = this.encryptionService.decrypt(encryptedKey);
        } catch (error) {
          this.logger.error(
            `Failed to decrypt API key for org ${organization.id} or agent ${agent?.id}`,
            error,
          );
          if (
            typeof encryptedKey === 'string' &&
            encryptedKey.startsWith('sk-')
          ) {
            apiKey = encryptedKey;
            this.logger.warn('Using plaintext OpenAI API key from database');
          }
        }
      }

      if (!apiKey) {
        apiKey = envKey || undefined;
      }

      if (!apiKey) {
        this.logger.warn(
          `No OpenAI API key configured for org ${organization.id} or agent ${agent?.id}`,
        );
        return null;
      }

      // 4. Initialize OpenAI Client
      const openai = new OpenAI({ apiKey });

      // 5. Prepare messages for Chat Completion
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      // System Message (from Agent or Default)
      const systemMessage =
        agent?.systemMessage || 'You are a helpful assistant.';
      
      this.logger.debug(`[OpenAIService] Generating response for Conversation ${conversationId}`);
      this.logger.debug(`[OpenAIService] Agent: ${agent?.name || 'None'} (${agent?.id || 'No ID'})`);
      this.logger.debug(`[OpenAIService] System Message Preview: ${systemMessage.substring(0, 200)}...`);

      messages.push({ role: 'system', content: systemMessage });

      // History (reverse chronological to chronological)
      // Prisma returns messages ordered by createdAt DESC (newest first).
      // We reverse it to get chronological order (oldest first).
      const history = conversation.messages.reverse();
      
      // Check if the last message in history is the current user message to avoid duplication
      const lastMessage = history[history.length - 1];
      const isLastMessageCurrentUserMessage = 
        lastMessage && 
        lastMessage.senderType !== 'ai' && 
        lastMessage.content === userMessage;

      history.forEach((msg) => {
        if (msg.content) {
          const role = msg.senderType === 'ai' ? 'assistant' : 'user';
          messages.push({ role, content: msg.content });
        }
      });

      // Only add userMessage if it wasn't already the last message in history
      if (userMessage && !isLastMessageCurrentUserMessage) {
        messages.push({ role: 'user', content: userMessage });
      } else if (isLastMessageCurrentUserMessage) {
         this.logger.debug('[OpenAIService] User message already present in history, skipping explicit append.');
      }

      // Current User Message (already in history if saved before calling this, but let's ensure)
      // If the service is called AFTER saving the user message, it's in history.
      // If called concurrently, we might need to add it.
      // Assumption: MessagesService calls this AFTER saving the user message.

      // 6. Call OpenAI API
      const model = agent?.model || organization.openaiModel || 'gpt-4-turbo';
      const temperature =
        agent?.temperature ?? organization.openaiTemperature ?? 0.7;
      const maxTokens = agent?.maxTokens ?? organization.openaiMaxTokens ?? 500;

      let responseText: string | null = null;
      try {
        const completion = await openai.chat.completions.create({
          messages,
          model,
          temperature,
          max_tokens: maxTokens,
        });
        responseText = completion.choices[0]?.message?.content || '';
      } catch {
        this.logger.warn(
          `Primary model failed: ${model}. Trying fallback model.`,
        );
        try {
          const fallbackModel = 'gpt-4o-mini';
          const completionFallback = await openai.chat.completions.create({
            messages,
            model: fallbackModel,
            temperature,
            max_tokens: Math.min(maxTokens ?? 500, 500),
          });
          responseText = completionFallback.choices[0]?.message?.content || '';
        } catch (err2) {
          this.logger.error('OpenAI completion failed', err2);
          return null;
        }
      }
      return responseText;
    } catch (error) {
      this.logger.error('Error generating OpenAI response', error);
      return null;
    }
  }
}
