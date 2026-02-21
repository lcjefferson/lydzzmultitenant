import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateConversationDto, UpdateConversationDto } from '@/types/api';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { socketService } from '@/lib/socket';

export function useConversations() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        socketService.onMessageCreated(handleUpdate);
        socketService.onStatusChange(handleUpdate);

        return () => {
            socketService.offMessageCreated(handleUpdate);
            socketService.offStatusChange(handleUpdate);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['conversations'],
        queryFn: () => api.getConversations(),
        placeholderData: keepPreviousData,
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
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['conversations', id] });
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
