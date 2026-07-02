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

  private resolveApiKey(
    organization: { id: string; openaiApiKey?: string | null },
    agent?: { id?: string; apiKeyEncrypted?: string | null } | null,
  ): string | undefined {
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
    return apiKey || envKey || undefined;
  }

  /**
   * Analisa as últimas mensagens de uma conversa e extrai um agendamento de
   * reunião (data/hora), se houver um combinado claro entre as partes.
   */
  async extractMeetingFromConversation(conversationId: string): Promise<{
    scheduledAt: string;
    title?: string;
  } | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          organization: true,
          agent: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 12,
          },
        },
      });

      if (!conversation || !conversation.organization) return null;

      const apiKey = this.resolveApiKey(
        conversation.organization,
        conversation.agent,
      );
      if (!apiKey) return null;

      const transcript = [...conversation.messages]
        .reverse()
        .filter((m) => m.content)
        .map((m) => {
          const who =
            m.senderType === 'contact'
              ? 'Cliente'
              : m.senderType === 'ai'
                ? 'Assistente'
                : 'Atendente';
          return `${who}: ${m.content}`;
        })
        .join('\n');

      if (!transcript.trim()) return null;

      const now = new Date();
      const nowStr = now.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'full',
        timeStyle: 'short',
      });

      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `Você analisa conversas de atendimento e identifica se uma REUNIÃO foi efetivamente combinada (com data e horário claros e aceitos pelas duas partes). ` +
              `Data/hora atual em São Paulo: ${nowStr}. ` +
              `Responda APENAS com JSON no formato: {"scheduled": boolean, "datetime": "ISO 8601 com offset -03:00", "title": "assunto curto da reunião"}. ` +
              `Se não houver reunião combinada com data E horário definidos, responda {"scheduled": false}. ` +
              `Datas relativas ("amanhã", "sexta-feira") devem ser convertidas usando a data atual informada.`,
          },
          { role: 'user', content: transcript },
        ],
      });

      const raw = completion.choices[0]?.message?.content || '';
      const parsed = JSON.parse(raw) as {
        scheduled?: boolean;
        datetime?: string;
        title?: string;
      };

      if (!parsed.scheduled || !parsed.datetime) return null;

      const when = new Date(parsed.datetime);
      if (isNaN(when.getTime())) return null;
      // Ignora datas no passado (mais de 1h atrás) — provavelmente extração errada
      if (when.getTime() < Date.now() - 60 * 60 * 1000) return null;

      return {
        scheduledAt: when.toISOString(),
        title: parsed.title || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Error extracting meeting from conversation ${conversationId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

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

      const apiKey = this.resolveApiKey(organization, agent);

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
      let systemMessage =
        agent?.systemMessage || 'You are a helpful assistant.';

      // Reinforce system message adherence
      if (agent?.systemMessage) {
        systemMessage = `${agent.systemMessage}\n\nIMPORTANT: You must strictly follow the above persona and instructions in all your responses. Do not break character.`;
      }

      this.logger.log(
        `[OpenAIService] Generating response for Conversation ${conversationId}`,
      );
      this.logger.log(
        `[OpenAIService] Agent: ${agent?.name || 'None'} (${agent?.id || 'No ID'})`,
      );
      this.logger.log(`[OpenAIService] System Message used: ${systemMessage}`);

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
        this.logger.debug(
          '[OpenAIService] User message already present in history, skipping explicit append.',
        );
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

      this.logger.log(
        `[OpenAIService] Using Model: ${model}, Temp: ${temperature}`,
      );
      this.logger.log(
        `[OpenAIService] Messages Payload: ${JSON.stringify(messages)}`,
      );

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
