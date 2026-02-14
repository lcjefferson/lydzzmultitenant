import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(client: Socket, payload: { conversationId: string }) {
    const { conversationId } = payload;
    void client.join(`conversation_${conversationId}`);
    console.log(`Client ${client.id} joined conversation ${conversationId}`);
    return { event: 'joinedConversation', data: conversationId };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(client: Socket, payload: { conversationId: string }) {
    const { conversationId } = payload;
    void client.leave(`conversation_${conversationId}`);
    console.log(`Client ${client.id} left conversation ${conversationId}`);
    return { event: 'leftConversation', data: conversationId };
  }

  @SubscribeMessage('typing')
  handleTyping(
    client: Socket,
    payload: { conversationId: string; userId?: string; name?: string },
  ) {
    const { conversationId, userId, name } = payload;
    this.server
      .to(`conversation_${conversationId}`)
      .emit('typing', { conversationId, userId, name, at: Date.now() });
    return { event: 'typing', data: conversationId };
  }

  emitNewMessage(
    conversationId: string,
    message: import('@prisma/client').Message,
  ) {
    this.server
      .to(`conversation_${conversationId}`)
      .emit('newMessage', message);
    this.server
      .to(`conversation_${conversationId}`)
      .emit('messageCreated', message);
    this.server.emit('messageCreated', message);
  }

  emitMessageUpdated(
    conversationId: string,
    message: import('@prisma/client').Message,
  ) {
    this.server
      .to(`conversation_${conversationId}`)
      .emit('messageUpdated', message);
    this.server.emit('messageUpdated', message);
  }

  emitStatusChange(conversationId: string, status: string) {
    this.server
      .to(`conversation_${conversationId}`)
      .emit('statusChange', { conversationId, status });
  }

  emitNotificationCreated(notification: any) {
    this.server.emit('notificationCreated', notification);
  }
}
