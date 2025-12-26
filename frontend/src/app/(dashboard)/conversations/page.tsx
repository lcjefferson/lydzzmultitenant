'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConversationItem } from '@/components/chat/conversation-item';
import { MessageBubble } from '@/components/chat/message-bubble';
import { Search, Send, Paperclip, MoreVertical, Wifi, WifiOff, Mail, Phone, Building, X, Mic, Square, RefreshCw } from 'lucide-react';
import { useConversations, useUpdateConversation } from '@/hooks/api/use-conversations';
import { useMessages, useCreateMessage } from '@/hooks/api/use-messages';
import { useSocket } from '@/hooks/use-socket';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'next/navigation';
import { useLead, useLeadComments, useAddLeadComment, useUpdateLead, useDelegateLead } from '@/hooks/api/use-leads';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ConversationsPage() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'waiting'>('all');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const [showLeadModal, setShowLeadModal] = useState(false);
    const { user } = useAuth();
    const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
                
                try {
                    const uploaded = await api.uploadFile(file);
                    if (effectiveSelectedId) {
                         await createMessage.mutateAsync({
                            conversationId: effectiveSelectedId,
                            content: '', // Empty content for audio messages to avoid "Audio enviado" text
                            senderType: 'user',
                            type: 'audio',
                            attachments: {
                                url: uploaded.path,
                                name: uploaded.filename,
                                mimeType: uploaded.mimetype
                            }
                        });
                        toast.success('Áudio enviado!');
                    }
                } catch (error) {
                    console.error('Error uploading audio:', error);
                    toast.error('Erro ao enviar áudio');
                }
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            toast.error('Erro ao acessar microfone. Verifique as permissões.');
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSyncMessages = async () => {
        if (effectiveSelectedId) {
            try {
                toast.info('Sincronizando mensagens...');
                const res = await api.syncMessages(effectiveSelectedId);
                toast.success(`${res} mensagens importadas!`);
                queryClient.invalidateQueries({ queryKey: ['messages', effectiveSelectedId] });
            } catch (error) {
                console.error('Error syncing messages:', error);
                toast.error('Erro ao sincronizar mensagens.');
            }
        }
    };

    const { data: conversations, isLoading: conversationsLoading } = useConversations();
    const searchParams = useSearchParams();
    const contactParam = searchParams.get('contact');
    const convParam = searchParams.get('conversationId');

    const preselectedFromContact = contactParam && conversations
        ? conversations.find((c) => c.contactIdentifier === contactParam)?.id || null
        : null;
    const preselectedFromParamId = convParam || null;
    const effectiveSelectedId = selectedConversationId
        ?? preselectedFromParamId
        ?? preselectedFromContact
        ?? (conversations && conversations.length > 0 ? conversations[0].id : null);

    const { data: messages } = useMessages(effectiveSelectedId || '');
    const createMessage = useCreateMessage();
    const updateConversation = useUpdateConversation();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !effectiveSelectedId) return;

        try {
            const uploaded = await api.uploadFile(file);
            
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');
            
            let type: 'image' | 'file' | 'audio' | 'video' = 'file';
            let content = 'Arquivo enviado';

            if (isImage) {
                type = 'image';
                content = 'Imagem enviada';
            } else if (isVideo) {
                type = 'video';
                content = 'Vídeo enviado';
            } else if (isAudio) {
                type = 'audio';
                content = 'Áudio enviado';
            }

            // Use message input as caption if available
            // If it's a file/audio/video, we don't want the default "Arquivo enviado" text to be the message content if there is no caption.
            // But the backend expects 'content'.
            // For files/audio, let's keep the content empty or just a placeholder if the user didn't type anything.
            // Actually, for display purposes, MessageBubble shows the media. The content text is often redundant if it's just "Audio enviado".
            
            const hasUserTyped = messageInput.trim().length > 0;
            const caption = hasUserTyped ? messageInput.trim() : ''; 

            await createMessage.mutateAsync({
                conversationId: effectiveSelectedId,
                content: caption, // Send empty string if no caption, so UI renders just the media bubble
                senderType: 'user',
                type,
                attachments: {
                    url: uploaded.path,
                    name: uploaded.originalName || uploaded.filename,
                    mimeType: uploaded.mimetype
                }
            });
            
            if (hasUserTyped) setMessageInput('');
            
            toast.success('Arquivo enviado com sucesso!');
        } catch (error) {
            toast.error('Erro ao enviar arquivo');
            console.error(error);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // WebSocket connection
    const { isConnected, joinConversation, leaveConversation, onNewMessage, offNewMessage, onMessageCreated, offMessageCreated, onMessageUpdated, offMessageUpdated } = useSocket();

    // Removed effect-based selection; selection derived from URL param or first item

    // Join/leave conversation room when selection changes
    useEffect(() => {
        if (effectiveSelectedId) {
            joinConversation(effectiveSelectedId);

            return () => {
                leaveConversation(effectiveSelectedId);
            };
        }
    }, [effectiveSelectedId, joinConversation, leaveConversation]);

    // Listen for new messages via WebSocket
    useEffect(() => {
        const handleNewMessage = (message: unknown) => {
            console.log('📨 New message received via WebSocket:', message);

            // Invalidate messages query to refetch
            queryClient.invalidateQueries({ queryKey: ['messages', effectiveSelectedId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        onNewMessage(handleNewMessage);
        onMessageCreated(handleNewMessage);
        onMessageUpdated(handleNewMessage);

        return () => {
            offNewMessage(handleNewMessage);
            offMessageCreated(handleNewMessage);
            offMessageUpdated(handleNewMessage);
        };
    }, [effectiveSelectedId, onNewMessage, offNewMessage, onMessageCreated, offMessageCreated, onMessageUpdated, offMessageUpdated, queryClient]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        (async () => {
            try {
                const list = await api.getConsultants();
                setUsers(list.map((u) => ({ id: u.id, name: u.name })));
            } catch {}
        })();
    }, []);

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

    const handleSendMessage = async () => {
        if (messageInput.trim() && effectiveSelectedId) {
            try {
                await createMessage.mutateAsync({
                    conversationId: effectiveSelectedId,
                    content: messageInput,
                    senderType: 'user',
                    type: 'text',
                });
                setMessageInput('');
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    };

    const handleAssignConversation = async () => {
        if (effectiveSelectedId) {
            try {
                await updateConversation.mutateAsync({
                    id: effectiveSelectedId,
                    data: {
                        status: 'active',
                        agentId: null,
                        assignedToId: user?.id
                    },
                });
            } catch (error) {
                console.error('Error assigning conversation:', error);
            }
        }
    };

    const handleCloseConversation = async () => {
        if (effectiveSelectedId) {
            try {
                await updateConversation.mutateAsync({
                    id: effectiveSelectedId,
                    data: { status: 'closed' },
                });
            } catch (error) {
                console.error('Error closing conversation:', error);
            }
        }
    };

    const filteredConversations = conversations?.filter((conv) => {
        if (filter === 'all') return true;
        return conv.status === filter;
    }) || [];

    const currentConversation = conversations?.find((c) => c.id === effectiveSelectedId);

    // Selection derived via effectiveSelectedId; no effect needed

    return (
        <div className="flex flex-col h-screen">
            <Header title="Conversas" description="Gerencie suas conversas em tempo real" />

            <div className="flex-1 flex overflow-hidden">
                {/* Conversation List - Left Column */}
                <div className="w-80 border-r border-border flex flex-col bg-background-secondary">
                    {/* Search */}
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Buscar conversas..."
                                className="input pl-10 w-full"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b border-border flex gap-2">
                        <Button
                            size="sm"
                            variant={filter === 'all' ? 'primary' : 'ghost'}
                            onClick={() => setFilter('all')}
                        >
                            Todas
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === 'active' ? 'primary' : 'ghost'}
                            onClick={() => setFilter('active')}
                        >
                            Ativas
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === 'waiting' ? 'primary' : 'ghost'}
                            onClick={() => setFilter('waiting')}
                        >
                            Aguardando
                        </Button>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                        {conversationsLoading ? (
                            <div className="p-4 text-center text-gray-500">Carregando...</div>
                        ) : filteredConversations.length > 0 ? (
                            filteredConversations.map((conv) => {
                                const displayName = (conv.lead?.name || conv.contactName || conv.contactIdentifier || 'Contato').trim();
                                const identifier = conv.contactIdentifier || conv.lead?.email || conv.lead?.phone || '';
                                const last = conv.messages?.[0]?.content || conv.messages?.[conv.messages.length - 1]?.content || 'Sem mensagens';
                                return (
                                    <ConversationItem
                                        key={conv.id}
                                        id={conv.id}
                                        contactName={displayName}
                                        contactIdentifier={identifier}
                                        lastMessage={last}
                                        timestamp={new Date(conv.lastMessageAt).toISOString()}
                                        status={conv.status}
                                        isSelected={effectiveSelectedId === conv.id}
                                        onClick={() => setSelectedConversationId(conv.id)}
                                    />
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-500">
                                Nenhuma conversa encontrada
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Area - Middle Column */}
                {effectiveSelectedId && currentConversation ? (
                    <div className="flex-1 flex flex-col">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-border bg-background-secondary flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h3 className="font-semibold text-neutral-900">{currentConversation.contactName || currentConversation.lead?.name || currentConversation.contactIdentifier}</h3>
                                    <p className="text-sm text-neutral-700">{currentConversation.contactIdentifier || currentConversation.lead?.email || currentConversation.lead?.phone}</p>
                                </div>
                                {/* WebSocket Status */}
                                <div className="flex items-center gap-1 text-xs">
                                    {isConnected ? (
                                        <>
                                            <Wifi className="h-3 w-3 text-success" />
                                            <span className="text-success">Online</span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="h-3 w-3 text-error" />
                                            <span className="text-error">Offline</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSyncMessages}
                                    title="Sincronizar Mensagens"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Badge variant={currentConversation.status === 'active' ? 'success' : 'default'}>
                                    {currentConversation.status}
                                </Badge>
                                <Button size="sm" variant="secondary" onClick={handleAssignConversation}>
                                    Assumir
                                </Button>
                                <button className="p-2 hover:bg-surface rounded-md transition-colors">
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4 bg-white">
                            {messages && messages.length > 0 ? (
                                messages.map((message) => (
                                    <MessageBubble
                                        key={message.id}
                                        type={message.senderType}
                                        content={message.content}
                                        timestamp={new Date(message.createdAt).toISOString()}
                                        confidence={message.confidence}
                                        messageType={message.type}
                                        attachments={message.attachments}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-gray-500">Nenhuma mensagem ainda</div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 border-t border-border bg-background-secondary">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            />
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <textarea
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Digite sua mensagem..."
                                        className="input resize-none"
                                        rows={1}
                                        disabled={createMessage.isPending}
                                    />
                                </div>
                                <button 
                                    type="button"
                                    className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-surface rounded-md transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Anexar arquivo"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    className={`p-2 rounded-md transition-colors ${isRecording ? 'text-red-500 hover:text-red-600 bg-red-50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-surface'}`}
                                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    title={isRecording ? "Parar e enviar" : "Gravar áudio"}
                                >
                                    {isRecording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
                                </button>
                                <Button onClick={handleSendMessage} disabled={createMessage.isPending || isRecording}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Selecione uma conversa para começar
                    </div>
                )}

                {/* Lead Details - Right Column */}
                {selectedConversationId && currentConversation && (
                    <div className="w-80 border-l border-border bg-background-secondary p-6 overflow-y-auto scrollbar-thin">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-semibold text-neutral-900">
                                            {currentConversation.lead?.name || currentConversation.contactName || currentConversation.contactIdentifier}
                                        </h3>
                                        {(currentConversation.lead?.company || currentConversation.lead?.position) && (
                                            <p className="text-neutral-700 mt-1">
                                                {currentConversation.lead?.company} {currentConversation.lead?.position && `• ${currentConversation.lead?.position}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {currentConversation.lead && (
                                    <div className="flex items-center gap-3">
                                        {getTemperatureBadge(currentConversation.lead.temperature)}
                                        {getStatusBadge(currentConversation.lead.status)}
                                        {(() => {
                                            const name = getAssignedName(currentConversation.lead);
                                            return name ? (
                                                <span className="text-sm text-neutral-700">Delegado: {name}</span>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(currentConversation.lead?.email || currentConversation.contactIdentifier?.includes('@')) && (
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Email</p>
                                            <p className="text-sm flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                {currentConversation.lead?.email || currentConversation.contactIdentifier}
                                            </p>
                                        </div>
                                    )}
                                    {(currentConversation.lead?.phone || (currentConversation.contactIdentifier && !currentConversation.contactIdentifier.includes('@'))) && (
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Telefone</p>
                                            <p className="text-sm flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                {currentConversation.lead?.phone || currentConversation.contactIdentifier}
                                            </p>
                                        </div>
                                    )}
                                    {currentConversation.lead?.company && (
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Empresa</p>
                                            <p className="text-sm flex items-center gap-2">
                                                <Building className="h-4 w-4" />
                                                {currentConversation.lead.company}
                                            </p>
                                        </div>
                                    )}
                                    {currentConversation.lead?.source && (
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Origem</p>
                                            <Badge variant="default">{currentConversation.lead.source}</Badge>
                                        </div>
                                    )}
                                </div>
                                {currentConversation.lead?.interest && (
                                    <div>
                                        <p className="text-sm text-text-tertiary mb-2">Interesse</p>
                                        <p className="text-sm">{currentConversation.lead.interest}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Última mensagem</p>
                                    <p className="text-sm">
                                        {formatDistanceToNow(new Date(currentConversation.lastMessageAt), {
                                            addSuffix: true,
                                            locale: ptBR,
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="primary"
                                    className="w-full"
                                    onClick={handleAssignConversation}
                                    disabled={updateConversation.isPending}
                                >
                                    Assumir Conversa
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => setShowLeadModal(true)}
                                    disabled={!currentConversation.lead?.id}
                                >
                                    Ver detalhes do Lead
                                </Button>
                                {currentConversation.lead && (
                                    <DelegateLeadButton
                                        lead={currentConversation.lead}
                                        currentUserRole={String(user?.role || '').toLowerCase()}
                                        onDelegated={() => {}}
                                    />
                                )}
                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    onClick={handleCloseConversation}
                                    disabled={updateConversation.isPending}
                                >
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {showLeadModal && currentConversation?.lead?.id && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setShowLeadModal(false)}
                >
                    <Card
                        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <LeadDetailsModalContent leadId={currentConversation.lead.id} onClose={() => setShowLeadModal(false)} />
                    </Card>
                </div>
            )}
        </div>
    );
}

function LeadDetailsModalContent({ leadId, onClose }: { leadId: string; onClose: () => void }) {
    const { data: lead } = useLead(leadId);
    const { user } = useAuth();
    if (!lead) return null;
    const getTemperatureBadge = (temp: 'hot' | 'warm' | 'cold') => {
        const variants = { hot: 'hot' as const, warm: 'warm' as const, cold: 'cold' as const };
        const labels = { hot: 'QUENTE', warm: 'MORNO', cold: 'FRIO' };
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
    return (
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
                <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="flex items-center gap-4">
                {getTemperatureBadge(lead.temperature)}
                {getStatusBadge(lead.status)}
                {(() => {
                    const name = (lead.assignedTo?.name || '').trim();
                    return name ? <span className="text-sm text-neutral-700">Delegado: {name}</span> : null;
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
                <OutcomeButton lead={lead} onClose={onClose} />
                <EditLeadButton lead={lead} />
                <DelegateLeadButton lead={lead} currentUserRole={String(user?.role || '').toLowerCase()} onDelegated={onClose} />
                <Button variant="secondary" size="sm" onClick={onClose}>
                    Fechar
                </Button>
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
                        <div key={c.id} className="p-2 rounded-md bg-neutral-100 border border-neutral-300">
                            <p className="text-sm">{c.content}</p>
                            <p className="text-xs text-text-tertiary mt-1">
                                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
                            </p>
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
                                        className="w-full border border-neutral-300 rounded-md p-2 text-sm"
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
                                                className="w-full border border-neutral-300 rounded-md p-2 text-sm"
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
    const queryClient = useQueryClient();

    const handleOpen = async () => {
        if (!canDelegate) return;
        setOpen(true);
        try {
            setLoadingUsers(true);
            const list = await api.getConsultants();
            setUsers(list);
            setSuggestions(list.map((u) => ({ id: u.id, name: u.name, email: u.email })));
            setSelectedUserId('');
            setQuery('');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSearch = async (text: string) => {
        setQuery(text);
        if (!text.trim()) {
            setSuggestions(users.map((u) => ({ id: u.id, name: u.name, email: u.email })));
            return;
        }
        try {
            setSearching(true);
            const list = await api.searchUsers(text);
            const uniq = new Map(list.map((u) => [u.id, u]));
            setSuggestions(Array.from(uniq.values()).map((u) => ({ id: u.id, name: u.name, email: u.email })));
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
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            setOpen(false);
            onDelegated();
        } catch (error: unknown) {
            const e = error as { response?: { data?: { message?: string } }; message?: string };
            toast.error(e.response?.data?.message || e.message || 'Erro ao delegar lead');
        }
    };

    return (
        <>
            <Button size="sm" variant="secondary" className="w-full" onClick={handleOpen} disabled={!canDelegate}>Delegar</Button>
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
                                <Button size="sm" className="h-12 px-5 text-sm" onClick={handleDelegate} isLoading={delegateLead.isPending}>Delegar</Button>
                                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
