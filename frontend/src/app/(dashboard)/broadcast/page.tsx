'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Send, Loader2, Megaphone } from 'lucide-react';

type ChannelItem = { id: string; name: string; type: string; provider?: string; config?: unknown };
type TemplateItem = { name: string; language: string; status: string };
type CampaignItem = { id: string; name: string; channelId: string; sentCount: number; createdAt: string };

const EMOJI_QUICK = ['😀', '👍', '✅', '❤️', '📱', '💬', '🎉', '📞', '⚠️', '✨', '🔥', '🙏', '💪', '👋', '📋'];

export default function BroadcastPage() {
    const [channels, setChannels] = useState<ChannelItem[]>([]);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
    const [maxDaily, setMaxDaily] = useState<{ uazapi: number; official: number; message: string } | null>(null);
    const [dailySent, setDailySent] = useState<{ sentToday: number; maxDaily: number } | null>(null);
    const [channelId, setChannelId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [message, setMessage] = useState('');
    const [messageVariation2, setMessageVariation2] = useState('');
    const [messageVariation3, setMessageVariation3] = useState('');
    const [messageType, setMessageType] = useState<'text' | 'button' | 'list'>('text');
    const [buttonChoicesText, setButtonChoicesText] = useState('');
    const [listButton, setListButton] = useState('');
    const [footerText, setFooterText] = useState('');
    const [imageButtonUrl, setImageButtonUrl] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
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

    const loadCampaigns = useCallback(() => {
        api.getBroadcastCampaigns().then(setCampaigns).catch(() => {});
    }, []);
    useEffect(() => {
        api.getBroadcastChannels().then(setChannels).catch(() => toast.error('Erro ao carregar canais'));
        api.getBroadcastLeadStatuses().then(setLeadStatuses).catch(() => toast.error('Erro ao carregar status'));
        api.getBroadcastMaxDailyRecommendation().then(setMaxDaily).catch(() => {});
        loadCampaigns();
    }, [loadCampaigns]);

    useEffect(() => {
        if (channelId && isUazapi) {
            api.getBroadcastDailySent(channelId).then(setDailySent).catch(() => setDailySent(null));
        } else {
            setDailySent(null);
        }
    }, [channelId, isUazapi]);

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

    const insertEmoji = (emoji: string, target: 'message' | 'v2' | 'v3') => {
        if (target === 'message') {
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
        } else if (target === 'v2') {
            setMessageVariation2((prev) => prev + emoji);
        } else {
            setMessageVariation3((prev) => prev + emoji);
        }
    };

    const handleSend = async () => {
        if (sending) return;
        if (!channelId) {
            toast.error('Selecione um canal');
            return;
        }
        if (isOfficial && !templateName) {
            toast.error('Selecione um template (canais API Oficial)');
            return;
        }
        if (isUazapi) {
            if (!message.trim() && !mediaUrl.trim()) {
                toast.error('Digite a mensagem ou informe uma mídia (canal Uazapi)');
                return;
            }
            if (messageType === 'button') {
                const choices = buttonChoicesText.split('\n').map((c) => c.trim()).filter(Boolean);
                if (choices.length === 0) {
                    toast.error('Para botões informe ao menos uma opção (uma por linha)');
                    return;
                }
            }
            if (messageType === 'list') {
                if (!listButton.trim()) {
                    toast.error('Para lista informe o texto do botão que abre a lista');
                    return;
                }
                const choices = buttonChoicesText.split('\n').map((c) => c.trim()).filter(Boolean);
                if (choices.length === 0) {
                    toast.error('Para lista informe as opções (uma por linha; use [Nome da Seção] para títulos)');
                    return;
                }
            }
            if (mediaUrl.trim() && !mediaType) {
                toast.error('Selecione o tipo da mídia (imagem, vídeo, áudio ou documento)');
                return;
            }
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
            const variations: string[] = [];
            if (message.trim()) variations.push(message.trim());
            if (messageVariation2.trim()) variations.push(messageVariation2.trim());
            if (messageVariation3.trim()) variations.push(messageVariation3.trim());
            const buttonChoices = buttonChoicesText.split('\n').map((c) => c.trim()).filter(Boolean);
            const res = await api.sendBroadcast({
                channelId,
                campaignName: campaignName.trim() || undefined,
                templateName: isOfficial ? templateName : undefined,
                message: isUazapi ? message : undefined,
                messageVariations: isUazapi && messageType === 'text' && variations.length > 1 ? variations.slice(1) : undefined,
                messageType: isUazapi ? messageType : undefined,
                buttonChoices: isUazapi && (messageType === 'button' || messageType === 'list') ? buttonChoices : undefined,
                listButton: isUazapi && messageType === 'list' ? listButton.trim() || undefined : undefined,
                footerText: isUazapi && footerText.trim() ? footerText.trim() : undefined,
                imageButtonUrl: isUazapi && messageType === 'button' && imageButtonUrl.trim() ? imageButtonUrl.trim() : undefined,
                mediaUrl: isUazapi && mediaUrl.trim() ? mediaUrl.trim() : undefined,
                mediaType: isUazapi && mediaUrl.trim() ? mediaType : undefined,
                numbers,
                leadStatuses: statuses,
            });
            setResult(res);
            if (res.sent > 0) {
                toast.success(`${res.sent} mensagem(ns) enviada(s).`);
                loadCampaigns();
                if (isUazapi && channelId) {
                    api.getBroadcastDailySent(channelId).then(setDailySent).catch(() => {});
                }
            }
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
            <Header title="Disparos em massa" description="Envie mensagens para uma lista de números ou para leads por status do pipeline. O envio é espaçado automaticamente para cumprir limites do WhatsApp e evitar bloqueio." />

            <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-6">
                <div className="flex-1 min-w-0 max-w-2xl space-y-6">
                    {maxDaily && (
                        <Card className="bg-amber-50 border-amber-200">
                            <CardContent className="pt-4 space-y-2">
                                <p className="text-sm text-amber-800">
                                    <strong>Limite diário (Uazapi):</strong> até {maxDaily.uazapi} disparos por canal por dia. O sistema bloqueia novos envios ao atingir o limite (contador zera à meia-noite).
                                </p>
                                {dailySent != null && isUazapi && (
                                    <p className="text-sm font-medium text-amber-900">
                                        Enviados hoje neste canal: {dailySent.sentToday} / {dailySent.maxDaily}
                                        {dailySent.sentToday >= dailySent.maxDaily && ' — limite atingido.'}
                                    </p>
                                )}
                                <p className="text-xs text-amber-700">
                                    Intervalos: 15–45 s entre cada mensagem (Uazapi), 30–60 s (API Oficial). Use variações de texto e só envie para quem autorizou (opt-in) para reduzir risco de banimento.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Nome da campanha (opcional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <input
                                type="text"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                placeholder="Ex: Promoção Black Friday"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                            />
                            <p className="text-xs text-neutral-500 mt-1">O nome e a quantidade enviada ficarão salvos na lista ao lado.</p>
                        </CardContent>
                    </Card>

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
                                <div className="space-y-4">
                                    <p className="text-xs text-neutral-500">Canal Uazapi: mensagem de texto, botões, lista ou mídia. Use variações de texto para reduzir detecção de spam.</p>
                                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                                        <strong>Documentação:</strong>{' '}
                                        <a href="https://docs.uazapi.com/tag/Mensagem%20em%20massa" target="_blank" rel="noopener noreferrer" className="underline">Mensagem em massa</a>
                                        {' · '}
                                        <a href="https://docs.uazapi.com/endpoint/post/send~menu" target="_blank" rel="noopener noreferrer" className="underline">Botões e listas</a>
                                        {' · '}
                                        <a href="https://docs.uazapi.com/endpoint/post/send~media" target="_blank" rel="noopener noreferrer" className="underline">Mídia</a>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Tipo de mensagem</label>
                                        <select
                                            value={messageType}
                                            onChange={(e) => setMessageType(e.target.value as 'text' | 'button' | 'list')}
                                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900"
                                        >
                                            <option value="text">Texto (com até 3 variações aleatórias)</option>
                                            <option value="button">Botões (até 5 opções)</option>
                                            <option value="list">Lista (menu com seções)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Mensagem principal</label>
                                        <div className="flex flex-wrap gap-1 mb-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
                                            {EMOJI_QUICK.map((emoji) => (
                                                <button key={emoji} type="button" onClick={() => insertEmoji(emoji, 'message')} className="w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-200 text-lg transition-colors" title="Inserir emoji">{emoji}</button>
                                            ))}
                                        </div>
                                        <textarea
                                            ref={messageInputRef}
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder={messageType === 'button' ? 'Texto acima dos botões' : messageType === 'list' ? 'Texto acima da lista' : 'Digite o texto da mensagem...'}
                                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[80px] resize-y"
                                            rows={3}
                                        />
                                    </div>
                                    {messageType === 'text' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Variação 2 (opcional)</label>
                                                <textarea
                                                    value={messageVariation2}
                                                    onChange={(e) => setMessageVariation2(e.target.value)}
                                                    placeholder="Texto alternativo para parte dos destinatários"
                                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[70px] resize-y text-sm"
                                                    rows={2}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Variação 3 (opcional)</label>
                                                <textarea
                                                    value={messageVariation3}
                                                    onChange={(e) => setMessageVariation3(e.target.value)}
                                                    placeholder="Outra variação"
                                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[70px] resize-y text-sm"
                                                    rows={2}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {messageType === 'button' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Opções dos botões (uma por linha, máx. 5)</label>
                                                <textarea
                                                    value={buttonChoicesText}
                                                    onChange={(e) => setButtonChoicesText(e.target.value)}
                                                    placeholder={'Exemplo:\nSuporte|suporte\nSite|url:https://site.com\nLigar|call:+5511999999999'}
                                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[90px] resize-y font-mono text-sm"
                                                    rows={4}
                                                />
                                                <p className="text-xs text-neutral-500 mt-1">Formato: texto|id ou texto|url:https://... ou texto|call:+55...</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Rodapé (opcional)</label>
                                                <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Texto abaixo da mensagem" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Imagem do botão (opcional, URL)</label>
                                                <input type="url" value={imageButtonUrl} onChange={(e) => setImageButtonUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm" />
                                            </div>
                                        </>
                                    )}
                                    {messageType === 'list' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Texto do botão que abre a lista</label>
                                                <input type="text" value={listButton} onChange={(e) => setListButton(e.target.value)} placeholder="Ex: Ver opções" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Opções da lista (uma por linha)</label>
                                                <textarea
                                                    value={buttonChoicesText}
                                                    onChange={(e) => setButtonChoicesText(e.target.value)}
                                                    placeholder={'[Eletrônicos]\nSmartphones|phones|Descrição\n[Serviços]\nSuporte|sup|Atendimento'}
                                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 min-h-[100px] resize-y font-mono text-sm"
                                                    rows={5}
                                                />
                                                <p className="text-xs text-neutral-500 mt-1">Use [Nome da seção] para títulos. Itens: texto|id|descrição</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Rodapé (opcional)</label>
                                                <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Texto abaixo" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm" />
                                            </div>
                                        </>
                                    )}
                                    <div className="border-t border-neutral-200 pt-4">
                                        <label className="block text-sm font-medium mb-2">Mídia (opcional) – enviar imagem, vídeo, áudio ou documento</label>
                                        <div className="flex gap-2 flex-wrap">
                                            <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'image' | 'video' | 'audio' | 'document')} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm w-32">
                                                <option value="image">Imagem</option>
                                                <option value="video">Vídeo</option>
                                                <option value="audio">Áudio</option>
                                                <option value="document">Documento</option>
                                            </select>
                                            <input
                                                type="url"
                                                value={mediaUrl}
                                                onChange={(e) => setMediaUrl(e.target.value)}
                                                placeholder="URL pública da mídia (https://...)"
                                                className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm"
                                            />
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-1">A mensagem principal será usada como legenda. Deixe em branco para só texto/botões/lista.</p>
                                    </div>
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

                <div className="w-full lg:w-80 shrink-0">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Megaphone className="h-4 w-4" />
                                Campanhas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-neutral-500 mb-3">Nome e quantidade de disparos realizados.</p>
                            {campaigns.length === 0 ? (
                                <p className="text-sm text-neutral-400">Nenhuma campanha ainda.</p>
                            ) : (
                                <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                                    {campaigns.map((c) => (
                                        <li key={c.id} className="flex flex-col gap-0.5 p-2 rounded-lg bg-neutral-50 border border-neutral-100">
                                            <span className="font-medium text-sm text-neutral-900 truncate">{c.name}</span>
                                            <span className="text-xs text-neutral-600">{c.sentCount} disparo(s)</span>
                                            <span className="text-xs text-neutral-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
