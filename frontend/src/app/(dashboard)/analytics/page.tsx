'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Bot } from 'lucide-react';
import { useDashboardMetrics, useConversationStats, useLeadStats, useContractsReport, useConsultantReport } from '@/hooks/api/use-analytics';

// Componentes de ícones de arquivo coloridos
const FileIconCsv = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 40 40" 
    className={className} 
    fill="none"
  >
    <path d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z" fill="#000080"/>
    <path d="M24 2V10H32" fill="#000050" fillOpacity="0.4"/>
    <text x="20" y="25" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="sans-serif">CSV</text>
  </svg>
);

const FileIconPdf = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 40 40" 
    className={className} 
    fill="none"
  >
    <path d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z" fill="#EF4444"/>
    <path d="M24 2V10H32" fill="#991B1B" fillOpacity="0.4"/>
    <text x="20" y="25" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="sans-serif">PDF</text>
  </svg>
);

const FileIconExcel = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 40 40" 
    className={className} 
    fill="none"
  >
    <path d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z" fill="#16A34A"/>
    <path d="M24 2V10H32" fill="#14532D" fillOpacity="0.4"/>
    <text x="20" y="25" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="sans-serif">EXCEL</text>
  </svg>
);

export default function AnalyticsPage() {
    const { data: metrics } = useDashboardMetrics();
    const { data: convStats } = useConversationStats();
    const { data: leadStats } = useLeadStats();
    const { data: contracts } = useContractsReport();
    const { data: consultants } = useConsultantReport();

    const downloadCSV = (rows: Array<Record<string, unknown>>, filename: string) => {
        const headers = Object.keys(rows[0] || {});
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadExcel = async (rows: Array<Record<string, unknown>>, filename: string) => {
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
        XLSX.writeFile(workbook, filename);
    };

    const downloadPDF = async (title: string, headers: string[], rows: (string | number)[][], filename: string) => {
        const [jsPDF, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
        const doc = new jsPDF.default();
        doc.text(title, 14, 15);
        autoTable.default(doc, {
            head: [headers],
            body: rows,
            startY: 20,
        });
        doc.save(filename);
    };

    const kpis = [
        { label: 'Conversas Totais', value: (metrics?.totalConversations?.value ?? 0).toString(), icon: MessageSquare },
        { label: 'Leads Ativos', value: (metrics?.activeLeads?.value ?? 0).toString(), icon: Users },
        { label: 'Mensagens Totais', value: (metrics?.totalMessages?.value ?? 0).toString(), icon: MessageSquare },
        { label: 'Agentes', value: (metrics?.totalAgents?.value ?? 0).toString(), icon: Bot },
    ];

    return (
        <div>
            <div className="no-print">
                <Header
                    title="Analytics"
                    description="Análise detalhada de performance"
                    actions={
                        <Button variant="secondary">Exportar Relatório</Button>
                    }
                />
            </div>

            <div className="print-only px-6 pt-6">
                <div className="flex items-baseline justify-between gap-6">
                    <h1 className="text-xl font-bold text-foreground">Analytics</h1>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleString('pt-BR')}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Análise detalhada de performance</p>
            </div>

            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    {kpis.map((kpi) => (
                        <Card key={kpi.label} className="p-4 md:p-6 bg-white">
                            <div className="flex items-center justify-between mb-2">
                                <kpi.icon className="h-5 w-5 text-accent-primary" />
                                <span className="text-sm text-success">&nbsp;</span>
                            </div>
                            <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
                            <p className="text-sm text-neutral-800">{kpi.label}</p>
                        </Card>
                    ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-card-foreground">Conversas por Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(convStats?.byStatus ?? []).map((s) => (
                                    <div key={s.status} className="flex items-center justify-between">
                                        <span className="text-sm capitalize text-foreground">{s.status}</span>
                                        <span className="text-sm font-medium text-foreground">{s._count.id}</span>
                                    </div>
                                ))}
                                {(!convStats || (convStats.byStatus?.length ?? 0) === 0) && (
                                    <div className="h-32 flex items-center justify-center text-muted-foreground">Sem dados</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-card-foreground">Leads por Temperatura</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(leadStats?.byTemperature ?? []).map((t) => (
                                    <div key={t.temperature} className="flex items-center justify-between">
                                        <span className="text-sm capitalize text-foreground">{t.temperature}</span>
                                        <span className="text-sm font-medium text-foreground">{t._count.id}</span>
                                    </div>
                                ))}
                                {(!leadStats || (leadStats.byTemperature?.length ?? 0) === 0) && (
                                    <div className="h-32 flex items-center justify-center text-muted-foreground">Sem dados</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Relatórios */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-card-foreground">Contratos Fechados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(!contracts || contracts.length === 0) ? (
                            <div className="h-32 flex items-center justify-center text-muted-foreground">Sem dados</div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar CSV"
                                        aria-label="Exportar CSV"
                                        onClick={() => downloadCSV(
                                        (contracts || []).map(c => ({
                                            id: c.id,
                                            nome: c.name,
                                            consultor: c.assignedTo?.name || '',
                                            email: c.assignedTo?.email || '',
                                            atualizadoEm: new Date(c.updatedAt as unknown as string).toISOString(),
                                        })),
                                        'contratos-fechados.csv'
                                    )}
                                    >
                                        <FileIconCsv className="h-8 w-8" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar Excel"
                                        aria-label="Exportar Excel"
                                        onClick={() => downloadExcel(
                                        (contracts || []).map(c => ({
                                            id: c.id,
                                            nome: c.name,
                                            consultor: c.assignedTo?.name || '',
                                            email: c.assignedTo?.email || '',
                                            atualizadoEm: new Date(c.updatedAt as unknown as string).toISOString(),
                                        })),
                                        'contratos-fechados.xlsx'
                                    )}
                                    >
                                        <FileIconExcel className="h-8 w-8" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar PDF"
                                        aria-label="Exportar PDF"
                                        onClick={() => downloadPDF(
                                            'Contratos Fechados',
                                            ['Lead', 'Consultor', 'Atualizado'],
                                            (contracts || []).map(c => [
                                                c.name,
                                                c.assignedTo?.name || '-',
                                                new Date(c.updatedAt as unknown as string).toLocaleString()
                                            ]),
                                            'contratos-fechados.pdf'
                                        )}
                                    >
                                        <FileIconPdf className="h-8 w-8" />
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Lead</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Consultor</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Atualizado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(contracts || []).map((c) => (
                                                <tr key={c.id} className="border-b border-border">
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.name}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.assignedTo?.name || '-'}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{new Date(c.updatedAt as unknown as string).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-card-foreground">Relatório por Consultor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(!consultants || consultants.length === 0) ? (
                            <div className="h-32 flex items-center justify-center text-muted-foreground">Sem dados</div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar CSV"
                                        aria-label="Exportar CSV"
                                        onClick={() => downloadCSV(
                                        (consultants || []).map(c => ({
                                            consultor: c.name,
                                            email: c.email,
                                            fechados: c.closed,
                                            ativos: c.active,
                                            total: c.total,
                                            conversao: `${c.conversionRate}%`,
                                            reunioes: c.meetings,
                                        })),
                                        'relatorio-consultores.csv'
                                    )}
                                    >
                                        <FileIconCsv className="h-8 w-8" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar Excel"
                                        aria-label="Exportar Excel"
                                        onClick={() => downloadExcel(
                                        (consultants || []).map(c => ({
                                            consultor: c.name,
                                            email: c.email,
                                            fechados: c.closed,
                                            ativos: c.active,
                                            total: c.total,
                                            conversao: `${c.conversionRate}%`,
                                            reunioes: c.meetings,
                                        })),
                                        'relatorio-consultores.xlsx'
                                    )}
                                    >
                                        <FileIconExcel className="h-8 w-8" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 hover:bg-neutral-100"
                                        title="Exportar PDF"
                                        aria-label="Exportar PDF"
                                        onClick={() => downloadPDF(
                                            'Relatório por Consultor',
                                            ['Consultor', 'Fechados', 'Ativos', 'Total', 'Conversão', 'Reuniões Agendadas'],
                                            (consultants || []).map(c => [
                                                c.name,
                                                c.closed,
                                                c.active,
                                                c.total,
                                                `${c.conversionRate}%`,
                                                c.meetings
                                            ]),
                                            'relatorio-consultores.pdf'
                                        )}
                                    >
                                        <FileIconPdf className="h-8 w-8" />
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Consultor</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Fechados</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Ativos</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Total</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Conversão</th>
                                                <th className="text-left py-2 px-4 text-sm text-foreground">Reuniões Agendadas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(consultants || []).map((c) => (
                                                <tr key={c.userId} className="border-b border-border">
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.name}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.closed}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.active}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.total}</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.conversionRate}%</td>
                                                    <td className="py-2 px-4 text-sm text-foreground">{c.meetings}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
