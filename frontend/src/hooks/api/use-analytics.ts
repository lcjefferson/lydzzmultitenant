import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardMetrics, ConversationStats, LeadStats } from '@/types/api';
import { toast } from 'sonner';

export function useDashboardMetrics() {
    return useQuery({
        queryKey: ['dashboard', 'metrics'],
        queryFn: () => api.getDashboardMetrics(),
        staleTime: 30000, // 30 seconds
    });
}

export function useConversationStats() {
    return useQuery({
        queryKey: ['analytics', 'conversations'],
        queryFn: () => api.getConversationStats(),
        staleTime: 60000, // 1 minute
    });
}

export function useLeadStats() {
    return useQuery({
        queryKey: ['analytics', 'leads'],
        queryFn: () => api.getLeadStats(),
        staleTime: 60000, // 1 minute
    });
}
