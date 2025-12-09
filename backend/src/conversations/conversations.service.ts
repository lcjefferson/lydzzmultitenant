import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { Conversation } from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConversationDto): Promise<Conversation> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new Error('No organization found');
    }

    const existingLead = await this.prisma.lead.findFirst({
      where: {
        organizationId: organization.id,
        phone: dto.contactIdentifier,
      },
    });

    const lead =
      existingLead ||
      (await this.prisma.lead.create({
        data: {
          name: dto.contactName || dto.contactIdentifier,
          phone: dto.contactIdentifier,
          status: 'new',
          temperature: 'cold',
          source: 'conversation',
          organizationId: organization.id,
        },
      }));

    const defaultAgent = await this.prisma.agent.findFirst({
      where: { organizationId: organization.id, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    return this.prisma.conversation.create({
      data: {
        ...dto,
        organizationId: organization.id,
        leadId: lead.id,
        agentId: defaultAgent?.id,
      },
    });
  }

  async findAll(): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        lead: true,
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        agent: true,
        assignedTo: true,
        lead: true,
      },
    });
  }

  async update(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<Conversation> {
    return this.prisma.conversation.delete({ where: { id } });
  }
}
