import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateLeadDto, UpdateLeadDto } from '@/types/api';
import { toast } from 'sonner';

export function useLeads(filters?: {
    search?: string;
    temperature?: 'hot' | 'warm' | 'cold';
    status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
    source?: string;
}) {
    return useQuery({
        queryKey: ['leads', filters],
        queryFn: () => api.getLeads(filters),
    });
}

export function useLead(id: string) {
    return useQuery({
        queryKey: ['leads', id],
        queryFn: () => api.getLead(id),
        enabled: !!id,
    });
}

export function useCreateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateLeadDto) => api.createLead(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['analytics', 'leads'] });
            toast.success('Lead criado com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao criar lead');
        },
    });
}

export function useUpdateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateLeadDto }) =>
            api.updateLead(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['analytics', 'leads'] });
            toast.success('Lead atualizado com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao atualizar lead');
        },
    });
}

export function useDeleteLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.deleteLead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['analytics', 'leads'] });
            toast.success('Lead excluído com sucesso!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao excluir lead');
        },
    });
}

export function useLeadTags(id: string) {
    return useQuery({
        queryKey: ['leads', id, 'tags'],
        queryFn: async () => {
            const lead = await api.getLead(id);
            const cf = (lead.customFields || {}) as Record<string, unknown>;
            const tags = Array.isArray(cf.tags) ? (cf.tags as string[]) : [];
            return tags;
        },
        enabled: !!id,
    });
}

export function useAddLeadTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, tag }: { id: string; tag: string }) => api.addLeadTag(id, tag),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id, 'tags'] });
        },
    });
}

export function useRemoveLeadTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, tag }: { id: string; tag: string }) => api.removeLeadTag(id, tag),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id, 'tags'] });
        },
    });
}

export function useLeadComments(id: string) {
    return useQuery({
        queryKey: ['leads', id, 'comments'],
        queryFn: () => api.getLeadComments(id),
        enabled: !!id,
    });
}

export function useAddLeadComment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, content }: { id: string; content: string }) => api.addLeadComment(id, content),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id, 'comments'] });
            toast.success('Comentário adicionado');
        },
        onError: () => toast.error('Erro ao adicionar comentário'),
    });
}
