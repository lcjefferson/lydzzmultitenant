import { Injectable, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { ConversationsGateway } from '../conversations/conversations.gateway';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ConversationsGateway,
  ) {}

  async createOrganizationWithAdmin(data: any) {
    try {
      // 1. Create Organization
      const slug = data.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const organization = await this.prisma.organization.create({
        data: {
          name: data.orgName,
          slug: slug,
          plan: 'starter',
        },
      });

      // 2. Create Admin User
      const hashedPassword = await bcrypt.hash(data.userPassword, 10);
      const user = await this.prisma.user.create({
        data: {
          email: data.userEmail,
          password: hashedPassword,
          name: data.userName,
          role: 'admin',
          organizationId: organization.id,
        },
      });

      // 3. Ensure Internal Channel exists (optional but good practice)
      await this.ensureInternalChannel(organization.id);

      return {
        organization,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error creating organization/admin: ${error.message}`, error.stack);
      
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (Array.isArray(target)) {
          if (target.includes('slug')) {
            throw new ConflictException(`Organization name generates a slug that already exists. Try a different name.`);
          }
          if (target.includes('email')) {
            throw new ConflictException(`User email already exists: ${data.userEmail}`);
          }
        }
        throw new ConflictException('Data conflict (duplicate entry)');
      }
      
      throw new InternalServerErrorException('Failed to create organization/admin');
    }
  }

  async ensureInternalChannel(organizationId: string) {
    let channel = await this.prisma.channel.findFirst({
      where: { organizationId, type: 'internal' },
    });
    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          type: 'internal',
          name: 'Internal',
          identifier: 'internal',
          status: 'active',
          organizationId,
        },
      });
    }
    return channel;
  }

  async listRooms(organizationId: string) {
    const rooms = await this.prisma.conversation.findMany({
      where: { organizationId, channel: { type: 'internal' } },
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return rooms.map((c) => ({
      id: c.id,
      name: c.contactName,
      lastMessageAt: c.lastMessageAt,
      lastMessage: c.messages?.[0]?.content || '',
    }));
  }

  async createRoom(name: string, organizationId: string) {
    const channel = await this.ensureInternalChannel(organizationId);
    const conversation = await this.prisma.conversation.create({
      data: {
        contactName: name,
        contactIdentifier: `room:${randomUUID()}`,
        channelId: channel.id,
        organizationId,
      },
    });
    return conversation;
  }

  async getRoomMessages(roomId: string, organizationId?: string) {
    if (organizationId) {
      const room = await this.prisma.conversation.findFirst({
        where: { id: roomId, organizationId },
      });
      if (!room) throw new Error('Room not found or access denied');
    }
    return this.prisma.message.findMany({
      where: { conversationId: roomId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
  }

  async sendRoomMessage(roomId: string, userId: string, content: string, organizationId?: string) {
    if (organizationId) {
       const room = await this.prisma.conversation.findFirst({
         where: { id: roomId, organizationId },
       });
       if (!room) throw new Error('Room not found or access denied');
    }
    const message = await this.prisma.message.create({
      data: {
        conversationId: roomId,
        userId,
        senderType: 'user',
        type: 'text',
        content,
      },
    });
    await this.prisma.conversation.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });
    this.gateway.emitNewMessage(roomId, message);
    return message;
  }

  private makeDMIdentifier(userA: string, userB: string) {
    const [x, y] = [userA, userB].sort((a, b) => (a > b ? 1 : -1));
    return `dm:${x}:${y}`;
  }

  async listDMs(currentUserId: string, organizationId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        organizationId,
        channel: { type: 'internal' },
        contactIdentifier: { startsWith: 'dm:' },
        OR: [{ contactIdentifier: { contains: currentUserId } }],
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { lastMessageAt: 'desc' },
    });
    return conversations.map((c) => ({
      id: c.id,
      name: c.contactName,
      lastMessageAt: c.lastMessageAt,
      lastMessage: c.messages?.[0]?.content || '',
    }));
  }

  async listUsers(organizationId?: string) {
    const where: any = { isActive: true };
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async openDM(currentUserId: string, targetUserId: string, organizationId: string) {
    const channel = await this.ensureInternalChannel(organizationId);
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) throw new Error('Target user not found');
    
    // Check if target user is in same organization
    if (targetUser.organizationId !== organizationId) {
        throw new Error('Target user is not in your organization');
    }

    const identifier = this.makeDMIdentifier(currentUserId, targetUserId);
    let conversation = await this.prisma.conversation.findFirst({
      where: { contactIdentifier: identifier, channelId: channel.id },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactName: targetUser.name || 'Usuário',
          contactIdentifier: identifier,
          channelId: channel.id,
          organizationId,
        },
      });
    }
    return conversation;
  }

  async getDMMessages(conversationId: string, organizationId?: string) {
    if (organizationId) {
        const conv = await this.prisma.conversation.findFirst({
            where: { id: conversationId, organizationId }
        });
        if (!conv) throw new Error('Conversation not found');
    }
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
  }

  async sendDMMessage(conversationId: string, userId: string, content: string, organizationId?: string) {
    if (organizationId) {
        const conv = await this.prisma.conversation.findFirst({
            where: { id: conversationId, organizationId }
        });
        if (!conv) throw new Error('Conversation not found');
    }
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        senderType: 'user',
        type: 'text',
        content,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    this.gateway.emitNewMessage(conversationId, message);
    return message;
  }

  async getDMInfo(conversationId: string, currentUserId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { contactIdentifier: true },
    });
    if (!conv) throw new Error('Conversation not found');
    const ident = conv.contactIdentifier || '';
    const parts = ident.startsWith('dm:') ? ident.split(':').slice(1) : [];
    const targetId = parts.find((p) => p !== currentUserId) || parts[0] || '';
    if (!targetId) throw new Error('Target not found');
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new Error('User not found');
    return user;
  }
}
