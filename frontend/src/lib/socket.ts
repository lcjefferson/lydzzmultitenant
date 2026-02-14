import { io, Socket } from 'socket.io-client';
import type { Message } from '@/types/api';

const getWsUrl = () => {
    // In the browser, we should be careful with protocols
    if (typeof window !== 'undefined') {
        const isHttps = window.location.protocol === 'https:';
        
        // If we have an environment variable, use it but respect the protocol
        if (process.env.NEXT_PUBLIC_WS_URL) {
            let url = process.env.NEXT_PUBLIC_WS_URL;
            if (isHttps && url.startsWith('http://')) {
                // If the page is HTTPS, we can't connect to an HTTP WebSocket directly
                // unless we are going through a proxy on the same origin.
                console.log('Socket Service: HTTPS detected, checking if we should use origin instead of', url);
                return window.location.origin;
            }
            return url;
        }
        
        return window.location.origin;
    }
    
    return process.env.NEXT_PUBLIC_WS_URL || 'http://127.0.0.1:3001';
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
            const wsUrl = getWsUrl();
            console.log('Socket Service: Connecting to:', wsUrl);

            this.socket = io(wsUrl, {
                auth: {
                    token: token
                },
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                transports: ['websocket'], // Force websocket to avoid XHR polling errors
                timeout: 20000,
                path: '/socket.io',
            });

            this.socket.on('connect', () => {
                console.log('✅ WebSocket connected');
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ WebSocket disconnected:', reason);
            });

            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error.message);
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    description: (error as any).description,
                    context: (error as any).context,
                    type: (error as any).type,
                    stack: error.stack
                });
            });

            this.socket.on('error', (error) => {
                console.error('WebSocket error details:', error);
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
