import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Agent, CreateAgentDto, UpdateAgentDto } from '@/types/api';
import { toast } from 'sonner';

export function useAgents() {
    return useQuery({
        queryKey: ['agents'],
        queryFn: () => api.getAgents(),
    });
}

export function useAgent(id: string) {
    return useQuery({
        queryKey: ['agents', id],
        queryFn: () => api.getAgent(id),
        enabled: !!id,
    });
}

export function useCreateAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateAgentDto) => api.createAgent(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            toast.success('Agente criado com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao criar agente');
        },
    });
}

export function useUpdateAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateAgentDto }) =>
            api.updateAgent(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            queryClient.invalidateQueries({ queryKey: ['agents', variables.id] });
            toast.success('Agente atualizado com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao atualizar agente');
        },
    });
}

export function useDeleteAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.deleteAgent(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            toast.success('Agente excluído com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao excluir agente');
        },
    });
}
