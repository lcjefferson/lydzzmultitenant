import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Lead, Prisma } from '@prisma/client';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const organization = await this.prisma.organization.findFirst();
    if (!organization) {
      throw new Error('No organization found to link lead');
    }

    return this.prisma.lead.create({
      data: {
        ...dto,
        organizationId: organization.id,
      },
    });
  }

  async findAll(filters?: {
    search?: string;
    temperature?: 'hot' | 'warm' | 'cold';
    status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
    source?: string;
  }): Promise<Lead[]> {
    const where: Record<string, unknown> = {};
    if (filters?.temperature) where.temperature = filters.temperature;
    if (filters?.status) where.status = filters.status;
    if (filters?.source) where.source = filters.source;
    if (filters?.search) {
      const s = filters.search;
      Object.assign(where, {
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
          { company: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Lead | null> {
    return this.prisma.lead.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: dto,
    });
  }

  async addTag(id: string, tag: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const existing = Array.isArray(cf.tags) ? (cf.tags as string[]) : [];
    const next = Array.from(new Set([...existing, tag])).filter(Boolean);
    return this.prisma.lead.update({
      where: { id },
      data: { customFields: { ...(cf || {}), tags: next } },
    });
  }

  async removeTag(id: string, tag: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
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
  ): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const now = new Date().toISOString();
    const newComment: { id: string; content: string; userId?: string; createdAt: string } = {
      id: crypto.randomUUID(),
      content,
      userId,
      createdAt: now,
    };
    const existing: Array<{ id: string; content: string; userId?: string; createdAt: string }> = Array.isArray(
      (cf as Record<string, unknown>).comments,
    )
      ? (((cf as Record<string, unknown>).comments as unknown) as Array<{
          id: string;
          content: string;
          userId?: string;
          createdAt: string;
        }>)
      : [];
    const next: Array<{ id: string; content: string; userId?: string; createdAt: string }> = [
      ...existing,
      newComment,
    ];
    return this.prisma.lead.update({
      where: { id },
      data: { customFields: { ...(cf || {}), comments: next as unknown as Prisma.InputJsonValue } },
    });
  }

  async getComments(
    id: string,
  ): Promise<
    Array<{ id: string; content: string; userId?: string; createdAt: string }>
  > {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    const cf = (lead?.customFields as Record<string, unknown>) || {};
    const existing = Array.isArray(cf.comments)
      ? (cf.comments as Array<{
          id: string;
          content: string;
          userId?: string;
          createdAt: string;
        }>)
      : [];
    return existing;
  }

  async remove(id: string): Promise<Lead> {
    return this.prisma.lead.delete({ where: { id } });
  }
}
