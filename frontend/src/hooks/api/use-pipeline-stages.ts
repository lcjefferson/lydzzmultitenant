import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

/** Etapas canônicas do pipeline (valores gravados em Lead.status). */
export const PIPELINE_STAGES = [
    'Lead Novo',
    'Em Qualificação',
    'Qualificado (QUENTE)',
    'Reuniões Agendadas',
    'Proposta enviada (Follow-up)',
    'No Show (Não compareceu) (Follow-up)',
    'Contrato fechado',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * Rótulos personalizados das etapas do pipeline (por organização).
 * Retorna `getLabel(stage)` que devolve o rótulo customizado ou o nome canônico.
 */
export function usePipelineStageLabels() {
    const { user } = useAuth();
    const orgId = user?.organizationId;

    const query = useQuery({
        queryKey: ['organization', orgId],
        queryFn: () => api.getOrganization(orgId as string),
        enabled: !!orgId,
        staleTime: 5 * 60 * 1000,
    });

    const labels = (query.data?.pipelineStageLabels || {}) as Record<string, string>;

    const getLabel = (stage: string): string => {
        const custom = labels[stage];
        return typeof custom === 'string' && custom.trim() ? custom : stage;
    };

    return { labels, getLabel, isLoading: query.isLoading };
}

/** Salva os rótulos personalizados das etapas (somente admin). */
export function useUpdatePipelineStageLabels() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const orgId = user?.organizationId;

    return useMutation({
        mutationFn: (labels: Record<string, string>) =>
            api.updateOrganization(orgId as string, { pipelineStageLabels: labels }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
            toast.success('Nome da etapa atualizado!');
        },
        onError: (error: unknown) => {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            toast.error(e.response?.data?.message || 'Erro ao atualizar etapa');
        },
    });
}
