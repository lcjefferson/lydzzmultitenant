import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateMessageDto } from '@/types/api';
import type { Message } from '@/types/api';
import { toast } from 'sonner';

const MESSAGES_STALE_MS = 15_000;

export function useMessages(conversationId: string) {
    return useQuery({
        queryKey: ['messages', conversationId],
        queryFn: () => api.getMessages(conversationId),
        enabled: !!conversationId,
        staleTime: MESSAGES_STALE_MS,
    });
}

export function useCreateMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateMessageDto) => api.createMessage(data),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['messages', variables.conversationId] });
            const previous = queryClient.getQueryData<Message[]>(['messages', variables.conversationId]);
            const optimistic: Message = {
                id: `opt-${Date.now()}`,
                conversationId: variables.conversationId,
                content: variables.content,
                type: (variables.type as Message['type']) || 'text',
                senderType: variables.senderType as Message['senderType'],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            queryClient.setQueryData<Message[]>(['messages', variables.conversationId], (old) =>
                old ? [...old, optimistic] : [optimistic]
            );
            return { previous };
        },
        onSuccess: (data: Message, variables) => {
            queryClient.setQueryData<Message[]>(['messages', variables.conversationId], (old) => {
                if (!old) return old;
                const idx = old.findLastIndex((m) => m.id.startsWith('opt-'));
                if (idx < 0) return [...old, data];
                const next = [...old];
                next[idx] = data;
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
        onError: (error: unknown, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['messages', variables.conversationId], context.previous);
            }
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao enviar mensagem');
        },
    });
}

export function useDeleteMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.deleteMessage(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            toast.success('Mensagem excluída com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao excluir mensagem');
        },
    });
}
