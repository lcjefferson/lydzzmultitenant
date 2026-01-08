'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLeads, useUpdateLead, useDeleteLead, useLeadComments, useAddLeadComment, useDelegateLead } from '@/hooks/api/use-leads';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Building, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STAGES: Array<'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado'> = [
  'Lead Novo',
  'Em Qualificação',
  'Qualificado (QUENTE)',
  'Reuniões Agendadas',
  'Proposta enviada (Follow-up)',
  'No Show (Não compareceu) (Follow-up)',
  'Contrato fechado',
];

export default function PipelinePage() {
  const router = useRouter();
  const { data: leads, isLoading } = useLeads();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, typeof STAGES[number]>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const filteredLeads = (leads || []).filter((lead) => {
    const role = (typeof user?.role === 'string' ? user.role : 'user').toLowerCase();
    if (role === 'consultant') {
      return String(lead.assignedToId || '') === String(user?.id || '');
    }
    return true;
  });
  const items = filteredLeads.map((l) => ({
    ...l,
    status: normalizeStatus(overrides[l.id] ?? l.status),
  }));

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
    const relName = (a?.assignedTo?.name || '').trim();
    if (relName) {
      if (relName.toLowerCase() === 'consultant user') return '';
      return relName;
    }
    const id = (a?.assignedToId || '').trim();
    if (!id) return '';
    const match = users.find((u) => u.id === id);
    const name = (match?.name || '').trim();
    if (name.toLowerCase() === 'consultant user') return '';
    return name || '';
  };

  const getTemperatureBadge = (temp: 'hot' | 'warm' | 'cold') => {
    const variants: Record<'hot' | 'warm' | 'cold', 'success' | 'warning' | 'default'> = {
      hot: 'success',
      warm: 'warning',
      cold: 'default',
    };
    const labels: Record<'hot' | 'warm' | 'cold', string> = {
      hot: '🔥 HOT',
      warm: '🟡 WARM',
      cold: '🔵 COLD',
    };
    return <Badge variant={variants[temp]}>{labels[temp]}</Badge>;
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

  const handleDeleteLead = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este lead?')) {
      try {
        await deleteLead.mutateAsync(id);
        setSelectedLeadId(null);
      } catch {}
    }
  };

  const handleDragStart = (id: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = async (stage: typeof STAGES[number], e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    try {
      await updateLead.mutateAsync({ id, data: { status: stage } });
      setOverrides((prev) => ({ ...prev, [id]: stage }));
    } catch {}
  };

  return (
    <div>
      <Header title="Pipeline" description="Acompanhe o funil de vendas" />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {STAGES.map((stage) => {
            const stageItems = items.filter((l) => l.status === stage);
            return (
              <div
                key={stage}
                className="border border-border rounded-lg p-3 bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(stage, e)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold capitalize text-neutral-900">{stage}</h3>
                  <Badge variant="default">{stageItems.length}</Badge>
                </div>
                <div
                  className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => handleDrop(stage, e)}
                >
                  {isLoading ? (
                    <div className="p-4 text-center text-text-secondary">Carregando...</div>
                  ) : stageItems.length === 0 ? (
                    <div className="p-4 text-center text-text-tertiary">Sem leads</div>
                  ) : (
                    stageItems.map((lead) => (
                      <Card
                        key={lead.id}
                        className="p-3 hover:bg-surface transition-colors"
                        draggable
                        onDragStart={(e) => handleDragStart(lead.id, e)}
                        onDoubleClick={() => setSelectedLeadId(lead.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate text-neutral-900">{lead.name}</p>
                            {(lead.phone || lead.email) && (
                              <p className="text-xs text-text-tertiary truncate">{lead.phone || lead.email}</p>
                              )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {lead.company && (
                            <span className="text-xs text-text-tertiary truncate">{lead.company}</span>
                          )}
                          {(() => {
                            const name = getAssignedName(lead);
                            return name ? (
                              <span className="text-xs text-neutral-700 truncate">Delegado: {name}</span>
                            ) : null;
                          })()}
                        </div>
                        <div className="mt-3">
                          <button
                            className="text-xs text-accent-primary hover:underline"
                            onClick={() => {
                              const contact = lead.phone || lead.email || lead.name;
                              if (contact) {
                                router.push(`/conversations?contact=${encodeURIComponent(contact)}`);
                              }
                            }}
                          >
                            Falar via Omnichannel
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selectedLeadId && (() => {
        const lead = items.find((l) => l.id === selectedLeadId);
        if (!lead) return null;
        return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setSelectedLeadId(null)}
          >
            <Card
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{lead.name}</h2>
                    {(lead.company || lead.position) && (
                      <p className="text-neutral-600 mt-1">
                        {lead.company} {lead.position && `• ${lead.position}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedLeadId(null)
                    }
                    className="text-text-secondary hover:text-text-primary"
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

                <div className="flex flex-wrap gap-2 justify-end items-center">
                  <Button
                    size="sm"
                    className="h-10 px-4 text-sm"
                    onClick={() => {
                      const contact = lead.phone || lead.email || lead.name;
                      if (contact) {
                        router.push(`/conversations?contact=${encodeURIComponent(contact)}`);
                        setSelectedLeadId(null);
                      }
                    }}
                  >
                    Falar via Omnichannel
                  </Button>
                  <OutcomeButton lead={lead} onClose={() => setSelectedLeadId(null)} />
                  <EditLeadButton lead={lead} />
                  <DelegateLeadButton lead={lead} currentUserRole={String(user?.role || '').toLowerCase()} onDelegated={() => setSelectedLeadId(null)} />
                  <Button
                    variant="danger"
                    size="sm"
                    className="h-10 px-4 text-sm"
                    onClick={() => handleDeleteLead(lead.id)}
                    isLoading={deleteLead.isPending}
                  >
                    Excluir
                  </Button>
                  <Button variant="secondary" size="sm" className="h-10 px-4 text-sm" onClick={() => setSelectedLeadId(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}
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
      <Button size="sm" variant="secondary" className="h-10 px-4 text-sm" onClick={() => setOpen(true)}>
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
                <Button size="sm" className="h-12 px-5 text-sm" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
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
      </div>
      <div className="flex gap-2 items-end">
        <Input label="Adicionar comentário" value={content} onChange={(e) => setContent(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
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
  const [temperature, setTemperature] = useState<"hot" | "warm" | "cold">(lead.temperature);
  const STAGES: Array<'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado'> = [
    'Lead Novo',
    'Em Qualificação',
    'Qualificado (QUENTE)',
    'Reuniões Agendadas',
    'Proposta enviada (Follow-up)',
    'No Show (Não compareceu) (Follow-up)',
    'Contrato fechado',
  ];
  const [status, setStatus] = useState<typeof STAGES[number]>(lead.status);
  const updateLead = useUpdateLead();

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        data: {
          name,
          email,
          phone,
          company,
          position,
          source,
          interest,
          temperature,
          status,
        },
      });
      setOpen(false);
    } catch {}
  };

  return (
    <>
      <Button size="sm" variant="secondary" className="h-10 px-4 text-sm" onClick={() => setOpen(true)}>Editar</Button>
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-semibold text-neutral-900">Editar Lead</h3>
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
              </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
        <Input label="Cargo" value={position} onChange={(e) => setPosition(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-text-tertiary mb-1">Temperatura</p>
          <select className="w-full bg-white border border-neutral-300 rounded-md px-4 py-3 text-sm text-neutral-900 focus:outline-none focus:border-primary-500 focus:ring-primary-500/20" value={temperature} onChange={(e) => setTemperature(e.target.value as 'hot' | 'warm' | 'cold')}>
            <option value="hot">🔥 HOT</option>
            <option value="warm">🟡 WARM</option>
            <option value="cold">🔵 COLD</option>
          </select>
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-1">Status</p>
          <select className="w-full bg-white border border-neutral-300 rounded-md px-4 py-3 text-sm text-neutral-900 focus:outline-none focus:border-primary-500 focus:ring-primary-500/20" value={status} onChange={(e) => setStatus(e.target.value as typeof STAGES[number])}>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Origem" value={source} onChange={(e) => setSource(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
        <Input label="Interesse" value={interest} onChange={(e) => setInterest(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
      </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="h-12 px-5 text-sm" onClick={handleSave} isLoading={updateLead.isPending}>Salvar</Button>
                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
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

  const handleDelegate = async () => {
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
      <Button size="sm" variant="secondary" className="h-10 px-4 text-sm" onClick={handleOpen} disabled={!canDelegate}>Delegar</Button>
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-semibold text-neutral-900">Delegar Lead</h3>
              {loadingUsers ? (
                <p className="text-sm text-text-secondary">Carregando usuários...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-text-secondary">Sem usuários disponíveis</p>
              ) : (
                <div className="space-y-2">
                  <Input
                    label="Usuário"
                    placeholder="Digite nome ou email"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  <div className="border border-neutral-300 rounded-md max-h-48 overflow-auto">
                    {searching ? (
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
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="h-12 px-5 text-sm" onClick={handleDelegate} isLoading={delegateLead.isPending} disabled={!selectedUserId}>Delegar</Button>
                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function normalizeStatus(s: string) {
  const raw = String(s || '').trim();
  const v = raw.toLowerCase();
  // prioritize exact matches to known stages
  if (STAGES.includes(raw as typeof STAGES[number])) return raw as typeof STAGES[number];
  // synonyms and fuzzy matches
  if (v.includes('converted') || v === 'contrato fechado') return 'Contrato fechado';
  if (v.includes('quente') || v.includes('qualificado')) return 'Qualificado (QUENTE)';
  if (v.includes('proposta')) return 'Proposta enviada (Follow-up)';
  if (v.includes('no show')) return 'No Show (Não compareceu) (Follow-up)';
  if (v.includes('reuni')) return 'Reuniões Agendadas';
  if (v.includes('sem interesse') || v.includes('lost')) return 'Em Qualificação';
  if (v.includes('qualific')) return 'Em Qualificação';
  return 'Lead Novo';
}
