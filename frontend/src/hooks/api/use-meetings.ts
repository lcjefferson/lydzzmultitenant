import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type ApiErrorResp = { response?: { data?: { message?: string } } };

function errorMessage(error: unknown, fallback: string): string {
    const e = error as ApiErrorResp;
    return e.response?.data?.message || fallback;
}

/** Reuniões do intervalo [start, end] (ISO strings). */
export function useMeetings(start?: string, end?: string) {
    return useQuery({
        queryKey: ['meetings', start, end],
        queryFn: () => api.getMeetings({ start, end }),
        staleTime: 30_000,
    });
}

export function useCreateMeeting() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            title: string;
            scheduledAt: string;
            durationMinutes?: number;
            notes?: string;
            leadId?: string;
            contactName?: string;
        }) => api.createMeeting(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            toast.success('Reunião agendada!');
        },
        onError: (error: unknown) => {
            toast.error(errorMessage(error, 'Erro ao agendar reunião'));
        },
    });
}

export function useUpdateMeeting() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: string;
            data: Partial<{
                title: string;
                scheduledAt: string;
                durationMinutes: number;
                notes: string;
                status: string;
                leadId: string;
                contactName: string;
            }>;
        }) => api.updateMeeting(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            toast.success('Reunião atualizada!');
        },
        onError: (error: unknown) => {
            toast.error(errorMessage(error, 'Erro ao atualizar reunião'));
        },
    });
}

export function useDeleteMeeting() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.deleteMeeting(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            toast.success('Reunião excluída!');
        },
        onError: (error: unknown) => {
            toast.error(errorMessage(error, 'Erro ao excluir reunião'));
        },
    });
}
