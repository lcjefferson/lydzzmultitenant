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

  async notifyOrganization(
    organizationId: string,
    excludeUserId: string,
    type: string,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        id: { not: excludeUserId },
        isActive: true, // Assuming we only notify active users
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    // Create notifications in batch (or loop if createMany not supported for relations easily with different userIds)
    // Prisma createMany is supported for simple models, but let's see if we can do it efficiently.
    // Actually, createMany is fine.
    
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        type,
        entityId,
        userId: u.id,
        organizationId,
        data: (data as Prisma.InputJsonValue) || {},
      })),
    });

    // Emit event (broadcasting to everyone, frontend filters or reloads)
    // Since we don't have per-user socket rooms yet, we just emit one event.
    // Ideally we would emit to specific user rooms, but for now this triggers the reload.
    // To be slightly better, we could emit with a target user list if the frontend supported it, 
    // but the frontend currently just listens to 'notificationCreated' and reloads.
    this.gateway.emitNotificationCreated({
      type,
      entityId,
      organizationId,
      // We can send a flag or list of userIds if we want to optimize frontend later
      targetUserIds: users.map(u => u.id)
    });
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
