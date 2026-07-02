import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api';
import type { CreateMessageDto } from '@/types/api';
import type { Message } from '@/types/api';
import { toast } from 'sonner';

const MESSAGES_STALE_MS = 15_000;
export const MESSAGES_PAGE_SIZE = 50;

type MessagesCache = InfiniteData<Message[], string | undefined>;

/**
 * Páginas: pages[0] = mais recentes (asc), páginas seguintes = mais antigas.
 * Ordem cronológica completa = páginas invertidas e achatadas.
 */
function flattenPages(data: InfiniteData<Message[]> | undefined): Message[] | undefined {
    if (!data) return undefined;
    return [...data.pages].reverse().flat();
}

/** Acrescenta uma mensagem nova ao fim da página mais recente (se houver cache). */
export function appendMessageToCache(
    queryClient: QueryClient,
    conversationId: string,
    message: Message,
) {
    queryClient.setQueryData<MessagesCache>(['messages', conversationId], (old) => {
        if (!old || old.pages.length === 0) return old;
        const exists = message.id && old.pages.some((page) => page.some((m) => m.id === message.id));
        if (exists) return old;
        const pages = [...old.pages];
        pages[0] = [...pages[0], message];
        return { ...old, pages };
    });
}

/** Atualiza uma mensagem existente no cache (ex.: backfill de anexos). */
export function updateMessageInCache(
    queryClient: QueryClient,
    conversationId: string,
    message: Partial<Message> & { id: string },
) {
    queryClient.setQueryData<MessagesCache>(['messages', conversationId], (old) => {
        if (!old) return old;
        let changed = false;
        const pages = old.pages.map((page) => {
            const idx = page.findIndex((m) => m.id === message.id);
            if (idx === -1) return page;
            changed = true;
            const next = [...page];
            next[idx] = {
                ...next[idx],
                ...message,
                createdAt: message.createdAt ?? next[idx].createdAt,
                updatedAt: message.updatedAt ?? new Date(),
            };
            return next;
        });
        return changed ? { ...old, pages } : old;
    });
}

export function useMessages(conversationId: string) {
    const query = useInfiniteQuery({
        queryKey: ['messages', conversationId],
        queryFn: ({ pageParam }) =>
            api.getMessages(conversationId, { limit: MESSAGES_PAGE_SIZE, before: pageParam }),
        initialPageParam: undefined as string | undefined,
        // Página cheia indica que provavelmente há mensagens mais antigas;
        // o cursor é o id da mensagem mais antiga carregada (primeira da última página)
        getNextPageParam: (lastPage) =>
            lastPage.length >= MESSAGES_PAGE_SIZE ? lastPage[0]?.id : undefined,
        enabled: !!conversationId,
        staleTime: MESSAGES_STALE_MS,
    });

    const messages = useMemo(() => flattenPages(query.data), [query.data]);

    return {
        ...query,
        /** Lista achatada em ordem cronológica */
        data: messages,
    };
}

export function useCreateMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateMessageDto) => api.createMessage(data),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['messages', variables.conversationId] });
            const previous = queryClient.getQueryData<MessagesCache>(['messages', variables.conversationId]);
            const optimistic: Message = {
                id: `opt-${Date.now()}`,
                conversationId: variables.conversationId,
                content: variables.content,
                type: (variables.type as Message['type']) || 'text',
                senderType: variables.senderType as Message['senderType'],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            queryClient.setQueryData<MessagesCache>(['messages', variables.conversationId], (old) => {
                if (!old || old.pages.length === 0) {
                    return { pages: [[optimistic]], pageParams: [undefined] };
                }
                const pages = [...old.pages];
                pages[0] = [...pages[0], optimistic];
                return { ...old, pages };
            });
            return { previous };
        },
        onSuccess: (data: Message, variables) => {
            queryClient.setQueryData<MessagesCache>(['messages', variables.conversationId], (old) => {
                if (!old) return old;
                const pages = [...old.pages];
                const latest = [...(pages[0] || [])];
                const idx = latest.findLastIndex((m) => m.id.startsWith('opt-'));
                if (idx < 0) latest.push(data);
                else latest[idx] = data;
                pages[0] = latest;
                return { ...old, pages };
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
