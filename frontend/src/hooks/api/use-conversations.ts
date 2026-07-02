import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Conversation, CreateConversationDto, UpdateConversationDto, Message } from '@/types/api';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { socketService } from '@/lib/socket';

type SocketMessage = Partial<Message> & { conversationId?: string; conversation?: { id?: string } };

export function useConversations() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Atualiza a lista em cache com o payload do socket, evitando um
        // refetch completo de GET /conversations a cada mensagem da organização.
        const handleMessage = (message: SocketMessage) => {
            const convId = message?.conversationId ?? message?.conversation?.id;
            if (!convId) return;

            let foundInCache = false;
            queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
                if (!old) return old;
                const idx = old.findIndex((c) => c.id === convId);
                if (idx === -1) return old;
                foundInCache = true;

                const conv = old[idx];
                // O hook é montado em mais de um lugar (sidebar + página);
                // se a última mensagem já é esta, não aplica de novo.
                if (message.id && conv.messages?.[0]?.id === message.id) return old;

                const updated: Conversation = {
                    ...conv,
                    lastMessageAt: (message.createdAt as Date) ?? new Date(),
                    unreadCount:
                        message.senderType === 'contact'
                            ? (conv.unreadCount || 0) + 1
                            : conv.unreadCount,
                    messages: [message as Message],
                };
                const next = [...old];
                next.splice(idx, 1);
                return [updated, ...next];
            });

            // Conversa nova (ainda não está na lista): busca a lista atualizada
            if (!foundInCache) {
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }
        };

        const handleStatusChange = () => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        socketService.onMessageCreated(handleMessage);
        socketService.onStatusChange(handleStatusChange);

        return () => {
            socketService.offMessageCreated(handleMessage);
            socketService.offStatusChange(handleStatusChange);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['conversations'],
        queryFn: () => api.getConversations(),
        placeholderData: keepPreviousData,
        staleTime: 20_000,
    });
}

export function useConversation(id: string) {
    return useQuery({
        queryKey: ['conversations', id],
        queryFn: () => api.getConversation(id),
        enabled: !!id,
    });
}

export function useCreateConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateConversationDto) => api.createConversation(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            toast.success('Conversa criada com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao criar conversa');
        },
    });
}

export function useUpdateConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateConversationDto }) =>
            api.updateConversation(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['conversations', variables.id] });
            toast.success('Conversa atualizada com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao atualizar conversa');
        },
    });
}

export function useMarkConversationAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.markConversationAsRead(id),
        onSuccess: (_, id) => {
            // Patch local em vez de refetch completo: só zera o contador
            queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
                old?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
            );
        },
        onError: (error: unknown) => {
            console.error('Error marking conversation as read:', error);
        },
    });
}

export function useMarkConversationAsUnread() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.markConversationAsUnread(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['conversations', id] });
            toast.success('Conversa marcada como não lida');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao marcar como não lida');
        },
    });
}

export function useDeleteConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.deleteConversation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            toast.success('Conversa excluída com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao excluir conversa');
        },
    });
}
