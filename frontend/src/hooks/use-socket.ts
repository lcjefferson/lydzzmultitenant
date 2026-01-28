import { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import { api } from '@/lib/api';

export function useSocket() {
    const [isConnected, setIsConnected] = useState(Boolean(socketService.getSocket()?.connected));

    useEffect(() => {
        try {
            const token = api.getToken?.() || localStorage.getItem('accessToken');

            if (token) {
                const socket = socketService.connect(token);

                const handleConnect = () => setIsConnected(true);
                const handleDisconnect = () => setIsConnected(false);
                const handleError = (err: any) => {
                    console.error('Socket connection error:', err);
                    setIsConnected(false);
                };

                socket.on('connect', handleConnect);
                socket.on('disconnect', handleDisconnect);
                socket.on('connect_error', handleError);

                // initial connection state is derived from socketService; updates via events
                if (socket.connected) {
                    setIsConnected(true);
                }

                return () => {
                    socket.off('connect', handleConnect);
                    socket.off('disconnect', handleDisconnect);
                    socket.off('connect_error', handleError);
                };
            }
        } catch (error) {
            console.error('Error in useSocket effect:', error);
        }
    }, []);

    return {
        isConnected,
        socket: socketService.getSocket(),
        joinConversation: socketService.joinConversation.bind(socketService),
        leaveConversation: socketService.leaveConversation.bind(socketService),
        emitTyping: socketService.emitTyping.bind(socketService),
        onNewMessage: socketService.onNewMessage.bind(socketService),
        offNewMessage: socketService.offNewMessage.bind(socketService),
        onMessageCreated: socketService.onMessageCreated.bind(socketService),
        offMessageCreated: socketService.offMessageCreated.bind(socketService),
        onMessageUpdated: socketService.onMessageUpdated.bind(socketService),
        offMessageUpdated: socketService.offMessageUpdated.bind(socketService),
        onTyping: socketService.onTyping.bind(socketService),
        offTyping: socketService.offTyping.bind(socketService),
        onNotificationCreated: socketService.onNotificationCreated.bind(socketService),
        offNotificationCreated: socketService.offNotificationCreated.bind(socketService),
        onStatusChange: socketService.onStatusChange.bind(socketService),
        offStatusChange: socketService.offStatusChange.bind(socketService),
    };
}
