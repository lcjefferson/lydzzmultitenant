import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Notification } from '@prisma/client';
import { ConversationsGateway } from '../conversations/conversations.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
  ) {}

  async create(data: {
    type: string;
    entityId: string;
    userId: string;
    organizationId: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        type: data.type,
        entityId: data.entityId,
        userId: data.userId,
        organizationId: data.organizationId,
        data: (data.data as Prisma.InputJsonValue) || {},
      },
    });
    this.gateway.emitNotificationCreated(notification);
    return notification;
  }

  async listForUser(userId: string, organizationId?: string): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, userId: string, organizationId?: string): Promise<Notification> {
    const where: Prisma.NotificationWhereInput = {
      id,
      userId,
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const notification = await this.prisma.notification.findFirst({ where });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
