'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';

type ChannelItem = { id: string; name: string; type: string; provider?: string; config?: unknown };
type TemplateItem = { name: string; language: string; status: string };

const EMOJI_QUICK = ['😀', '👍', '✅', '❤️', '📱', '💬', '🎉', '📞', '⚠️', '✨', '🔥', '🙏', '💪', '👋', '📋'];

export default function BroadcastPage() {
    const [channels, setChannels] = useState<ChannelItem[]>([]);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
    const [channelId, setChannelId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [message, setMessage] = useState('');
    const [source, setSource] = useState<'numbers' | 'leads'>('numbers');
    const [numbersText, setNumbersText] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const selectedChannel = channels.find((c) => c.id === channelId);
    const provider = (selectedChannel?.provider ?? (typeof selectedChannel?.config === 'object' && selectedChannel?.config !== null ? (selectedChannel.config as { provider?: string }).provider : undefined) ?? '').toString().toLowerCase();
    const isUazapi = Boolean(channelId && provider === 'uazapi');
    const isOfficial = Boolean(channelId && provider === 'whatsapp-official');

    useEffect(() => {
        api.getBroadcastChannels().then(setChannels).catch(() => toast.error('Erro ao carregar canais'));
        api.getBroadcastLeadStatuses().then(setLeadStatuses).catch(() => toast.error('Erro ao carregar status'));
    }, []);

    useEffect(() => {
        if (!channelId || !isOfficial) {
            setTemplates([]);
            setTemplateName('');
            return;
        }
        api.getBroadcastTemplates(channelId)
            .then((list) => {
                setTemplates(list);
                setTemplateName(list[0]?.name || '');
            })
            .catch(() => setTemplates([]));
    }, [channelId, isOfficial]);

    const insertEmoji = (emoji: string) => {
        const ta = messageInputRef.current;
        if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const before = message.slice(0, start);
            const after = message.slice(end);
            setMessage(before + emoji + after);
            setTimeout(() => {
                ta.focus();
                ta.setSelectionRange(start + emoji.length, start + emoji.length);
            }, 0);
        } else {
            setMessage((prev) => prev + emoji);
        }
    };

    const handleSend = async () => {
        if (!channelId) {
            toast.error('Selecione um canal');
            return;
        }
        if (isOfficial && !templateName) {
            toast.error('Selecione um template (canais API Oficial)');
            return;
        }
        if (isUazapi && !message.trim()) {
            toast.error('Digite a mensagem livre (canal Uazapi)');
            return;
        }

        const numbers = source === 'numbers'
            ? numbersText.replace(/[,;]/g, '\n').split('\n').map((n) => n.trim()).filter(Boolean)
            : undefined;
        const statuses = source === 'leads' ? selectedStatuses : undefined;

        if (source === 'numbers' && (!numbers || numbers.length === 0)) {
            toast.error('Informe ao menos um número');
            return;
        }
        if (source === 'leads' && (!statuses || statuses.length === 0)) {
            toast.error('Selecione ao menos um status do pipeline');
            return;
        }

        setSending(true);
        setResult(null);
        try {
            const res = await api.sendBroadcast({
                channelId,
                templateName: isOfficial ? templateName : undefined,
                message: isUazapi ? message : undefined,
                numbers,
                leadStatuses: statuses,
            });
            setResult(res);
            if (res.sent > 0) toast.success(`${res.sent} mensagem(ns) enviada(s).`);
            if (res.failed > 0) toast.error(`${res.failed} falha(s).`);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e.response?.data?.message || 'Erro ao enviar disparo');
        } finally {
            setSending(false);
        }
    };

    const toggleStatus = (status: string) => {
        setSelectedStatuses((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
        );
    };

    return (
        <div>
            <Header title="Disparos em massa" description="Envie mensagens para uma lista de números ou para leads por status do pipeline. O envio é espaçado automaticamente para cumprir limites do Meta e evitar bloqueio." />

            <div className="p-4 md:p-6 max-w-2xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Canal de envio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Canal (número que enviará)</label>
                            <select
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                            >
                                <option value="">Selecione um canal WhatsApp</option>
                                {channels.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.provider ? `(${c.provider})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {channelId && isOfficial && (
                            <div>
                                <p className="text-xs text-neutral-500 mb-1">Canal API Oficial: use apenas templates aprovados pelo Meta.</p>
                                <label className="block text-sm font-medium mb-2">Template aprovado (Meta)</label>
                                <select
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                                >
                                    {templates.length === 0 && <option value="">Nenhum template ou configure wabaId no canal</option>}
                                    {templates.map((t) => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {channelId && isUazapi && (
                            <div>
                                <p className="text-xs text-neutral-500 mb-1">Canal Uazapi: mensagem livre. Você pode usar emojis no texto.</p>
                                <label className="block text-sm font-medium mb-2">Mensagem livre</label>
                                <div className="flex flex-wrap gap-1 mb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                                    {EMOJI_QUICK.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => insertEmoji(emoji)}
                                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-200 text-lg transition-colors"
                                            title="Inserir emoji"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    ref={messageInputRef}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Digite o texto da mensagem... Você pode colar emojis ou usar os botões acima."
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[120px] resize-y"
                                    rows={5}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Destinatários</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={source === 'numbers'} onChange={() => setSource('numbers')} />
                                Lista de números
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={source === 'leads'} onChange={() => setSource('leads')} />
                                Leads por status (pipeline)
                            </label>
                        </div>

                        {source === 'numbers' && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Números (um por linha ou separados por vírgula)</label>
                                <textarea
                                    value={numbersText}
                                    onChange={(e) => setNumbersText(e.target.value)}
                                    placeholder="5511999999999&#10;5521988888888"
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[120px] font-mono text-sm"
                                />
                            </div>
                        )}

                        {source === 'leads' && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Status do pipeline (kanban)</label>
                                <div className="flex flex-wrap gap-2">
                                    {leadStatuses.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => toggleStatus(status)}
                                            className={`px-3 py-1.5 rounded-lg border text-sm ${selectedStatuses.includes(status) ? 'bg-[#00a884] text-white border-[#00a884]' : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                                {selectedStatuses.length > 0 && (
                                    <p className="text-sm text-neutral-500 mt-2">
                                        {selectedStatuses.length} status(is) selecionado(s). Serão enviados para leads com telefone.
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center gap-4">
                    <Button onClick={handleSend} disabled={sending}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sending ? 'Enviando (aguarde o intervalo entre mensagens)...' : 'Enviar disparo'}
                    </Button>
                </div>

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-success font-medium">{result.sent} enviada(s)</p>
                            {result.failed > 0 && <p className="text-error">{result.failed} falha(s)</p>}
                            {result.errors.length > 0 && (
                                <ul className="text-sm text-neutral-600 max-h-40 overflow-y-auto list-disc pl-4">
                                    {result.errors.slice(0, 20).map((e, i) => (
                                        <li key={i}>{e}</li>
                                    ))}
                                    {result.errors.length > 20 && <li>... e mais {result.errors.length - 20} erros</li>}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
