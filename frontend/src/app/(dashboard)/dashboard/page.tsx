'use client';

import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    MessageSquare,
    Users,
    Bot,
    Plus,
} from 'lucide-react';
import { useDashboardMetrics, useLeadStats } from '@/hooks/api/use-analytics';
import { useAgents } from '@/hooks/api/use-agents';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const { data: metrics } = useDashboardMetrics();
    const { data: leadStats, isLoading: leadStatsLoading } = useLeadStats();
    const { data: agents, isLoading: agentsLoading } = useAgents();

    const stats = [
        {
            title: 'Conversas',
            value: metrics?.totalConversations?.value?.toString() || '0',
            icon: MessageSquare,
            trend: { 
                value: Math.abs(metrics?.totalConversations?.trend || 0), 
                isPositive: (metrics?.totalConversations?.trend || 0) >= 0 
            },
            iconColor: 'text-info',
        },
        {
            title: 'Leads Ativos',
            value: metrics?.activeLeads?.value?.toString() || '0',
            icon: Users,
            trend: { 
                value: Math.abs(metrics?.activeLeads?.trend || 0), 
                isPositive: (metrics?.activeLeads?.trend || 0) >= 0 
            },
            iconColor: 'text-success',
        },
        {
            title: 'Mensagens',
            value: metrics?.totalMessages?.value?.toString() || '0',
            icon: MessageSquare,
            trend: { 
                value: Math.abs(metrics?.totalMessages?.trend || 0), 
                isPositive: (metrics?.totalMessages?.trend || 0) >= 0 
            },
            iconColor: 'text-warning',
        },
        {
            title: 'Agentes',
            value: metrics?.totalAgents?.value?.toString() || '0',
            icon: Bot,
            trend: { 
                value: Math.abs(metrics?.totalAgents?.trend || 0), 
                isPositive: (metrics?.totalAgents?.trend || 0) >= 0 
            },
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
    const newLeads = getLeadCount('Lead Novo');
    const qualifiedLeads = getLeadCount('Qualificado (QUENTE)');
    const convertedLeads = getLeadCount('Contrato fechado');

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

            <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    {stats.map((stat) => (
                        <StatCard key={stat.title} {...stat} />
                    ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Conversas por Canal */}
                    <Card className="bg-white">
                        <CardHeader>
                            <CardTitle className="text-neutral-900">Conversas por Canal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 flex items-center justify-center text-neutral-700">
                                <div className="text-center">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-2 text-neutral-500" />
                                    <p className="text-neutral-900">Total de Conversas: {metrics?.totalConversations?.value || 0}</p>
                                    <p className="text-sm mt-1 text-neutral-600">
                                        Configure canais para ver estatísticas
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Funil de Leads */}
                    <Card className="bg-white">
                        <CardHeader>
                            <CardTitle className="text-neutral-900">Funil de Leads</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {leadStatsLoading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-800">Novos</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-48 h-2 bg-neutral-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-info"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(newLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-12 text-right text-neutral-900">{newLeads}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-800">Qualificados</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-48 h-2 bg-neutral-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-warning"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(qualifiedLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-12 text-right text-neutral-900">{qualifiedLeads}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-800">Convertidos</span>
                                        <div className="flex items-center gap-2 flex-1 justify-end">
                                            <div className="w-24 md:w-48 h-2 bg-neutral-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-success"
                                                    style={{
                                                        width: totalLeads > 0 ? `${(convertedLeads / totalLeads) * 100}%` : '0%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium w-8 md:w-12 text-right text-neutral-900">{convertedLeads}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Agent Performance Table */}
                <Card className="bg-white">
                    <CardHeader>
                        <CardTitle className="text-neutral-900">Agentes Configurados</CardTitle>
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
                                        <tr className="border-b border-neutral-200">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">
                                                Agente
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">
                                                Modelo
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">
                                                Temperatura
                                            </th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agents.map((agent) => (
                                            <tr
                                                key={agent.id}
                                                className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/agents`)}
                                            >
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                                                            <Bot className="h-5 w-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-neutral-900">{agent.name}</div>
                                                            {agent.description && (
                                                                <div className="text-sm text-neutral-600">{agent.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-neutral-900">{agent.model}</td>
                                                <td className="py-4 px-4 text-neutral-900">{agent.temperature}</td>
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
                            <div className="h-32 flex items-center justify-center text-neutral-700">
                                <div className="text-center">
                                    <Bot className="h-12 w-12 mx-auto mb-2 text-neutral-500" />
                                    <p className="text-neutral-900">Nenhum agente configurado</p>
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
