import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Webhook } from '@/types/api';

export interface CreateWebhookData {
    name: string;
    url: string;
    events: string[];
    isActive?: boolean;
}

export interface UpdateWebhookData {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
}

export function useWebhooks() {
    return useQuery({
        queryKey: ['webhooks'],
        queryFn: async () => {
            const { data } = await api.api.get<Webhook[]>('/webhooks');
            return data;
        },
    });
}

export function useWebhook(id: string) {
    return useQuery({
        queryKey: ['webhooks', id],
        queryFn: async () => {
            const { data } = await api.api.get<Webhook>(`/webhooks/${id}`);
            return data;
        },
        enabled: !!id,
    });
}

export function useCreateWebhook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateWebhookData) => {
            const { data: webhook } = await api.api.post<Webhook>('/webhooks', data);
            return webhook;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
        },
    });
}

export function useUpdateWebhook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateWebhookData }) => {
            const { data: webhook } = await api.api.patch<Webhook>(`/webhooks/${id}`, data);
            return webhook;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
        },
    });
}

export function useDeleteWebhook() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await api.api.delete(`/webhooks/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
        },
    });
}
