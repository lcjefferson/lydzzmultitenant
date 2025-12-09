import { useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import { api } from '@/lib/api';

export function useSocket() {
    const [isConnected, setIsConnected] = useState(Boolean(socketService.getSocket()?.connected));

    useEffect(() => {
        const token = api.getToken?.() || localStorage.getItem('accessToken');

        if (token) {
            const socket = socketService.connect(token);

            const handleConnect = () => setIsConnected(true);
            const handleDisconnect = () => setIsConnected(false);

            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);

            // initial connection state is derived from socketService; updates via events

            return () => {
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
            };
        }
    }, []);

    return {
        isConnected,
        socket: socketService.getSocket(),
        joinConversation: socketService.joinConversation.bind(socketService),
        leaveConversation: socketService.leaveConversation.bind(socketService),
        onNewMessage: socketService.onNewMessage.bind(socketService),
        offNewMessage: socketService.offNewMessage.bind(socketService),
        onMessageCreated: socketService.onMessageCreated.bind(socketService),
        offMessageCreated: socketService.offMessageCreated.bind(socketService),
    };
}
