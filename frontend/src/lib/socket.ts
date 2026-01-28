import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types/api';

const getWsUrl = () => {
    let url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    
    // Fix Mixed Content: Upgrade HTTP to HTTPS (which becomes WSS) if running on HTTPS page
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }
    
    return url;
};

const WS_URL = getWsUrl();

console.log('Socket Service Initializing with URL:', WS_URL);

class SocketService {
    private socket: Socket | null = null;

    connect(token: string): Socket {
        if (this.socket?.connected) {
            return this.socket;
        }

        console.log('Connecting to WebSocket...', WS_URL);

        try {
            this.socket = io(WS_URL, {
                auth: {
                    token,
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                path: '/socket.io/', // Explicitly set path to match Nginx proxy
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket connected');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ WebSocket disconnected:', reason);
            });

            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
            });

            this.socket.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        } catch (error) {
            console.error('Error initializing socket.io:', error);
            // Return a dummy object or throw, but better to not crash
            throw error;
        }

        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket(): Socket | null {
        return this.socket;
    }

    // Conversation events
    joinConversation(conversationId: string): void {
        this.socket?.emit('joinConversation', { conversationId });
    }

    leaveConversation(conversationId: string): void {
        this.socket?.emit('leaveConversation', { conversationId });
    }

    emitTyping(conversationId: string, userId?: string, name?: string): void {
        this.socket?.emit('typing', { conversationId, userId, name });
    }

    // Listen for new messages
    onNewMessage(callback: (message: Message) => void): void {
        this.socket?.on('newMessage', callback);
    }

    offNewMessage(callback: (message: Message) => void): void {
        this.socket?.off('newMessage', callback);
    }

    // Listen for message created
    onMessageCreated(callback: (message: Message) => void): void {
        this.socket?.on('messageCreated', callback);
    }

    offMessageCreated(callback: (message: Message) => void): void {
        this.socket?.off('messageCreated', callback);
    }

    // Listen for message updated
    onMessageUpdated(callback: (message: Message) => void): void {
        this.socket?.on('messageUpdated', callback);
    }

    offMessageUpdated(callback: (message: Message) => void): void {
        this.socket?.off('messageUpdated', callback);
    }

    onTyping(callback: (payload: { conversationId: string; userId?: string; name?: string; at: number }) => void): void {
        this.socket?.on('typing', callback);
    }

    offTyping(callback: (payload: { conversationId: string; userId?: string; name?: string; at: number }) => void): void {
        this.socket?.off('typing', callback);
    }

    onNotificationCreated(callback: (notification: any) => void): void {
        this.socket?.on('notificationCreated', callback);
    }

    offNotificationCreated(callback: (notification: any) => void): void {
        this.socket?.off('notificationCreated', callback);
    }

    onStatusChange(callback: (payload: { conversationId: string; status: string }) => void): void {
        this.socket?.on('statusChange', callback);
    }

    offStatusChange(callback: (payload: { conversationId: string; status: string }) => void): void {
        this.socket?.off('statusChange', callback);
    }
}

export const socketService = new SocketService();
