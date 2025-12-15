import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [totalConversations, activeLeads, totalMessages, totalAgents] =
      await Promise.all([
        this.prisma.conversation.count(),
        this.prisma.lead.count({ where: { status: { not: 'lost' } } }),
        this.prisma.message.count(),
        this.prisma.agent.count(),
      ]);

    return {
      totalConversations,
      activeLeads,
      totalMessages,
      totalAgents,
    };
  }

  async getConversationStats() {
    const byStatus = await this.prisma.conversation.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const byChannel = await this.prisma.conversation.groupBy({
      by: ['channelId'],
      _count: { id: true },
    });

    return {
      byStatus,
      byChannel,
    };
  }

  async getLeadStats() {
    const byStatus = await this.prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const byTemperature = await this.prisma.lead.groupBy({
      by: ['temperature'],
      _count: { id: true },
    });

    return {
      byStatus,
      byTemperature,
    };
  }

  async getContractsReport() {
    const closed = await this.prisma.lead.findMany({
      where: { status: 'Contrato fechado' },
      orderBy: { updatedAt: 'desc' },
      include: { assignedTo: true },
    });
    return closed;
  }

  async getConsultantReport() {
    const users = await this.prisma.user.findMany();
    const result = await Promise.all(
      users.map(async (u) => {
        const leads = await this.prisma.lead.findMany({
          where: { assignedToId: u.id },
        });
        const closed = leads.filter(
          (l) => l.status === 'Contrato fechado',
        ).length;
        const active = leads.filter(
          (l) => l.status !== 'Contrato fechado',
        ).length;
        const total = leads.length;
        const conversionRate = total ? Math.round((closed / total) * 100) : 0;
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          closed,
          active,
          total,
          conversionRate,
        };
      }),
    );
    return result;
  }
}
