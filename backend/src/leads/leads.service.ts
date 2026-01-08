import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Lead, Prisma } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateLeadDto, organizationId: string): Promise<Lead> {
    return this.prisma.lead.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async findAll(
    filters?: {
      search?: string;
      temperature?: 'hot' | 'warm' | 'cold';
      status?:
        | 'Lead Novo'
        | 'Em Qualificação'
        | 'Qualificado (QUENTE)'
        | 'Reuniões Agendadas'
        | 'Proposta enviada (Follow-up)'
        | 'No Show (Não compareceu) (Follow-up)'
        | 'Contrato fechado';
      source?: string;
    },
    userId?: string,
    role?: string,
    organizationId?: string,
  ): Promise<Lead[]> {
    const where: Prisma.LeadWhereInput = {
      organizationId,
    };
    if (filters?.temperature) where.temperature = filters.temperature;
    if (filters?.status) {
      const status = filters.status;
      const synonyms: Record<string, string[]> = {
        'Lead Novo': ['new'],
        'Em Qualificação': ['lost', 'qualific', 'qualificação'],
        'Qualificado (QUENTE)': ['quente', 'qualificado'],
        'Reuniões Agendadas': ['reuni', 'reunião', 'agendada'],
        'Proposta enviada (Follow-up)': ['proposta'],
        'No Show (Não compareceu) (Follow-up)': ['no show'],
        'Contrato fechado': ['converted', 'fechado', 'contrato'],
      };
      const or: Prisma.LeadWhereInput[] = [{ status }];
      const syns = synonyms[status] || [];
      syns.forEach((s) => {
        or.push({ status: s });
      });
      Object.assign(where, { OR: or });
    }
    if (filters?.source) where.source = filters.source;
    if (filters?.search) {
      const s = filters.search;
      const searchOr: Prisma.LeadWhereInput[] = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { company: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];

      if (where.OR) {
        // If there is already an OR (from status), we need to handle it carefully.
        // Prisma AND/OR logic: AND: [{ OR: status }, { OR: search }]
        const existingOr = where.OR as Prisma.LeadWhereInput[];
        delete where.OR;
        where.AND = [
            { OR: existingOr },
            { OR: searchOr }
        ]
      } else {
         Object.assign(where, { OR: searchOr });
      }
    }

    const r = String(role || '').toLowerCase();
    if (r && r !== 'admin' && r !== 'manager') {
      where.assignedToId = userId;
    }

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: true },
    });
  }

  async findOne(id: string, organizationId?: string): Promise<Lead | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { assignedTo: true },
    });
    
    if (organizationId && lead?.organizationId !== organizationId) {
        return null;
    }
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, userId?: string, organizationId?: string): Promise<Lead> {
    void userId;
    if (organizationId) {
        const lead = await this.prisma.lead.findFirst({ where: { id, organizationId }});
        if (!lead) throw new NotFoundException('Lead not found');
    }
    const updated = await this.prisma.lead.update({ where: { id }, data: dto });
    return updated;
  }

  async delegate(
    id: string,
    assignedToId: string,
    userId?: string,
    organizationId?: string
  ): Promise<Lead> {
    void userId;
    if (organizationId) {
        const lead = await this.prisma.lead.findFirst({ where: { id, organizationId }});
        if (!lead) throw new NotFoundException('Lead not found');
    }
    const updated = await this.prisma.lead.update({
      where: { id },
      data: { assignedToId },
      include: { assignedTo: true },
    });
    return updated;
  }

  async addTag(id: string, tag: string, organizationId?: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (organizationId && lead?.organizationId !== organizationId) {
         throw new NotFoundException('Lead not found');
    }
    
    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const existing = Array.isArray(cf.tags) ? (cf.tags as string[]) : [];
    const next = Array.from(new Set([...existing, tag])).filter(Boolean);
    return this.prisma.lead.update({
      where: { id },
      data: { customFields: { ...(cf || {}), tags: next } },
    });
  }

  async removeTag(id: string, tag: string, organizationId?: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (organizationId && lead?.organizationId !== organizationId) {
         throw new NotFoundException('Lead not found');
    }

    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const existing = Array.isArray(cf.tags) ? (cf.tags as string[]) : [];
    const next = existing.filter((t) => t !== tag);
    return this.prisma.lead.update({
      where: { id },
      data: { customFields: { ...(cf || {}), tags: next } },
    });
  }

  async addComment(
    id: string,
    content: string,
    userId?: string,
    organizationId?: string
  ): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (organizationId && lead?.organizationId !== organizationId) {
         throw new NotFoundException('Lead not found');
    }

    let userName: string | undefined;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        userName = user.name || user.email || undefined;
      }
    }

    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const now = new Date().toISOString();
    const newComment: {
      id: string;
      content: string;
      userId?: string;
      userName?: string;
      createdAt: string;
    } = {
      id: randomUUID(),
      content,
      userId,
      userName,
      createdAt: now,
    };
    const existing: Array<{
      id: string;
      content: string;
      userId?: string;
      userName?: string;
      createdAt: string;
    }> = Array.isArray(cf.comments)
      ? (cf.comments as Array<{
          id: string;
          content: string;
          userId?: string;
          userName?: string;
          createdAt: string;
        }>)
      : [];
    const next: Array<{
      id: string;
      content: string;
      userId?: string;
      userName?: string;
      createdAt: string;
    }> = [...existing, newComment];

    const updatedLead = await this.prisma.lead.update({
      where: { id },
      data: {
        customFields: {
          ...(cf || {}),
          comments: next as unknown as any,
        },
      },
    });

    if (lead?.assignedToId && lead.assignedToId !== userId) {
      await this.notificationsService.create({
        type: 'lead_comment_added',
        entityId: lead.id,
        userId: lead.assignedToId,
        organizationId: lead.organizationId,
        data: {
          leadId: lead.id,
          leadName: lead.name,
          commentContent: content,
          commentId: newComment.id,
          commentUser: userName,
        },
      });
    }

    return updatedLead;
  }

  async getComments(
    id: string,
    organizationId?: string
  ): Promise<
    Array<{ id: string; content: string; userId?: string; userName?: string; createdAt: string }>
  > {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (organizationId && lead?.organizationId !== organizationId) {
         throw new NotFoundException('Lead not found');
    }

    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const comments = Array.isArray(cf.comments)
      ? (cf.comments as Array<{
          id: string;
          content: string;
          userId?: string;
          userName?: string;
          createdAt: string;
        }>)
      : [];

    // Enriched comments with user names
    const userIdsToFetch = new Set<string>();
    comments.forEach((c) => {
      if (c.userId) {
        userIdsToFetch.add(c.userId);
      }
    });

    if (userIdsToFetch.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: Array.from(userIdsToFetch) } },
        select: { id: true, name: true, email: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u.name || u.email]));

      return comments.map((c) => {
        if (c.userId && userMap.has(c.userId)) {
          return { ...c, userName: userMap.get(c.userId) };
        }
        return c;
      });
    }

    return comments;
  }

  async remove(id: string, organizationId?: string): Promise<Lead> {
    if (organizationId) {
        const lead = await this.prisma.lead.findFirst({ where: { id, organizationId }});
        if (!lead) throw new NotFoundException('Lead not found');
    }
    return this.prisma.lead.delete({ where: { id } });
  }
}
