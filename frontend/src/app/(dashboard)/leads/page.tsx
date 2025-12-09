'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Mail,
    Phone,
    Building,
    TrendingUp,
    X,
} from 'lucide-react';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useLeadTags, useAddLeadTag, useRemoveLeadTag, useLeadComments, useAddLeadComment } from '@/hooks/api/use-leads';
import { useLeadStats } from '@/hooks/api/use-analytics';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

export default function LeadsPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [tempFilter, setTempFilter] = useState<'hot' | 'warm' | 'cold' | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | undefined>(undefined);
    const [selectedLead, setSelectedLead] = useState<string | null>(null);
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
    const createLead = useCreateLead();
    const updateLead = useUpdateLead();
    const deleteLead = useDeleteLead();

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
            hot: '🔥 HOT',
            warm: '🟡 WARM',
            cold: '🔵 COLD',
        };
        return <Badge variant={variants[temp]}>{labels[temp]}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
            new: 'default',
            contacted: 'warning',
            qualified: 'success',
            converted: 'success',
            lost: 'error',
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
                        <Card key={stat.label}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-text-secondary">{stat.label}</p>
                                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                                </div>
                                <TrendingUp className={`h-8 w-8 ${stat.color}`} />
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Filters and Search */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email, empresa..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant={!statusFilter ? 'primary' : 'secondary'}
                            onClick={() => setStatusFilter(undefined)}
                        >
                            Todos status
                        </Button>
                        <Button size="sm" variant={statusFilter === 'new' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('new')}>Novos</Button>
                        <Button size="sm" variant={statusFilter === 'contacted' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('contacted')}>Contactados</Button>
                        <Button size="sm" variant={statusFilter === 'qualified' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('qualified')}>Qualificados</Button>
                        <Button size="sm" variant={statusFilter === 'converted' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('converted')}>Convertidos</Button>
                        <Button size="sm" variant={statusFilter === 'lost' ? 'primary' : 'secondary'} onClick={() => setStatusFilter('lost')}>Perdidos</Button>
                    </div>
                </div>

                {/* Pipeline (Kanban) */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {['new','contacted','qualified','converted','lost'].map((stage) => (
                        <div key={stage} className="border border-border rounded-lg p-3 bg-background-secondary">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold capitalize">{stage}</h3>
                                <Badge variant="default">{(leads || []).filter(l => l.status===stage).length}</Badge>
                            </div>
                            <div
                                className="space-y-2 min-h-32"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={async (e) => {
                                    const id = e.dataTransfer.getData('text/plain');
                                    if (!id) return;
                                    try {
                                        await updateLead.mutateAsync({ id, data: { status: stage } });
                                    } catch {}
                                }}
                            >
                                {(leads || []).filter(l => l.status===stage).map((lead) => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                                        onClick={() => setSelectedLead(lead.id)}
                                        className="p-3 rounded-md bg-surface hover:bg-surface-hover border border-border cursor-move"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium truncate">{lead.name}</p>
                                            {getTemperatureBadge(lead.temperature)}
                                        </div>
                                        {lead.company && (
                                            <p className="text-xs text-text-tertiary truncate">{lead.company}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
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
                                                    <p className="font-medium">{lead.name}</p>
                                                    {lead.email && (
                                                        <div className="flex items-center gap-3 text-sm text-text-secondary">
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {lead.email}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(lead.company || lead.position) && (
                                                        <p className="text-sm text-text-tertiary">
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
                                                    <span className="text-sm font-medium">{lead.score}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {getStatusBadge(lead.status)}
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
                            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <h2 className="text-2xl font-bold">Novo Lead</h2>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="text-text-secondary hover:text-text-primary"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateLead} className="space-y-4">
                                    <Input
                                        label="Nome"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                        <Input
                                            label="Telefone"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Empresa"
                                            value={formData.company}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        />
                                        <Input
                                            label="Cargo"
                                            value={formData.position}
                                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Origem"
                                            value={formData.source}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                        />
                                        <Input
                                            label="Interesse"
                                            value={formData.interest}
                                            onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
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
                                className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-6 space-y-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold">{lead.name}</h2>
                                            {(lead.company || lead.position) && (
                                                <p className="text-text-secondary mt-1">
                                                    {lead.company} {lead.position && `• ${lead.position}`}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setSelectedLead(null)}
                                            className="text-text-secondary hover:text-text-primary"
                                        >
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {getTemperatureBadge(lead.temperature)}
                                        {getStatusBadge(lead.status)}
                                        <span className="text-sm text-text-secondary">
                                            Score: <span className="font-medium">{lead.score}</span>
                                        </span>
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
                                        const tags = Array.isArray(cf.tags) ? (cf.tags as string[]) : [];
                                        return (
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-text-tertiary mb-2">Categorias</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {tags.map((t) => (
                                                            <Badge key={t} variant="default">{t}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <TagEditor leadId={lead.id} />
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

                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => {
                                                const contact = lead.phone || lead.email || lead.name;
                                                if (contact) {
                                                    router.push(`/conversations?contact=${encodeURIComponent(contact)}`);
                                                    setSelectedLead(null);
                                                }
                                            }}
                                        >
                                            Falar via Omnichannel
                                        </Button>
                                        <OutcomeButton lead={lead} onClose={() => setSelectedLead(null)} />
                                        <EditLeadButton lead={lead} />
                                        <Button
                                            variant="danger"
                                            className="flex-1"
                                            onClick={() => handleDeleteLead(lead.id)}
                                            isLoading={deleteLead.isPending}
                                        >
                                            Excluir
                                        </Button>
                                        <Button variant="secondary" className="flex-1" onClick={() => setSelectedLead(null)}>
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
    const [status, setStatus] = useState<'converted' | 'lost'>('converted');
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
            <Button className="flex-1" variant="secondary" onClick={() => setOpen(true)}>
                Definir Resultado
            </Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold">Resultado do Lead</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant={status === 'converted' ? 'primary' : 'secondary'} onClick={() => setStatus('converted')}>Venda Fechada</Button>
                                <Button variant={status === 'lost' ? 'primary' : 'secondary'} onClick={() => setStatus('lost')}>Sem Interesse</Button>
                            </div>
                            <Input label="Valor da Venda (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
                            <Input label="Detalhes" value={reason} onChange={(e) => setReason(e.target.value)} />
                            <div className="flex gap-2 pt-2">
                                <Button className="flex-1" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                                <Button className="flex-1" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}

function TagEditor({ leadId }: { leadId: string }) {
    const [input, setInput] = useState('');
    const tagsQuery = useLeadTags(leadId);
    const addTag = useAddLeadTag();
    const removeTag = useRemoveLeadTag();

    const tags = tagsQuery.data || [];

    const handleAdd = async () => {
        const tag = input.trim();
        if (!tag) return;
        try {
            await addTag.mutateAsync({ id: leadId, tag });
            setInput('');
        } catch {}
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <Input label="Nova categoria" value={input} onChange={(e) => setInput(e.target.value)} />
                <Button onClick={handleAdd} isLoading={addTag.isPending}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                    <div key={t} className="flex items-center gap-1">
                        <Badge variant="default">{t}</Badge>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                                try {
                                    await removeTag.mutateAsync({ id: leadId, tag: t });
                                } catch {}
                            }}
                        >
                            Remover
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Comments({ leadId }: { leadId: string }) {
    const [content, setContent] = useState('');
    const commentsQuery = useLeadComments(leadId);
    const addComment = useAddLeadComment();

    const comments = commentsQuery.data || [];

    const handleAdd = async () => {
        const text = content.trim();
        if (!text) return;
        try {
            await addComment.mutateAsync({ id: leadId, content: text });
            setContent('');
        } catch {}
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-text-tertiary">Comentários</p>
            <div className="space-y-2">
                {comments.length === 0 ? (
                    <p className="text-sm text-text-secondary">Sem comentários</p>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="p-2 rounded-md bg-surface border border-border">
                            <p className="text-sm">{c.content}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
                            </p>
                        </div>
                    ))
                )}
            </div>
            <div className="flex gap-2">
                <Input label="Adicionar comentário" value={content} onChange={(e) => setContent(e.target.value)} />
                <Button onClick={handleAdd} isLoading={addComment.isPending}>Comentar</Button>
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
    const [status, setStatus] = useState<"new"|"contacted"|"qualified"|"converted"|"lost">(lead.status);
    const [score, setScore] = useState(String(lead.score ?? 0));
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
                    score: Number(score) || 0,
                },
            });
            setOpen(false);
        } catch {}
    };

    return (
        <>
            <Button className="flex-1" variant="secondary" onClick={() => setOpen(true)}>Editar</Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold">Editar Lead</h3>
                            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
                                <Input label="Cargo" value={position} onChange={(e) => setPosition(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Origem" value={source} onChange={(e) => setSource(e.target.value)} />
                                <Input label="Interesse" value={interest} onChange={(e) => setInterest(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Temperatura</p>
                                    <div className="flex gap-2">
                                        {(['hot','warm','cold'] as const).map((t) => (
                                            <Button key={t} size="sm" variant={temperature===t? 'primary':'secondary'} onClick={() => setTemperature(t)}>
                                                {t}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Status</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(['new','contacted','qualified','converted','lost'] as const).map((s) => (
                                            <Button key={s} size="sm" variant={status===s? 'primary':'secondary'} onClick={() => setStatus(s)}>
                                                {s}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <Input label="Score" type="number" value={score} onChange={(e) => setScore(e.target.value)} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button className="flex-1" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                                <Button className="flex-1" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
