'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, MessageSquare, Users, Bot } from 'lucide-react';
import { useDashboardMetrics, useConversationStats, useLeadStats } from '@/hooks/api/use-analytics';

export default function AnalyticsPage() {
    const { data: metrics } = useDashboardMetrics();
    const { data: convStats } = useConversationStats();
    const { data: leadStats } = useLeadStats();

    const kpis = [
        { label: 'Conversas Totais', value: (metrics?.totalConversations ?? 0).toString(), icon: MessageSquare },
        { label: 'Leads Ativos', value: (metrics?.activeLeads ?? 0).toString(), icon: Users },
        { label: 'Mensagens Totais', value: (metrics?.totalMessages ?? 0).toString(), icon: MessageSquare },
        { label: 'Agentes', value: (metrics?.totalAgents ?? 0).toString(), icon: Bot },
    ];

    return (
        <div>
            <Header
                title="Analytics"
                description="Análise detalhada de performance"
                actions={
                    <Button variant="secondary">Exportar Relatório</Button>
                }
            />

            <div className="p-6 space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {kpis.map((kpi) => (
                        <Card key={kpi.label} className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <kpi.icon className="h-5 w-5 text-accent-primary" />
                                <span className="text-sm text-success">&nbsp;</span>
                            </div>
                            <p className="text-2xl font-bold">{kpi.value}</p>
                            <p className="text-sm text-text-secondary">{kpi.label}</p>
                        </Card>
                    ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conversas por Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(convStats?.byStatus ?? []).map((s) => (
                                    <div key={s.status} className="flex items-center justify-between">
                                        <span className="text-sm capitalize">{s.status}</span>
                                        <span className="text-sm font-medium">{s._count.id}</span>
                                    </div>
                                ))}
                                {(!convStats || (convStats.byStatus?.length ?? 0) === 0) && (
                                    <div className="h-32 flex items-center justify-center text-text-secondary">Sem dados</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Leads por Temperatura</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(leadStats?.byTemperature ?? []).map((t) => (
                                    <div key={t.temperature} className="flex items-center justify-between">
                                        <span className="text-sm capitalize">{t.temperature}</span>
                                        <span className="text-sm font-medium">{t._count.id}</span>
                                    </div>
                                ))}
                                {(!leadStats || (leadStats.byTemperature?.length ?? 0) === 0) && (
                                    <div className="h-32 flex items-center justify-center text-text-secondary">Sem dados</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Performance por Agente */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performance por Agente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-32 flex items-center justify-center text-text-secondary">Em breve</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
