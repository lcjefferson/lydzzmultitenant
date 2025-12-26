import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(
    userId?: string,
    role?: string,
    organizationId?: string,
  ) {
    const whereConversation: Prisma.ConversationWhereInput = {
      organizationId,
      channel: { type: { not: 'internal' } },
    };
    const whereLead: Prisma.LeadWhereInput = {
      organizationId,
      status: { not: 'lost' },
    };

    const r = String(role || '').toLowerCase();
    if (r && r !== 'admin' && r !== 'manager') {
      Object.assign(whereConversation, {
        OR: [{ assignedToId: userId }, { lead: { assignedToId: userId } }],
      });
      Object.assign(whereLead, { assignedToId: userId });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Helper to get count for a period
    const getCount = async (model: any, where: any, start: Date, end: Date) => {
      return model.count({
        where: {
          ...where,
          createdAt: {
            gte: start,
            lt: end,
          },
        },
      });
    };

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // 1. Conversations
    const currentConversations = await getCount(
      this.prisma.conversation,
      whereConversation,
      thirtyDaysAgo,
      now,
    );
    const previousConversations = await getCount(
      this.prisma.conversation,
      whereConversation,
      sixtyDaysAgo,
      thirtyDaysAgo,
    );
    const totalConversations = await this.prisma.conversation.count({
      where: whereConversation,
    });

    // 2. Leads (Active/New)
    // For "Active Leads" metric, we usually show total active. For trend, we show "New leads created" trend.
    const currentNewLeads = await getCount(
      this.prisma.lead,
      whereLead,
      thirtyDaysAgo,
      now,
    );
    const previousNewLeads = await getCount(
      this.prisma.lead,
      whereLead,
      sixtyDaysAgo,
      thirtyDaysAgo,
    );
    const activeLeads = await this.prisma.lead.count({ where: whereLead });

    // 3. Messages
    const whereMessage: Prisma.MessageWhereInput = {};
    if (organizationId) {
      whereMessage.conversation = { organizationId };
    }

    const currentMessages = await getCount(
      this.prisma.message,
      whereMessage,
      thirtyDaysAgo,
      now,
    );
    const previousMessages = await getCount(
      this.prisma.message,
      whereMessage,
      sixtyDaysAgo,
      thirtyDaysAgo,
    );
    const totalMessages = await this.prisma.message.count({
      where: whereMessage,
    });

    // 4. Agents
    const currentAgents = await getCount(
      this.prisma.agent,
      { organizationId },
      thirtyDaysAgo,
      now,
    );
    const previousAgents = await getCount(
      this.prisma.agent,
      { organizationId },
      sixtyDaysAgo,
      thirtyDaysAgo,
    );
    const totalAgents = await this.prisma.agent.count({
      where: { organizationId },
    });

    return {
      totalConversations: {
        value: totalConversations,
        trend: calculateTrend(currentConversations, previousConversations),
      },
      activeLeads: {
        value: activeLeads,
        trend: calculateTrend(currentNewLeads, previousNewLeads),
      },
      totalMessages: {
        value: totalMessages,
        trend: calculateTrend(currentMessages, previousMessages),
      },
      totalAgents: {
        value: totalAgents,
        trend: calculateTrend(currentAgents, previousAgents),
      },
    };
  }

  async getConversationStats(
    userId?: string,
    role?: string,
    organizationId?: string,
  ) {
    const where: Prisma.ConversationWhereInput = {
      organizationId,
      channel: { type: { not: 'internal' } },
    };

    const r = String(role || '').toLowerCase();
    if (r && r !== 'admin' && r !== 'manager') {
      Object.assign(where, {
        OR: [{ assignedToId: userId }, { lead: { assignedToId: userId } }],
      });
    }

    const byStatus = await this.prisma.conversation.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byChannel = await this.prisma.conversation.groupBy({
      by: ['channelId'],
      where,
      _count: { id: true },
    });

    return {
      byStatus,
      byChannel,
    };
  }

  async getLeadStats(organizationId?: string) {
    const where: Prisma.LeadWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const byStatus = await this.prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byTemperature = await this.prisma.lead.groupBy({
      by: ['temperature'],
      where,
      _count: { id: true },
    });

    return {
      byStatus,
      byTemperature,
    };
  }

  async getContractsReport(organizationId?: string) {
    const where: Prisma.LeadWhereInput = { status: 'Contrato fechado' };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const closed = await this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { assignedTo: true },
    });
    return closed;
  }

  async getConsultantReport(organizationId?: string) {
    const whereUser: Prisma.UserWhereInput = {};
    if (organizationId) {
      whereUser.organizationId = organizationId;
    }

    const users = await this.prisma.user.findMany({ where: whereUser });
    const result = await Promise.all(
      users.map(async (u) => {
        const whereLead: Prisma.LeadWhereInput = { assignedToId: u.id };
        if (organizationId) {
          whereLead.organizationId = organizationId;
        }

        const leads = await this.prisma.lead.findMany({
          where: whereLead,
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
