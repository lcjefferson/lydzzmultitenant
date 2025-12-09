import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from '@prisma/client';

import { ConversationsGateway } from '../conversations/conversations.gateway';

import { OpenAIService } from '../common/openai.service';
import { WhatsAppService } from '../integrations/whatsapp.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
    private readonly openAIService: OpenAIService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async create(dto: CreateMessageDto): Promise<Message> {
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
              status: 'new',
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
      await this.qualifyLeadForConversation(dto.conversationId, dto.content);
    }

    if (dto.senderType === 'user') {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
        include: { channel: true },
      });

      if (conversation && conversation.channel.type === 'whatsapp') {
        await this.sendWhatsAppMessage(conversation, dto.content);
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
        config: import('@prisma/client').Prisma.JsonValue;
        accessToken?: string | null;
      };
    },
    message: string,
  ) {
    try {
      const channel = conversation.channel;
      const config =
        typeof channel.config === 'object' && channel.config !== null
          ? (channel.config as {
              phoneNumberId?: string;
              accessToken?: string;
            })
          : null;

      const accessToken =
        config?.accessToken || channel.accessToken || undefined;

      if (!config?.phoneNumberId || !accessToken) {
        console.error('WhatsApp channel missing configuration');
        return;
      }

      await this.whatsAppService.sendMessage(
        conversation.contactIdentifier,
        message,
        config.phoneNumberId,
        accessToken,
      );
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
    }
  }

  async findAll(conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async remove(id: string): Promise<Message> {
    return this.prisma.message.delete({ where: { id } });
  }
}
