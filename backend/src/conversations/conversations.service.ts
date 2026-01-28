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

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        phone: dto.contactIdentifier,
      },
    });

    const lead =
      existingLead ||
      (await this.prisma.lead.create({
        data: {
          name: dto.contactName || dto.contactIdentifier,
          phone: dto.contactIdentifier,
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

    return this.prisma.conversation.create({
      data: {
        ...dto,
        organizationId,
        leadId: lead.id,
        agentId: defaultAgent?.id,
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

    return this.prisma.conversation.findMany({
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
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
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
    return conversation;
  }

  async update(id: string, dto: UpdateConversationDto, organizationId: string) {
    const conversation = await this.findOne(id, organizationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: dto,
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
