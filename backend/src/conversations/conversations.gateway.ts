import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { Message } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/auth.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
})
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConversationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Socket ${client.id} rejected: missing token`);
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret:
          this.configService.get<string>('JWT_SECRET') || 'default-secret-key',
      });

      if (!payload.organizationId) {
        this.logger.warn(`Socket ${client.id} rejected: missing organizationId`);
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;
      client.data.organizationId = payload.organizationId;
      await client.join(`org:${payload.organizationId}`);
      this.logger.log(
        `Client ${client.id} connected (user=${payload.sub}, org=${payload.organizationId})`,
      );
    } catch (error) {
      this.logger.warn(
        `Socket ${client.id} rejected: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    client: Socket,
    payload: { conversationId: string },
  ) {
    const organizationId = client.data.organizationId as string | undefined;
    if (!organizationId) {
      return { event: 'error', data: 'unauthorized' };
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        organizationId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return { event: 'error', data: 'forbidden' };
    }

    await client.join(`conversation_${payload.conversationId}`);
    this.logger.log(
      `Client ${client.id} joined conversation ${payload.conversationId}`,
    );
    return { event: 'joinedConversation', data: payload.conversationId };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    client: Socket,
    payload: { conversationId: string },
  ) {
    void client.leave(`conversation_${payload.conversationId}`);
    return { event: 'leftConversation', data: payload.conversationId };
  }

  @SubscribeMessage('typing')
  handleTyping(
    client: Socket,
    payload: { conversationId: string; userId?: string; name?: string },
  ) {
    const organizationId = client.data.organizationId as string | undefined;
    if (!organizationId) {
      return { event: 'error', data: 'unauthorized' };
    }

    const { conversationId, userId, name } = payload;
    this.server
      .to(`conversation_${conversationId}`)
      .emit('typing', { conversationId, userId, name, at: Date.now() });
    return { event: 'typing', data: conversationId };
  }

  emitNewMessage(
    conversationId: string,
    organizationId: string,
    message: Message,
  ) {
    const payload = { ...message, organizationId };
    this.server
      .to(`conversation_${conversationId}`)
      .emit('newMessage', payload);
    this.server
      .to(`org:${organizationId}`)
      .emit('messageCreated', payload);
  }

  emitMessageUpdated(
    conversationId: string,
    organizationId: string,
    message: Message,
  ) {
    const payload = { ...message, organizationId };
    this.server
      .to(`conversation_${conversationId}`)
      .emit('messageUpdated', payload);
    this.server
      .to(`org:${organizationId}`)
      .emit('messageUpdated', payload);
  }

  emitStatusChange(
    conversationId: string,
    organizationId: string,
    status: string,
  ) {
    this.server
      .to(`conversation_${conversationId}`)
      .emit('statusChange', { conversationId, status, organizationId });
  }

  emitNotificationCreated(notification: {
    organizationId: string;
    [key: string]: unknown;
  }) {
    this.server
      .to(`org:${notification.organizationId}`)
      .emit('notificationCreated', notification);
  }
}
