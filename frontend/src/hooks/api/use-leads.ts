import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateLeadDto, UpdateLeadDto } from '@/types/api';
import { toast } from 'sonner';

export function useLeads(filters?: {
    search?: string;
    temperature?: 'hot' | 'warm' | 'cold';
    status?: 'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado';
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

export function useImportLeads() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateLeadDto[]) => api.importLeads(data),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['analytics', 'leads'] });
            toast.success(`${data.count} leads importados com sucesso!`);
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao importar leads');
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
            queryClient.invalidateQueries({ queryKey: ['analytics', 'reports', 'consultants'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
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

export function useDelegateLead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, assignedToId }: { id: string; assignedToId: string }) => api.delegateLead(id, assignedToId),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: ['leads'] });
            const prev = queryClient.getQueriesData({ queryKey: ['leads'] });
            prev.forEach(([key, data]) => {
                if (!data) return;
                if (Array.isArray(data)) {
                    const next = data.map((l) => (l.id === vars.id ? { ...l, assignedToId: vars.assignedToId } : l));
                    queryClient.setQueryData(key, next);
                } else if (typeof data === 'object' && (data as { id?: string }).id === vars.id) {
                    const next = { ...(data as Record<string, unknown>), assignedToId: vars.assignedToId };
                    queryClient.setQueryData(key, next);
                }
            });
            return { prev };
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads', vars.id] });
            toast.success('Lead delegado com sucesso');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao delegar lead');
        },
    });
}
