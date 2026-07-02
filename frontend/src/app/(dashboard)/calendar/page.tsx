'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    useMeetings,
    useCreateMeeting,
    useUpdateMeeting,
    useDeleteMeeting,
} from '@/hooks/api/use-meetings';
import { useLeads } from '@/hooks/api/use-leads';
import type { Meeting } from '@/types/api';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addMonths,
    addDays,
    format,
    isSameDay,
    isSameMonth,
    isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Clock,
    User as UserIcon,
    Bot,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_LABELS: Record<string, string> = {
    scheduled: 'Agendada',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    no_show: 'Não compareceu',
};

const STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
    scheduled: 'warning',
    completed: 'success',
    cancelled: 'default',
    no_show: 'error',
};

const STATUS_DOT: Record<string, string> = {
    scheduled: 'bg-blue-500',
    completed: 'bg-green-500',
    cancelled: 'bg-neutral-400',
    no_show: 'bg-red-500',
};

export default function CalendarPage() {
    const router = useRouter();
    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Intervalo visível na grade (inclui dias dos meses vizinhos)
    const gridStart = startOfWeek(startOfMonth(currentMonth));
    const gridEnd = endOfWeek(endOfMonth(currentMonth));

    const { data: meetings, isLoading } = useMeetings(
        gridStart.toISOString(),
        gridEnd.toISOString(),
    );
    const updateMeeting = useUpdateMeeting();
    const deleteMeeting = useDeleteMeeting();

    const days = useMemo(() => {
        const list: Date[] = [];
        let day = gridStart;
        while (day <= gridEnd) {
            list.push(day);
            day = addDays(day, 1);
        }
        return list;
    }, [gridStart.getTime(), gridEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

    const meetingsByDay = useMemo(() => {
        const map = new Map<string, Meeting[]>();
        (meetings || []).forEach((m) => {
            const key = format(new Date(m.scheduledAt), 'yyyy-MM-dd');
            const list = map.get(key) || [];
            list.push(m);
            map.set(key, list);
        });
        map.forEach((list) =>
            list.sort(
                (a, b) =>
                    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
            ),
        );
        return map;
    }, [meetings]);

    const dayMeetings = meetingsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || [];

    const upcoming = useMemo(
        () =>
            (meetings || [])
                .filter(
                    (m) =>
                        m.status === 'scheduled' &&
                        new Date(m.scheduledAt).getTime() >= Date.now(),
                )
                .slice(0, 5),
        [meetings],
    );

    const handleStatusChange = (meeting: Meeting, status: string) => {
        updateMeeting.mutate({ id: meeting.id, data: { status } });
    };

    const handleDelete = (meeting: Meeting) => {
        if (confirm('Excluir esta reunião?')) {
            deleteMeeting.mutate(meeting.id);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header
                title="Calendário"
                description="Reuniões agendadas pela equipe e pelo agente de IA"
            />

            <div className="p-4 md:p-6 space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setCurrentMonth(startOfMonth(new Date()));
                                setSelectedDay(new Date());
                            }}
                        >
                            Hoje
                        </Button>
                        <h2 className="text-lg font-semibold capitalize ml-2">
                            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                        </h2>
                    </div>
                    <Button size="sm" onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Nova Reunião
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Grade do mês */}
                    <Card className="lg:col-span-2 p-3 md:p-4">
                        <div className="grid grid-cols-7 mb-1">
                            {WEEKDAYS.map((d) => (
                                <div
                                    key={d}
                                    className="text-center text-xs font-medium text-neutral-500 py-1"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day) => {
                                const key = format(day, 'yyyy-MM-dd');
                                const list = meetingsByDay.get(key) || [];
                                const inMonth = isSameMonth(day, currentMonth);
                                const selected = isSameDay(day, selectedDay);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedDay(day)}
                                        className={[
                                            'min-h-[64px] md:min-h-[84px] rounded-lg border p-1.5 text-left transition-colors flex flex-col',
                                            selected
                                                ? 'border-primary bg-primary/5'
                                                : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                                            inMonth ? '' : 'opacity-40',
                                        ].join(' ')}
                                    >
                                        <span
                                            className={[
                                                'text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full',
                                                isToday(day)
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-neutral-600 dark:text-neutral-300',
                                            ].join(' ')}
                                        >
                                            {format(day, 'd')}
                                        </span>
                                        <div className="mt-1 space-y-0.5 overflow-hidden">
                                            {list.slice(0, 2).map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="flex items-center gap-1 text-[10px] truncate"
                                                    title={m.title}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[m.status] || 'bg-blue-500'}`}
                                                    />
                                                    <span className="truncate">
                                                        {format(new Date(m.scheduledAt), 'HH:mm')}{' '}
                                                        {m.title}
                                                    </span>
                                                </div>
                                            ))}
                                            {list.length > 2 && (
                                                <div className="text-[10px] text-neutral-500">
                                                    +{list.length - 2} mais
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Painel do dia selecionado */}
                    <div className="space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold capitalize">
                                    {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                                </h3>
                                <Badge variant="default">{dayMeetings.length}</Badge>
                            </div>

                            {isLoading ? (
                                <p className="text-sm text-neutral-500">Carregando...</p>
                            ) : dayMeetings.length === 0 ? (
                                <p className="text-sm text-neutral-500">
                                    Nenhuma reunião neste dia.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {dayMeetings.map((m) => (
                                        <div
                                            key={m.id}
                                            className="border rounded-lg p-3 space-y-2"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {m.title}
                                                    </p>
                                                    <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(m.scheduledAt), 'HH:mm')} ·{' '}
                                                        {m.durationMinutes} min
                                                    </p>
                                                </div>
                                                <Badge variant={STATUS_VARIANTS[m.status] || 'default'}>
                                                    {STATUS_LABELS[m.status] || m.status}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                                {m.source === 'ai' ? (
                                                    <Badge
                                                        variant="default"
                                                        className="bg-violet-100 text-violet-700 border-0 inline-flex items-center gap-1"
                                                        title="Agendada automaticamente pelo agente de IA"
                                                    >
                                                        <Bot className="h-3 w-3" /> IA
                                                    </Badge>
                                                ) : (
                                                    m.createdBy?.name && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <UserIcon className="h-3 w-3" />
                                                            {m.createdBy.name}
                                                        </span>
                                                    )
                                                )}
                                                {(m.lead?.name || m.contactName) && (
                                                    <span
                                                        className={m.lead ? 'underline cursor-pointer' : ''}
                                                        onClick={() =>
                                                            m.lead && router.push(`/leads?leadId=${m.lead.id}`)
                                                        }
                                                    >
                                                        Com: {m.lead?.name || m.contactName}
                                                    </span>
                                                )}
                                            </div>

                                            {m.notes && (
                                                <p className="text-xs text-neutral-500 whitespace-pre-wrap">
                                                    {m.notes}
                                                </p>
                                            )}

                                            {m.status === 'scheduled' && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => handleStatusChange(m, 'completed')}
                                                    >
                                                        <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                                                        Realizada
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => handleStatusChange(m, 'no_show')}
                                                    >
                                                        <AlertCircle className="h-3 w-3 mr-1 text-amber-600" />
                                                        No-show
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => handleStatusChange(m, 'cancelled')}
                                                    >
                                                        <XCircle className="h-3 w-3 mr-1 text-neutral-500" />
                                                        Cancelar
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs text-red-600"
                                                        onClick={() => handleDelete(m)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Próximas reuniões */}
                        <Card className="p-4">
                            <h3 className="font-semibold mb-3">Próximas reuniões</h3>
                            {upcoming.length === 0 ? (
                                <p className="text-sm text-neutral-500">
                                    Nenhuma reunião futura neste mês.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {upcoming.map((m) => (
                                        <button
                                            key={m.id}
                                            className="w-full text-left flex items-center gap-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-md p-1.5"
                                            onClick={() => {
                                                const d = new Date(m.scheduledAt);
                                                setSelectedDay(d);
                                                setCurrentMonth(startOfMonth(d));
                                            }}
                                        >
                                            <span
                                                className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[m.status]}`}
                                            />
                                            <span className="text-xs text-neutral-500 w-24 flex-shrink-0">
                                                {format(new Date(m.scheduledAt), 'dd/MM HH:mm')}
                                            </span>
                                            <span className="truncate">{m.title}</span>
                                            {m.source === 'ai' && (
                                                <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <CreateMeetingModal
                    defaultDate={selectedDay}
                    onClose={() => setShowCreateModal(false)}
                />
            )}
        </div>
    );
}

function CreateMeetingModal({
    defaultDate,
    onClose,
}: {
    defaultDate: Date;
    onClose: () => void;
}) {
    const createMeeting = useCreateMeeting();
    const { data: leads } = useLeads();

    const [title, setTitle] = useState('');
    const [date, setDate] = useState(format(defaultDate, 'yyyy-MM-dd'));
    const [time, setTime] = useState('09:00');
    const [duration, setDuration] = useState(30);
    const [leadId, setLeadId] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !date || !time) return;

        const scheduledAt = new Date(`${date}T${time}`);
        try {
            await createMeeting.mutateAsync({
                title: title.trim(),
                scheduledAt: scheduledAt.toISOString(),
                durationMinutes: duration,
                leadId: leadId || undefined,
                notes: notes.trim() || undefined,
            });
            onClose();
        } catch {
            // toast já exibido pelo hook
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Nova Reunião</h3>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-neutral-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Título *</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex.: Apresentação da proposta"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Data *</label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Hora *</label>
                            <Input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            Duração (minutos)
                        </label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {[15, 30, 45, 60, 90, 120].map((d) => (
                                <option key={d} value={d}>
                                    {d} min
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            Lead (opcional)
                        </label>
                        <select
                            value={leadId}
                            onChange={(e) => setLeadId(e.target.value)}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="">Sem lead vinculado</option>
                            {(leads || []).map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                    {l.phone ? ` · ${l.phone}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            Observações
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Detalhes, link da call, pauta..."
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMeeting.isPending}>
                            {createMeeting.isPending ? 'Salvando...' : 'Agendar'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
