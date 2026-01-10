import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDashboardMetrics() {
    return useQuery({
        queryKey: ['dashboard', 'metrics'],
        queryFn: () => api.getDashboardMetrics(),
        staleTime: 0,
    });
}

export function useConversationStats() {
    return useQuery({
        queryKey: ['analytics', 'conversations'],
        queryFn: () => api.getConversationStats(),
        staleTime: 0,
    });
}

export function useLeadStats() {
    return useQuery({
        queryKey: ['analytics', 'leads'],
        queryFn: () => api.getLeadStats(),
        staleTime: 0,
    });
}

export function useContractsReport() {
    return useQuery({
        queryKey: ['analytics', 'reports', 'contracts'],
        queryFn: () => api.getContractsReport(),
        staleTime: 0,
    });
}

export function useConsultantReport() {
    return useQuery({
        queryKey: ['analytics', 'reports', 'consultants'],
        queryFn: () => api.getConsultantReport(),
        staleTime: 0,
    });
}
