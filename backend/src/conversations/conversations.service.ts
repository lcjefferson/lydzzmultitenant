import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConversationDto, organizationId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: dto.channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Sanitize phone number (remove non-digits)
    // Assuming contactIdentifier is a phone number for whatsapp channels
    let sanitizedIdentifier = dto.contactIdentifier;
    if (channel.type === 'whatsapp') {
       sanitizedIdentifier = sanitizedIdentifier.replace(/\D/g, '');
    }

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        OR: [
            { phone: dto.contactIdentifier },
            { phone: sanitizedIdentifier },
            { phone: `+${sanitizedIdentifier}` }
        ]
      },
      include: { conversation: true }
    });

    // If lead exists and has a conversation, return it
    if (existingLead && existingLead.conversation) {
        return existingLead.conversation;
    }

    // Check if conversation exists by contactIdentifier and channel
    const existingConversation = await this.prisma.conversation.findFirst({
        where: {
            organizationId,
            channelId: dto.channelId,
            contactIdentifier: sanitizedIdentifier
        }
    });

    if (existingConversation) {
        return existingConversation;
    }

    const lead =
      existingLead ||
      (await this.prisma.lead.create({
        data: {
          name: dto.contactName || dto.contactIdentifier,
          phone: sanitizedIdentifier,
          status: 'Lead Novo',
          temperature: 'cold',
          source: channel?.type || 'conversation',
          organizationId,
        },
      }));

    const defaultAgent = await this.prisma.agent.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const contactTag =
      (channel as { provider?: string }).provider === 'whatsapp-official'
        ? 'Oficial'
        : (channel as { provider?: string }).provider === 'uazapi'
          ? 'Uazapi'
          : null;

    return this.prisma.conversation.create({
      data: {
        ...dto,
        contactIdentifier: sanitizedIdentifier,
        organizationId,
        leadId: lead.id,
        agentId: defaultAgent?.id,
        contactTag,
      },
    });
  }

  async findAll(
    userId?: string,
    role?: string,
    _organizationId?: string,
  ) {
    const where: any = {};
    if (_organizationId) {
      Object.assign(where, { organizationId: _organizationId });
    }
    Object.assign(where, { channel: { type: { not: 'internal' } } });
    const r = String(role || '').toLowerCase();
    if (r && r !== 'admin' && r !== 'manager') {
      Object.assign(where, {
        OR: [{ assignedToId: userId }, { lead: { assignedToId: userId } }],
      });
    }

    const list = await this.prisma.conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        lead: true,
        channel: {
          select: {
            type: true,
            provider: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return list.map((c) => {
      const channel = c.channel as { type?: string; provider?: string } | null;
      const contactTag =
        c.contactTag ??
        (channel?.provider === 'whatsapp-official'
          ? 'Oficial'
          : channel?.provider === 'uazapi'
            ? 'Uazapi'
            : null);
      return { ...c, contactTag };
    });
  }

  async findOne(id: string, organizationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        agent: true,
        assignedTo: true,
        lead: true,
        channel: true,
      } as any,
    });

    if (!conversation || conversation.organizationId !== organizationId) {
      return null;
    }

    const channel = conversation.channel as { provider?: string } | null;
    const contactTag =
      conversation.contactTag ??
      (channel?.provider === 'whatsapp-official'
        ? 'Oficial'
        : channel?.provider === 'uazapi'
          ? 'Uazapi'
          : null);

    return { ...conversation, contactTag };
  }

  async update(id: string, dto: UpdateConversationDto, organizationId: string) {
    const conversation = await this.findOne(id, organizationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    const { contactTag: _ignored, ...rest } = dto as UpdateConversationDto & { contactTag?: string | null };
    return this.prisma.conversation.update({
      where: { id },
      data: rest,
    });
  }

  async markAsRead(id: string, organizationId: string) {
    const conversation = await this.findOne(id, organizationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  async markAsUnread(id: string, organizationId: string) {
    const conversation = await this.findOne(id, organizationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: { increment: 1 } },
    });
  }

  async remove(id: string, organizationId: string) {
    const conversation = await this.findOne(id, organizationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }
    return this.prisma.conversation.delete({ where: { id } });
  }
}
