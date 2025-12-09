'use client';

import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    MessageSquare,
    Users,
    TrendingUp,
    Bot,
    Plus,
} from 'lucide-react';
import { useDashboardMetrics, useLeadStats } from '@/hooks/api/use-analytics';
import { useAgents } from '@/hooks/api/use-agents';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
    const { data: leadStats, isLoading: leadStatsLoading } = useLeadStats();
    const { data: agents, isLoading: agentsLoading } = useAgents();

    const stats = [
        {
            title: 'Conversas',
            value: metrics?.totalConversations?.toString() || '0',
            icon: MessageSquare,
            trend: { value: 12, isPositive: true },
            iconColor: 'text-info',
        },
        {
            title: 'Leads Ativos',
            value: metrics?.activeLeads?.toString() || '0',
            icon: Users,
            trend: { value: 8, isPositive: true },
            iconColor: 'text-success',
        },
        {
            title: 'Mensagens',
            value: metrics?.totalMessages?.toString() || '0',
            icon: MessageSquare,
            trend: { value: 5, isPositive: true },
            iconColor: 'text-warning',
        },
        {
            title: 'Agentes',
            value: metrics?.totalAgents?.toString() || '0',
            icon: Bot,
            trend: { value: 3, isPositive: true },
            iconColor: 'text-accent-primary',
        },
    ];

    // Calculate lead funnel data
    const leadFunnel = leadStats?.byStatus || [];
    const getLeadCount = (status: string) => {
        const item = leadFunnel.find((s) => s.status === status);
        return item?._count?.id || 0;
    };

    const totalLeads = leadFunnel.reduce((sum, item) => sum + (item._count?.id || 0), 0);
    const newLeads = getLeadCount('new');
    const qualifiedLeads = getLeadCount('qualified');
    const convertedLeads = getLeadCount('converted');

    return (
        <div>
            <Header
                title="Dashboard"
                description="Visão geral do seu atendimento"
                actions={
                    <Button onClick={() => router.push('/agents')}>
                        <Plus className="h-4 w-4" />
                        Novo Agente
                    </Button>
                }
            />

            <div className="p-6 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat) => (
                        <StatCard key={stat.title} {...stat} />
                    ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Conversas por Canal */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversas por Canal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 flex items-center justify-center text-text-secondary">
                                <div className="text-center">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Total de Conversas: {metrics?.totalConversations || 0}</p>
                                    <p className="text-sm mt-1 text-gray-500">
                                        Configure canais para ver estatísticas
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Funil de Leads */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Funil de Leads</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {leadStatsLoading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Novos</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-48 h-2 bg-surface rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-info"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(newLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-12 text-right">{newLeads}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Qualificados</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-48 h-2 bg-surface rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-warning"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(qualifiedLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-12 text-right">{qualifiedLeads}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Convertidos</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-48 h-2 bg-surface rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-success"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(convertedLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-12 text-right">{convertedLeads}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Agent Performance Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Agentes Configurados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {agentsLoading ? (
                            <div className="h-32 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                            </div>
                        ) : agents && agents.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                                                Agente
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                                                Modelo
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                                                Temperatura
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agents.map((agent) => (
                                            <tr
                                                key={agent.id}
                                                className="border-b border-border hover:bg-surface transition-colors cursor-pointer"
                                                onClick={() => router.push(`/agents`)}
                                            >
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                                                            <Bot className="h-5 w-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">{agent.name}</div>
                                                            {agent.description && (
                                                                <div className="text-sm text-gray-500">{agent.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">{agent.model}</td>
                                                <td className="py-4 px-4">{agent.temperature}</td>
                                                <td className="py-4 px-4">
                                                    <Badge variant={agent.isActive ? 'success' : 'default'}>
                                                        {agent.isActive ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-32 flex items-center justify-center text-text-secondary">
                                <div className="text-center">
                                    <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum agente configurado</p>
                                    <Button
                                        className="mt-4"
                                        size="sm"
                                        onClick={() => router.push('/agents')}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Criar Primeiro Agente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
