'use client';

import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Search,
    Mail,
    Phone,
    Building,
    TrendingUp,
    X,
    Upload,
} from 'lucide-react';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useLeadComments, useAddLeadComment, useDelegateLead, useImportLeads } from '@/hooks/api/use-leads';
import { useChannels } from '@/hooks/api/use-channels';
import { useAuth } from '@/contexts/auth-context';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLeadStats } from '@/hooks/api/use-analytics';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Componentes de ícones de arquivo coloridos
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

export default function LeadsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [tempFilter, setTempFilter] = useState<'hot' | 'warm' | 'cold' | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado' | undefined>(undefined);
    const [selectedLead, setSelectedLead] = useState<string | null>(searchParams.get('lead'));
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        source: '',
        interest: '',
    });

    const { data: leads, isLoading: leadsLoading } = useLeads({
        search: searchQuery || undefined,
        temperature: tempFilter,
        status: statusFilter,
    });
    const { data: leadStats } = useLeadStats();
    const { data: channels } = useChannels();
    const createLead = useCreateLead();
    const deleteLead = useDeleteLead();
    const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { mutate: importLeads, isPending: isImporting } = useImportLeads();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            const mappedData = data.map((row: any) => ({
                name: row['Nome'] || row['Name'] || row['name'] || row['nome'],
                email: row['Email'] || row['email'] || row['E-mail'],
                phone: row['Telefone'] || row['Phone'] || row['phone'] || row['Celular'],
                company: row['Empresa'] || row['Company'] || row['company'],
                position: row['Cargo'] || row['Position'] || row['position'],
            })).filter((item: any) => item.name || item.email || item.phone);

            if (mappedData.length > 0) {
                importLeads(mappedData as any);
            } else {
                toast.error('Nenhum dado válido encontrado no arquivo.');
            }
            
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };


    useEffect(() => {
        (async () => {
            try {
                const list = await api.getConsultants();
                setUsers(list.map((u) => ({ id: u.id, name: u.name })));
            } catch {}
        })();
    }, []);

    const getAssignedName = (l: unknown) => {
        const a = l as { assignedTo?: { name?: string }; assignedToId?: string };
        const relNameRaw = (a?.assignedTo?.name || '').trim();
        if (relNameRaw) {
            const rel = relNameRaw.toLowerCase();
            if (rel === 'consultant user') return '';
            return relNameRaw;
        }
        const id = (a?.assignedToId || '').trim();
        if (!id) return '';
        const match = users.find((u) => u.id === id);
        const nameRaw = (match?.name || '').trim();
        if (nameRaw && nameRaw.toLowerCase() === 'consultant user') return '';
        return nameRaw;
    };

    // Calculate stats from backend data
    const getLeadCount = (temperature: string) => {
        const item = leadStats?.byTemperature?.find((t) => t.temperature === temperature);
        return item?._count?.id || 0;
    };

    const getStatusCount = (status: string) => {
        const item = leadStats?.byStatus?.find((s) => s.status === status);
        return item?._count?.id || 0;
    };

    const stats = [
        { label: 'Quentes', value: getLeadCount('hot'), color: 'text-error' },
        { label: 'Mornos', value: getLeadCount('warm'), color: 'text-warning' },
        { label: 'Frios', value: getLeadCount('cold'), color: 'text-info' },
        { label: 'Convertidos', value: getStatusCount('converted'), color: 'text-success' },
    ];

    const getTemperatureBadge = (temp: 'hot' | 'warm' | 'cold') => {
        const variants = {
            hot: 'hot' as const,
            warm: 'warm' as const,
            cold: 'cold' as const,
        };
        const labels = {
            hot: 'QUENTE',
            warm: 'MORNO',
            cold: 'FRIO',
        };
        return <Badge variant={variants[temp]} className="w-24 justify-center">{labels[temp]}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
            'Lead Novo': 'default',
            'Em Qualificação': 'warning',
            'Qualificado (QUENTE)': 'success',
            'Reuniões Agendadas': 'warning',
            'Proposta enviada (Follow-up)': 'warning',
            'No Show (Não compareceu) (Follow-up)': 'error',
            'Contrato fechado': 'success',
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createLead.mutateAsync(formData);
            setShowCreateModal(false);
            setFormData({
                name: '',
                email: '',
                phone: '',
                company: '',
                position: '',
                source: '',
                interest: '',
            });
        } catch (error) {
            console.error('Error creating lead:', error);
        }
    };

    const handleDeleteLead = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este lead?')) {
            try {
                await deleteLead.mutateAsync(id);
                setSelectedLead(null);
            } catch (error) {
                console.error('Error deleting lead:', error);
            }
        }
    };

    const filteredLeads = leads || [];

    const [isExporting, setIsExporting] = useState(false);

    const getFormattedDateTime = () => {
        const date = new Date();
        const formattedDate = date.toISOString().split('T')[0];
        const formattedTime = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `${formattedDate}_${formattedTime}`;
    };

    const handleExportExcel = async () => {
        if (!filteredLeads.length) {
            toast.error('Não há leads para exportar.');
            return;
        }

        try {
            setIsExporting(true);
            const rows = filteredLeads.map((lead) => ({
                Nome: lead.name,
                Email: lead.email || '',
                Telefone: lead.phone || '',
                Empresa: lead.company || '',
                Cargo: lead.position || '',
                Temperatura: lead.temperature || '',
                Status: lead.status || '',
                Delegado: getAssignedName(lead) || '',
                Origem: lead.source || '',
                Interesse: lead.interest || '',
                'Data de Criação': new Date(lead.createdAt).toLocaleString('pt-BR'),
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
            const filename = `leads_${getFormattedDateTime()}.xlsx`;
            XLSX.writeFile(workbook, filename);
            toast.success('Exportação Excel concluída!');
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            toast.error('Erro ao exportar Excel.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!filteredLeads.length) {
            toast.error('Não há leads para exportar.');
            return;
        }

        try {
            setIsExporting(true);
            const doc = new jsPDF();
            const filename = `leads_${getFormattedDateTime()}.pdf`;

            doc.text(`Relatório de Leads - ${new Date().toLocaleString('pt-BR')}`, 14, 15);
            
            const tableHeaders = ['Nome', 'Email', 'Empresa', 'Temp.', 'Status', 'Delegado'];
            const tableRows = filteredLeads.map((lead) => [
                lead.name,
                lead.email || '-',
                lead.company || '-',
                lead.temperature || '-',
                lead.status || '-',
                getAssignedName(lead) || '-'
            ]);

            autoTable(doc, {
                head: [tableHeaders],
                body: tableRows,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
            });

            doc.save(filename);
            toast.success('Exportação PDF concluída!');
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            toast.error('Erro ao exportar PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    

    return (
        <div>
            <Header
                title="Leads"
                description="Gerencie e qualifique seus leads"
                actions={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        Novo Lead
                    </Button>
                }
            />

            <div className="p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {stats.map((stat) => (
                        <Card key={stat.label} className="p-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-secondary">{stat.label}</p>
                                    <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
                                </div>
                                <TrendingUp className={`h-8 w-8 ${stat.color}`} />
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Actions Group */}
                <div className="space-y-3">
                    {/* Export Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-4">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 hover:bg-surface"
                            title="Importar Excel"
                            aria-label="Importar Excel"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                        >
                            <Upload className="h-6 w-6 text-neutral-600" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 hover:bg-surface"
                            title="Exportar Excel"
                            aria-label="Exportar Excel"
                            onClick={handleExportExcel}
                            disabled={isExporting}
                        >
                            <FileIconExcel className="h-8 w-8" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 hover:bg-surface"
                            title="Exportar PDF"
                            aria-label="Exportar PDF"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                        >
                            <FileIconPdf className="h-8 w-8" />
                        </Button>
                    </div>

                    {/* Filters and Search */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, email, empresa..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10 w-full"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant={!tempFilter ? 'primary' : 'secondary'}
                                onClick={() => setTempFilter(undefined)}
                            >
                                Todos
                            </Button>
                            <Button
                                size="sm"
                                variant={tempFilter === 'hot' ? 'primary' : 'secondary'}
                                onClick={() => setTempFilter('hot')}
                            >
                                Quentes
                            </Button>
                            <Button
                                size="sm"
                                variant={tempFilter === 'warm' ? 'primary' : 'secondary'}
                                onClick={() => setTempFilter('warm')}
                            >
                                Mornos
                            </Button>
                            <Button
                                size="sm"
                                variant={tempFilter === 'cold' ? 'primary' : 'secondary'}
                                onClick={() => setTempFilter('cold')}
                            >
                                Frios
                            </Button>
                        </div>
                    </div>
                </div>

                

                {/* Leads Table */}
                <Card>
                    <div className="overflow-x-auto">
                        {leadsLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto"></div>
                                <p className="mt-4 text-gray-500">Carregando leads...</p>
                            </div>
                        ) : filteredLeads.length > 0 ? (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Lead
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Temperatura
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Score
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Status
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Delegado
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Origem
                                        </th>
                                        <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            className="border-b border-border hover:bg-surface transition-colors cursor-pointer"
                                            onClick={() => setSelectedLead(lead.id)}
                                        >
                                            <td className="py-4 px-6">
                                                <div className="space-y-1">
                                                    <p className="font-medium text-white">{lead.name}</p>
                                                    {lead.email && (
                                                        <div className="flex items-center gap-3 text-sm text-white">
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {lead.email}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(() => {
                                                        const name = getAssignedName(lead);
                                                        return name ? (
                                                            <p className="text-xs text-white">Delegado: {name}</p>
                                                        ) : null;
                                                    })()}
                                                    {(lead.company || lead.position) && (
                                                        <p className="text-sm text-white">
                                                            {lead.company} {lead.position && `• ${lead.position}`}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {getTemperatureBadge(lead.temperature)}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-surface rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-primary"
                                                            style={{ width: `${lead.score}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-white">{lead.score}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {getStatusBadge(lead.status)}
                                            </td>
                                            <td className="py-4 px-6">
                                                {(() => {
                                                    const name = getAssignedName(lead);
                                                    return name ? <span className="text-sm text-white">{name}</span> : <span className="text-sm text-gray-300">-</span>;
                                                })()}
                                            </td>
                                            <td className="py-4 px-6">
                                                {lead.source && <Badge variant="default">{lead.source}</Badge>}
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteLead(lead.id);
                                                    }}
                                                    className="p-2 hover:bg-surface rounded-md transition-colors text-error"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <p>Nenhum lead encontrado</p>
                                <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                                    <Plus className="h-4 w-4" />
                                    Criar Primeiro Lead
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Create Lead Modal */}
                {showCreateModal && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <Card
                            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20"
                            onClick={(e) => e.stopPropagation()}
                            style={{ "--foreground": "222 47% 11%" } as React.CSSProperties}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-neutral-900">Novo Lead</h2>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="text-neutral-500 hover:text-neutral-800"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateLead} className="space-y-4">
                                    <Input
                                        label="Nome"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                        <Input
                                            label="Telefone"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Empresa"
                                            value={formData.company}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                        <Input
                                            label="Cargo"
                                            value={formData.position}
                                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Origem"
                                            value={formData.source}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                        <Input
                                            label="Interesse"
                                            value={formData.interest}
                                            onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                                            className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <Button type="submit" className="flex-1" isLoading={createLead.isPending}>
                                            Criar Lead
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setShowCreateModal(false)}
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Lead Details Modal */}
                {selectedLead && (() => {
                    const lead = leads?.find((l) => l.id === selectedLead);
                    if (!lead) return null;

                    return (
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                            onClick={() => setSelectedLead(null)}
                        >
                            <Card
                                className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20"
                                onClick={(e) => e.stopPropagation()}
                                style={{ "--foreground": "222 47% 11%" } as React.CSSProperties}
                            >
                                <div className="p-6 space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-neutral-900">{lead.name}</h2>
                                            {(lead.company || lead.position) && (
                                                <p className="text-neutral-600 mt-1">
                                                    {lead.company} {lead.position && `• ${lead.position}`}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setSelectedLead(null)}
                                            className="p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                                        >
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {getTemperatureBadge(lead.temperature)}
                                        {getStatusBadge(lead.status)}
                                        {(() => {
                                            const name = getAssignedName(lead);
                                            return name ? (
                                                <span className="text-sm text-neutral-700">Delegado: {name}</span>
                                            ) : null;
                                        })()}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {lead.email && (
                                            <div>
                                                <p className="text-sm text-text-tertiary mb-1">Email</p>
                                                <p className="text-sm flex items-center gap-2">
                                                    <Mail className="h-4 w-4" />
                                                    {lead.email}
                                                </p>
                                            </div>
                                        )}
                                        {lead.phone && (
                                            <div>
                                                <p className="text-sm text-text-tertiary mb-1">Telefone</p>
                                                <p className="text-sm flex items-center gap-2">
                                                    <Phone className="h-4 w-4" />
                                                    {lead.phone}
                                                </p>
                                            </div>
                                        )}
                                        {lead.company && (
                                            <div>
                                                <p className="text-sm text-text-tertiary mb-1">Empresa</p>
                                                <p className="text-sm flex items-center gap-2">
                                                    <Building className="h-4 w-4" />
                                                    {lead.company}
                                                </p>
                                            </div>
                                        )}
                                        {lead.source && (
                                            <div>
                                                <p className="text-sm text-text-tertiary mb-1">Origem</p>
                                                <Badge variant="default">{lead.source}</Badge>
                                            </div>
                                        )}
                                    </div>

                                    {lead.interest && (
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-2">Interesse</p>
                                            <p className="text-sm">{lead.interest}</p>
                                        </div>
                                    )}

                                    {(() => {
                                        const cf = (lead.customFields || {}) as Record<string, unknown>;
                                        return (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                    {typeof cf.dealValue === 'number' && (
                                                        <div>
                                                            <p className="text-sm text-text-tertiary mb-1">Valor da Venda</p>
                                                            <p className="text-sm">R$ {cf.dealValue as number}</p>
                                                        </div>
                                                    )}
                                                    {typeof cf.outcomeReason === 'string' && (
                                                        <div>
                                                            <p className="text-sm text-text-tertiary mb-1">Detalhes</p>
                                                            <p className="text-sm">{cf.outcomeReason as string}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <Comments leadId={lead.id} />
                                            </div>
                                        );
                                    })()}

                                <div className="flex flex-wrap gap-2 justify-end">
                                        <Button
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    console.log('Iniciando conversa para lead:', lead.name, 'Telefone original:', lead.phone);
                                                    let contact = lead.phone;
                                                    // Sanitize phone if it exists
                                                    if (contact) {
                                                        contact = contact.replace(/\D/g, '');
                                                    }

                                                    // Fallback to other contact info if phone is missing
                                                    if (!contact) {
                                                        contact = lead.email || lead.name;
                                                    }

                                                    if (!contact) {
                                                        toast.error('Lead sem contato (telefone) definido.');
                                                        return;
                                                    }

                                                    // Find default channel (WhatsApp preferred)
                                                    const channelList = channels || [];
                                                    const defaultChannel = channelList.find(c => c.type === 'whatsapp' && c.status === 'CONNECTED') || channelList[0];
                                                    
                                                    if (!defaultChannel) {
                                                        toast.error('Nenhum canal de comunicação conectado.');
                                                        return;
                                                    }

                                                    const conversation = await api.createConversation({
                                                        channelId: defaultChannel.id,
                                                        contactIdentifier: contact,
                                                        contactName: lead.name,
                                                    });

                                                    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
                                                    router.push(`/conversations?conversationId=${conversation.id}`);
                                                    setSelectedLead(null);
                                                } catch (error) {
                                                    console.error('Error starting conversation:', error);
                                                    toast.error('Erro ao iniciar conversa.');
                                                }
                                            }}
                                        >
                                            Falar via Omnichannel
                                        </Button>
                                        <OutcomeButton lead={lead} onClose={() => setSelectedLead(null)} />
                                        <EditLeadButton lead={lead} />
                                        <DelegateLeadButton lead={lead} currentUserRole={String(user?.role || '').toLowerCase()} onDelegated={() => setSelectedLead(null)} />
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDeleteLead(lead.id)}
                                            isLoading={deleteLead.isPending}
                                        >
                                            Excluir
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => setSelectedLead(null)}>
                                            Fechar
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

function OutcomeButton({ lead, onClose }: { lead: import('@/types/api').Lead; onClose: () => void }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<'Contrato fechado' | 'Em Qualificação'>('Contrato fechado');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const updateLead = useUpdateLead();

    const handleSave = async () => {
        const customFields = {
            ...(lead.customFields || {}),
            dealValue: value ? Number(value) : undefined,
            outcomeReason: reason || undefined,
        };
        try {
            await updateLead.mutateAsync({ id: lead.id, data: { status, customFields } });
            setOpen(false);
            onClose();
        } catch {}
    };

    return (
        <>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                Definir Resultado
            </Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-md m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900">Resultado do Lead</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" variant={status === 'Contrato fechado' ? 'primary' : 'secondary'} onClick={() => setStatus('Contrato fechado')}>Venda Fechada</Button>
                                <Button size="sm" variant={status === 'Em Qualificação' ? 'primary' : 'secondary'} onClick={() => setStatus('Em Qualificação')}>Sem Interesse</Button>
                            </div>
                            <Input label="Valor da Venda (R$)" value={value} onChange={(e) => setValue(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            <Input label="Detalhes" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                                <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}


function Comments({ leadId }: { leadId: string }) {
    const [content, setContent] = useState('');
    const commentsQuery = useLeadComments(leadId);
    const addComment = useAddLeadComment();
    const inputRef = useRef<HTMLInputElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const comments = commentsQuery.data || [];

    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [comments.length]);

    const handleAdd = async () => {
        const text = content.trim();
        if (!text) return;

        // Optimistic UI update: clear and focus immediately
        setContent('');
        // Ensure focus is kept immediately
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 0);

        try {
            await addComment.mutateAsync({ id: leadId, content: text });
        } catch (error) {
            console.error('Error adding comment:', error);
            // Restore content on error
            setContent(text);
        } finally {
            // Ensure focus is restored after any potential re-renders or data refetching
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Avoid submitting when using IME (e.g. for accents or Asian languages)
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-text-tertiary">Comentários</p>
            <div className="space-y-2">
                {comments.length === 0 ? (
                    <p className="text-sm text-text-secondary">Sem comentários</p>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="p-3 rounded-md bg-neutral-100 border border-neutral-200">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-neutral-700">
                                    {c.userName || 'Usuário'}
                                </span>
                                <span className="text-xs text-text-tertiary">
                                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
                                </span>
                            </div>
                            <p className="text-sm text-neutral-800 whitespace-pre-wrap">{c.content}</p>
                        </div>
                    ))
                )}
                <div ref={commentsEndRef} />
            </div>
            <div className="flex gap-2 items-end">
                <Input 
                    ref={inputRef}
                    label="Adicionar comentário" 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    onKeyDown={handleKeyDown}
                    className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" 
                />
                <Button size="sm" className="h-12 px-4 text-sm" onClick={handleAdd} isLoading={addComment.isPending}>Comentar</Button>
            </div>
        </div>
    );
}

function EditLeadButton({ lead }: { lead: import('@/types/api').Lead }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(lead.name || '');
    const [email, setEmail] = useState(lead.email || '');
    const [phone, setPhone] = useState(lead.phone || '');
    const [company, setCompany] = useState(lead.company || '');
    const [position, setPosition] = useState(lead.position || '');
    const [source, setSource] = useState(lead.source || '');
    const [interest, setInterest] = useState(lead.interest || '');
    const [temperature, setTemperature] = useState<"hot"|"warm"|"cold">(lead.temperature);
    const [status, setStatus] = useState<'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado'>(lead.status);
    
    const updateLead = useUpdateLead();

    const handleSave = async () => {
        try {
            await updateLead.mutateAsync({
                id: lead.id,
                data: {
                    name,
                    email: email || undefined,
                    phone: phone || undefined,
                    company: company || undefined,
                    position: position || undefined,
                    source: source || undefined,
                    interest: interest || undefined,
                    temperature,
                    status,
                },
            });
            setOpen(false);
        } catch {}
    };

    return (
        <>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Editar</Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900">Editar Lead</h3>
                            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                                <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                                <Input label="Cargo" value={position} onChange={(e) => setPosition(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Origem" value={source} onChange={(e) => setSource(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                                <Input label="Interesse" value={interest} onChange={(e) => setInterest(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Temperatura</p>
                                    <select
                                        className="w-full border border-neutral-300 rounded-md p-2 text-sm bg-white text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20 focus:outline-none focus:ring-1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(e.target.value as 'hot' | 'warm' | 'cold')}
                                    >
                                        <option value="hot">Quente</option>
                                        <option value="warm">Morno</option>
                                        <option value="cold">Frio</option>
                                    </select>
                                </div>
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Status</p>
                                    {(() => {
                                        const STAGES: Array<'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado'> = [
                                            'Lead Novo',
                                            'Em Qualificação',
                                            'Qualificado (QUENTE)',
                                            'Reuniões Agendadas',
                                            'Proposta enviada (Follow-up)',
                                            'No Show (Não compareceu) (Follow-up)',
                                            'Contrato fechado',
                                        ];
                                        return (
                                            <select
                                                className="w-full border border-neutral-300 rounded-md p-2 text-sm bg-white text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20 focus:outline-none focus:ring-1"
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value as typeof STAGES[number])}
                                            >
                                                {STAGES.map((s) => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                                <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}

function DelegateLeadButton({ lead, currentUserRole, onDelegated }: { lead: import('@/types/api').Lead; currentUserRole: string; onDelegated: () => void }) {
    const canDelegate = ['admin', 'manager', 'sdr'].includes(currentUserRole);
    const [open, setOpen] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string; isActive: boolean }>>([]);
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; email: string }>>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [searching, setSearching] = useState(false);
    const delegateLead = useDelegateLead();

    const handleOpen = async () => {
        if (!canDelegate) return;
        setOpen(true);
        try {
            setLoadingUsers(true);
            const list = await api.getConsultants();
            setUsers(list);
            setSuggestions(list.map((u) => ({ id: u.id, name: u.name, email: u.email })));
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSearch = async (value: string) => {
        setQuery(value);
        const q = value.trim();
        if (!q) {
            setSuggestions(users.map((u) => ({ id: u.id, name: u.name, email: u.email })));
            return;
        }
        try {
            setSearching(true);
            const list = await api.searchUsers(q);
            setSuggestions(list.map((u) => ({ id: u.id, name: u.name, email: u.email })));
        } finally {
            setSearching(false);
        }
    };

    const handleConfirm = async () => {
        let targetId = selectedUserId;
        if (!targetId) {
            const exact = suggestions.find((u) => u.email.toLowerCase() === query.toLowerCase() || u.name.toLowerCase() === query.toLowerCase());
            if (exact) targetId = exact.id;
        }
        if (!targetId) {
            toast.error('Selecione um usuário');
            return;
        }
        try {
            await delegateLead.mutateAsync({ id: lead.id, assignedToId: targetId });
            setOpen(false);
            onDelegated();
        } catch {}
    };

    return (
        <>
            <Button size="sm" variant="secondary" className="h-10 px-4 text-sm" onClick={handleOpen} disabled={!canDelegate}>
                Delegar
            </Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900">Direcionar Lead</h3>
                            <div className="space-y-2">
                                <Input
                                    label="Usuário"
                                    placeholder="Digite nome ou email"
                                    value={query}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20"
                                />
                                <div className="border border-neutral-300 rounded-md max-h-48 overflow-auto">
                                    {loadingUsers || searching ? (
                                        <div className="p-3 text-sm text-text-secondary">Carregando...</div>
                                    ) : suggestions.length === 0 ? (
                                        <div className="p-3 text-sm text-text-secondary">Nenhum usuário encontrado</div>
                                    ) : (
                                        <ul>
                                            {suggestions.map((u) => (
                                                <li
                                                    key={u.id}
                                                    className={`px-3 py-2 text-sm cursor-pointer ${selectedUserId === u.id ? 'bg-neutral-100' : ''}`}
                                                    onClick={() => setSelectedUserId(u.id)}
                                                >
                                                    {u.name} ({u.email})
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" className="h-12 px-5 text-sm" onClick={handleConfirm} isLoading={delegateLead.isPending}>
                                    Confirmar
                                </Button>
                                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
