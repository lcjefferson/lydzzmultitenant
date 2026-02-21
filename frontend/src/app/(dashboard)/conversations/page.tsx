'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConversationItem } from '@/components/chat/conversation-item';
import { MessageBubble } from '@/components/chat/message-bubble';
import { Search, Send, Paperclip, MoreVertical, Wifi, WifiOff, Mail, MailPlus, Phone, Building, X, Mic, Square, RefreshCw, ArrowLeft } from 'lucide-react';
import { useConversations, useUpdateConversation, useMarkConversationAsRead, useMarkConversationAsUnread } from '@/hooks/api/use-conversations';
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

// Mock Data
const MOCK_CONVERSATION = {
    id: 'mock-1',
    contactName: 'Ana Silva',
    contactIdentifier: '+55 11 99999-9999',
    status: 'active' as const,
    channelId: 'mock-channel',
    organizationId: 'mock-org',
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [
        {
            id: 'm1',
            conversationId: 'mock-1',
            content: 'Olá! Gostaria de saber mais sobre os planos.',
            senderType: 'contact' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
            updatedAt: new Date(Date.now() - 1000 * 60 * 60)
        },
        {
            id: 'm2',
            conversationId: 'mock-1',
            content: 'Claro, Ana! Temos opções Starter, Professional e Enterprise. Qual o tamanho da sua equipe?',
            senderType: 'user' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
            updatedAt: new Date(Date.now() - 1000 * 60 * 30)
        },
        {
            id: 'm3',
            conversationId: 'mock-1',
            content: 'Somos em 15 pessoas atualmente.',
            senderType: 'contact' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() - 1000 * 60 * 25),
            updatedAt: new Date(Date.now() - 1000 * 60 * 25)
        },
        {
            id: 'm4',
            conversationId: 'mock-1',
            content: 'Entendi. O plano Professional seria ideal para vocês.',
            senderType: 'user' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() - 1000 * 60 * 20),
            updatedAt: new Date(Date.now() - 1000 * 60 * 20)
        },
        {
            id: 'm5',
            conversationId: 'mock-1',
            content: '',
            senderType: 'contact' as const,
            type: 'image' as const,
            attachments: { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80' },
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
            updatedAt: new Date(Date.now() - 1000 * 60 * 15)
        },
        {
            id: 'm6',
            conversationId: 'mock-1',
            content: 'Aqui está uma foto do nosso escritório atual.',
            senderType: 'contact' as const,
            type: 'text' as const,
            createdAt: new Date(Date.now() - 1000 * 60 * 14),
            updatedAt: new Date(Date.now() - 1000 * 60 * 14)
        }
    ]
};

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

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return isMobile;
}

export default function ConversationsPage() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'unanswered'>('all');
    const isMobile = useIsMobile();
    const markAsRead = useMarkConversationAsRead();
    const markAsUnread = useMarkConversationAsUnread();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const queryClient = useQueryClient();
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [showConversationMenu, setShowConversationMenu] = useState(false);
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

    const { data: apiConversations, isLoading: conversationsLoading } = useConversations();
    // Use mock if no conversations are found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversations = (apiConversations && apiConversations.length > 0) ? apiConversations : [MOCK_CONVERSATION as any];

    const searchParams = useSearchParams();
    const contactParam = searchParams.get('contact');
    const convParam = searchParams.get('conversationId');

    const preselectedFromContact = contactParam && conversations
        ? conversations.find((c) => c.contactIdentifier === contactParam)?.id || null
        : null;
    const preselectedFromParamId = convParam || null;
    // No mobile: quando o usuário clica em Voltar (selectedConversationId = null), não usar fallback — assim a lista de conversas volta a aparecer
    const effectiveSelectedId = isMobile && selectedConversationId === null
        ? null
        : (selectedConversationId
            ?? preselectedFromParamId
            ?? preselectedFromContact
            ?? (conversations && conversations.length > 0 ? conversations[0].id : null));

    const { data: apiMessages } = useMessages(effectiveSelectedId || '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = effectiveSelectedId === 'mock-1' ? (MOCK_CONVERSATION.messages as any[]) : apiMessages;
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
            console.error('Upload error:', error);
            let errorMsg = 'Erro ao enviar arquivo';
            
            if (error && typeof error === 'object' && 'response' in error) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const err = error as any;
                errorMsg = err.response?.data?.message || errorMsg;
            } else if (error instanceof Error) {
                errorMsg = error.message;
            }
            
            toast.error(`Erro: ${errorMsg}`);
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

            // Mark as read if needed
            const conv = conversations?.find(c => c.id === effectiveSelectedId);
            if (conv && (conv.unreadCount || 0) > 0) {
                markAsRead.mutate(effectiveSelectedId);
            }

            return () => {
                leaveConversation(effectiveSelectedId);
            };
        }
    }, [effectiveSelectedId, joinConversation, leaveConversation, conversations, markAsRead]);

    // Listen for new messages via WebSocket (tempo real no omnichannel)
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleNewMessage = (message: any) => {
            const convId = message.conversationId ?? message.conversation?.id;
            const isForCurrent = effectiveSelectedId && convId === effectiveSelectedId;

            // Atualização otimista: exibe a mensagem na hora na conversa atual
            if (isForCurrent && convId) {
                queryClient.setQueryData(
                    ['messages', convId],
                    (old: typeof messages | undefined) => {
                        const list = Array.isArray(old) ? old : [];
                        const hasId = message.id && list.some((m: { id: string }) => m.id === message.id);
                        if (hasId) return list;
                        const normalized = {
                            id: message.id,
                            conversationId: convId,
                            content: message.content ?? '',
                            senderType: message.senderType ?? 'contact',
                            type: message.type ?? 'text',
                            attachments: message.attachments,
                            createdAt: message.createdAt ?? new Date(),
                            updatedAt: message.updatedAt ?? new Date(),
                        };
                        return [...list, normalized];
                    }
                );
            }

            queryClient.invalidateQueries({ queryKey: ['messages', effectiveSelectedId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });

            if (isForCurrent) {
                markAsRead.mutate(effectiveSelectedId);
            }
        };

        // messageUpdated: atualizar mensagem existente no cache (ex.: anexos)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleMessageUpdated = (message: any) => {
            const convId = message.conversationId ?? message.conversation?.id;
            if (!convId || !message.id) return;
            queryClient.setQueryData(
                ['messages', convId],
                (old: typeof messages | undefined) => {
                    const list = Array.isArray(old) ? old : [];
                    const idx = list.findIndex((m: { id: string }) => m.id === message.id);
                    if (idx === -1) return list;
                    const normalized = {
                        ...list[idx],
                        ...message,
                        createdAt: message.createdAt ?? list[idx].createdAt,
                        updatedAt: message.updatedAt ?? new Date(),
                    };
                    const next = [...list];
                    next[idx] = normalized;
                    return next;
                }
            );
            queryClient.invalidateQueries({ queryKey: ['messages', convId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
        };

        onNewMessage(handleNewMessage);
        onMessageCreated(handleNewMessage);
        onMessageUpdated(handleMessageUpdated);

        return () => {
            offNewMessage(handleNewMessage);
            offMessageCreated(handleNewMessage);
            offMessageUpdated(handleMessageUpdated);
        };
    }, [effectiveSelectedId, onNewMessage, offNewMessage, onMessageCreated, offMessageCreated, onMessageUpdated, offMessageUpdated, queryClient, markAsRead]);

    // Ao abrir uma conversa ou quando as mensagens mudam, rolar até a última mensagem
    const messagesLength = messages?.length ?? 0;
    useEffect(() => {
        if (!effectiveSelectedId || messagesLength === 0) return;
        const scrollToBottom = () => {
            const container = messagesContainerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
            }
        };
        const id1 = requestAnimationFrame(() => {
            requestAnimationFrame(scrollToBottom);
        });
        const t2 = setTimeout(scrollToBottom, 120);
        const t3 = setTimeout(scrollToBottom, 400);
        return () => {
            cancelAnimationFrame(id1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [effectiveSelectedId, messagesLength]);

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
            const currentMessage = messageInput;
            
            // Optimistic clear and focus
            setMessageInput('');
            setTimeout(() => {
                if (messageInputRef.current) {
                    messageInputRef.current.focus();
                }
            }, 0);

            try {
                await createMessage.mutateAsync({
                    conversationId: effectiveSelectedId,
                    content: currentMessage,
                    senderType: 'user',
                    type: 'text',
                });
            } catch (error) {
                console.error('Error sending message:', error);
                setMessageInput(currentMessage);
            } finally {
                // Ensure focus returns
                setTimeout(() => {
                    if (messageInputRef.current) {
                        messageInputRef.current.focus();
                    }
                }, 50);
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
        let matchesFilter = true;
        if (filter === 'unread') {
            matchesFilter = (conv.unreadCount || 0) > 0;
        } else if (filter === 'unanswered') {
            const read = (conv.unreadCount || 0) === 0;
            const lastMsg = conv.messages?.[0];
            const lastFromContact = lastMsg?.senderType === 'contact';
            matchesFilter = read && !!lastFromContact;
        }
        if (!searchTerm) return matchesFilter;

        const searchLower = searchTerm.toLowerCase();
        const contactName = (conv.contactName || '').toLowerCase();
        const contactIdentifier = (conv.contactIdentifier || '').toLowerCase();
        const leadName = (conv.lead?.name || '').toLowerCase();
        const leadEmail = (conv.lead?.email || '').toLowerCase();
        const leadPhone = (conv.lead?.phone || '').toLowerCase();

        const matchesSearch = contactName.includes(searchLower) ||
            contactIdentifier.includes(searchLower) ||
            leadName.includes(searchLower) ||
            leadEmail.includes(searchLower) ||
            leadPhone.includes(searchLower);

        return matchesFilter && matchesSearch;
    }) || [];

    const [isExporting, setIsExporting] = useState(false);

    const getFormattedDateTime = () => {
        const date = new Date();
        const formattedDate = date.toISOString().split('T')[0];
        const formattedTime = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `${formattedDate}_${formattedTime}`;
    };

    const handleExportExcel = async () => {
        if (!filteredConversations.length) {
            toast.error('Não há conversas para exportar.');
            return;
        }

        try {
            setIsExporting(true);
            const XLSX = await import('xlsx');
            const rows = filteredConversations.map((conv) => ({
                Contato: (conv.lead?.name || conv.contactName || conv.contactIdentifier || 'Contato').trim(),
                Identificador: conv.contactIdentifier || conv.lead?.email || conv.lead?.phone || '',
                Status: conv.status,
                'Última Mensagem': conv.messages?.[0]?.content || conv.messages?.[conv.messages.length - 1]?.content || 'Sem mensagens',
                'Data Última Mensagem': new Date(conv.lastMessageAt).toLocaleString('pt-BR'),
                'Agente': conv.agentId ? 'Sim' : 'Não',
                'Atribuído a': getAssignedName(conv) || '-'
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Conversas");
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
        if (!filteredConversations.length) {
            toast.error('Não há conversas para exportar.');
            return;
        }

        try {
            setIsExporting(true);
            const [jsPDF, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
            const doc = new jsPDF.default();
            const filename = `leads_${getFormattedDateTime()}.pdf`;

            doc.text(`Relatório de Conversas - ${new Date().toLocaleString('pt-BR')}`, 14, 15);
            
            const tableHeaders = ['Contato', 'Identificador', 'Status', 'Última Msg', 'Data'];
            const tableRows = filteredConversations.map((conv) => [
                (conv.lead?.name || conv.contactName || conv.contactIdentifier || 'Contato').trim(),
                conv.contactIdentifier || conv.lead?.email || conv.lead?.phone || '',
                conv.status,
                (conv.messages?.[0]?.content || conv.messages?.[conv.messages.length - 1]?.content || 'Sem mensagens').substring(0, 30) + '...',
                new Date(conv.lastMessageAt).toLocaleString('pt-BR')
            ]);

            autoTable.default(doc, {
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

    const currentConversation = conversations?.find((c) => c.id === effectiveSelectedId);

    // Selection derived via effectiveSelectedId; no effect needed

    return (
        <div className="flex flex-col h-screen min-h-[100dvh] max-h-[100dvh] md:max-h-none">
            <Header title="Conversas" description="Gerencie suas conversas em tempo real" />

            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Conversation List - Left Column: full width on mobile when no chat open; sidebar on desktop */}
                <div
                    className={`
                        w-full md:w-80 border-r border-white/10 flex-col bg-[#111b21] flex
                        ${effectiveSelectedId ? 'hidden md:flex' : ''}
                    `}
                >
                    {/* Search */}
                    <div className="p-2 sm:p-3 border-b border-white/10 bg-[#202c33]">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar conversas..."
                                className="block w-full pl-10 pr-3 py-2.5 sm:py-2 border-none rounded-lg leading-5 bg-[#111b21] text-white placeholder-gray-400 focus:outline-none focus:ring-0 text-base sm:text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-2 sm:p-4 border-b border-white/10 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none flex-nowrap sm:flex-wrap">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFilter('all')}
                            className={`min-h-[40px] sm:min-h-0 shrink-0 ${filter === 'all' ? "bg-[#00a884] hover:bg-[#008f6f] text-white" : "text-neutral-300 hover:bg-white hover:text-neutral-900"}`}
                        >
                            Todas
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFilter('unread')}
                            className={`min-h-[40px] sm:min-h-0 shrink-0 ${filter === 'unread' ? "bg-[#00a884] hover:bg-[#008f6f] text-white" : "text-neutral-300 hover:bg-white hover:text-neutral-900"}`}
                        >
                            Não lidas
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFilter('unanswered')}
                            className={`min-h-[40px] sm:min-h-0 shrink-0 ${filter === 'unanswered' ? "bg-[#00a884] hover:bg-[#008f6f] text-white" : "text-neutral-300 hover:bg-white hover:text-neutral-900"}`}
                        >
                            Não respondidas
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
                                        contactTag={conv.contactTag}
                                        lastMessage={last}
                                        timestamp={new Date(conv.lastMessageAt).toISOString()}
                                        status={conv.status}
                                        unreadCount={conv.unreadCount}
                                        isSelected={effectiveSelectedId === conv.id}
                                        onClick={() => setSelectedConversationId(conv.id)}
                                        channelType={(conv as any).channel?.type}
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

                {/* Chat Area - Middle Column: full width on mobile when conversation selected */}
                {effectiveSelectedId && currentConversation ? (
                    <div className="flex-1 flex flex-col min-w-0 w-full">
                        {/* Chat Header */}
                        <div className="p-3 sm:p-4 border-b border-border bg-background-secondary flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="md:hidden shrink-0 h-10 w-10" 
                                    onClick={() => setSelectedConversationId(null)}
                                    aria-label="Voltar para lista"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-neutral-900 truncate text-sm sm:text-base">{currentConversation.contactName || currentConversation.lead?.name || currentConversation.contactIdentifier}</h3>
                                        {currentConversation.contactTag && (
                                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 border-0 font-normal shrink-0">
                                                {currentConversation.contactTag}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-neutral-700 truncate">{currentConversation.contactIdentifier || currentConversation.lead?.email || currentConversation.lead?.phone}</p>
                                </div>
                                <div className="flex items-center gap-1 text-xs shrink-0">
                                    {isConnected ? (
                                        <>
                                            <Wifi className="h-3 w-3 text-success" />
                                            <span className="hidden sm:inline text-success">Online</span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="h-3 w-3 text-error" />
                                            <span className="hidden sm:inline text-error">Offline</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                {currentConversation.lead?.source && (
                                    <Badge variant="default" className="capitalize bg-blue-100 text-blue-800 hover:bg-blue-200 border-0 text-xs hidden sm:inline-flex">
                                        {currentConversation.lead.source.replace(/_/g, ' ')}
                                    </Badge>
                                )}
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 shrink-0"
                                    onClick={handleSyncMessages}
                                    title="Sincronizar Mensagens"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Badge variant={currentConversation.status === 'active' ? 'success' : 'default'} className="text-xs hidden sm:inline-flex">
                                    {currentConversation.status}
                                </Badge>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 text-xs sm:text-sm h-9 gap-1.5"
                                    onClick={() => markAsUnread.mutate(effectiveSelectedId!)}
                                    title="Marcar como não lida"
                                >
                                    <MailPlus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Não lida</span>
                                </Button>
                                <Button size="sm" className="bg-[#00a884] hover:bg-[#008f6f] text-white shrink-0 text-xs sm:text-sm h-9" onClick={handleAssignConversation}>
                                    Assumir
                                </Button>
                                <div className="relative shrink-0">
                                    <button
                                        type="button"
                                        className="p-2 hover:bg-surface rounded-md transition-colors"
                                        aria-label="Mais opções"
                                        onClick={() => setShowConversationMenu((v) => !v)}
                                    >
                                        <MoreVertical className="h-5 w-5" />
                                    </button>
                                    {showConversationMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowConversationMenu(false)} />
                                            <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-20">
                                                <button
                                                    type="button"
                                                    className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                                                    onClick={() => { markAsUnread.mutate(effectiveSelectedId!); setShowConversationMenu(false); }}
                                                >
                                                    Marcar como não lida
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-3 sm:p-6 space-y-3 sm:space-y-4 bg-[#efeae2]"
                        >
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
                        <div className="p-2 sm:p-4 border-t border-border bg-background-secondary shrink-0">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            />
                            <div className="flex items-center gap-2 min-h-[44px]">
                                <div className="flex-1 min-w-0 flex items-center">
                                    <textarea
                                        ref={messageInputRef}
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Digite sua mensagem..."
                                        className="w-full resize-none bg-white text-neutral-900 border border-neutral-300 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] placeholder:text-neutral-400 min-h-[44px] max-h-32 overflow-y-auto text-base align-middle"
                                        rows={1}
                                        disabled={createMessage.isPending}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="h-10 w-10 flex items-center justify-center shrink-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Anexar arquivo"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    className={`h-10 w-10 flex items-center justify-center shrink-0 rounded-lg transition-colors ${isRecording ? 'text-red-500 hover:text-red-600 bg-red-50' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'}`}
                                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    title={isRecording ? "Parar e enviar" : "Gravar áudio"}
                                >
                                    {isRecording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
                                </button>
                                <Button onClick={handleSendMessage} disabled={createMessage.isPending || isRecording} className="bg-[#00a884] hover:bg-[#008f6f] text-white shrink-0 h-10 w-10 p-0" aria-label="Enviar">
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 hidden md:flex">
                        Selecione uma conversa para começar
                    </div>
                )}

                {/* Lead Details - Right Column: hidden on mobile/tablet, visible on xl when showRightPanel */}
                {selectedConversationId && currentConversation && showRightPanel && (
                    <div className="hidden xl:block w-80 border-l border-primary-500/20 bg-white overflow-y-auto scrollbar-thin text-neutral-900 shrink-0 flex flex-col">
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 p-3 border-b border-neutral-200 bg-white">
                            <span className="text-sm font-medium text-neutral-700">Detalhes do contato</span>
                            <button
                                type="button"
                                onClick={() => setShowRightPanel(false)}
                                className="p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                                aria-label="Fechar painel"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 flex-1">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-semibold text-neutral-900">
                                            {currentConversation.lead?.name || currentConversation.contactName || currentConversation.contactIdentifier}
                                        </h3>
                                        {(currentConversation.lead?.company || currentConversation.lead?.position) && (
                                            <p className="text-neutral-600 mt-1">
                                                {currentConversation.lead?.company} {currentConversation.lead?.position && `• ${currentConversation.lead?.position}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {currentConversation.contactTag && (
                                    <div className="space-y-1">
                                        <p className="text-sm text-neutral-500">Tag do contato</p>
                                        <p className="text-sm font-medium text-neutral-900">{currentConversation.contactTag}</p>
                                        <p className="text-xs text-neutral-400">Definida automaticamente pelo canal (API Oficial ou Uazapi).</p>
                                    </div>
                                )}
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
                                            <p className="text-sm text-neutral-500 mb-1">Email</p>
                                            <p className="text-sm flex items-center gap-2 text-neutral-900">
                                                <Mail className="h-4 w-4" />
                                                {currentConversation.lead?.email || currentConversation.contactIdentifier}
                                            </p>
                                        </div>
                                    )}
                                    {(currentConversation.lead?.phone || (currentConversation.contactIdentifier && !currentConversation.contactIdentifier.includes('@'))) && (
                                        <div>
                                            <p className="text-sm text-neutral-500 mb-1">Telefone</p>
                                            <p className="text-sm flex items-center gap-2 text-neutral-900">
                                                <Phone className="h-4 w-4" />
                                                {currentConversation.lead?.phone || currentConversation.contactIdentifier}
                                            </p>
                                        </div>
                                    )}
                                    {currentConversation.lead?.company && (
                                        <div>
                                            <p className="text-sm text-neutral-500 mb-1">Empresa</p>
                                            <p className="text-sm flex items-center gap-2 text-neutral-900">
                                                <Building className="h-4 w-4" />
                                                {currentConversation.lead.company}
                                            </p>
                                        </div>
                                    )}
                                    {currentConversation.lead?.source && (
                                        <div>
                                            <p className="text-sm text-neutral-500 mb-1">Origem</p>
                                            <Badge variant="default">{currentConversation.lead.source}</Badge>
                                        </div>
                                    )}
                                </div>
                                {currentConversation.lead?.interest && (
                                    <div>
                                        <p className="text-sm text-neutral-500 mb-2">Interesse</p>
                                        <p className="text-sm">{currentConversation.lead.interest}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-neutral-500 mb-1">Última mensagem</p>
                                    <p className="text-sm text-neutral-900">
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
                {selectedConversationId && currentConversation && !showRightPanel && (
                    <button
                        type="button"
                        onClick={() => setShowRightPanel(true)}
                        className="hidden xl:flex fixed right-4 top-24 z-20 p-2 rounded-lg bg-white border border-neutral-200 shadow-md text-neutral-600 hover:bg-neutral-50"
                        aria-label="Abrir painel do contato"
                    >
                        <Building className="h-5 w-5" />
                    </button>
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
                <button 
                    onClick={onClose} 
                    className="p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
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
    const inputRef = useRef<HTMLInputElement>(null);
    const comments = commentsQuery.data || [];
    
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
                <Button size="sm" className="h-12 px-4 text-sm bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={handleAdd} isLoading={addComment.isPending}>Comentar</Button>
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
            <Button size="sm" className="bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={() => setOpen(true)}>
                Definir Resultado
            </Button>
            {open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]" onClick={() => setOpen(false)}>
                    <Card className="w-full max-w-md m-4 bg-white text-neutral-900 shadow-2xl border border-primary-500/20" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900">Resultado do Lead</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" className={status === 'Contrato fechado' ? 'bg-[#00a884] hover:bg-[#008f6f] text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} onClick={() => setStatus('Contrato fechado')}>Venda Fechada</Button>
                                <Button size="sm" className={status === 'Em Qualificação' ? 'bg-[#00a884] hover:bg-[#008f6f] text-white' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} onClick={() => setStatus('Em Qualificação')}>Sem Interesse</Button>
                            </div>
                            <Input label="Valor da Venda (R$)" value={value} onChange={(e) => setValue(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            <Input label="Detalhes" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20" />
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={handleSave} isLoading={updateLead.isPending} className="bg-[#00a884] hover:bg-[#008f6f] text-white">Salvar</Button>
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
            <Button size="sm" className="bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={() => setOpen(true)}>Editar</Button>
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
                                <Button size="sm" onClick={handleSave} isLoading={updateLead.isPending} className="bg-[#00a884] hover:bg-[#008f6f] text-white">Salvar</Button>
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
            <Button size="sm" className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={handleOpen} disabled={!canDelegate}>Delegar</Button>
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
                                <Button size="sm" className="h-12 px-5 text-sm bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={handleDelegate} isLoading={delegateLead.isPending}>Delegar</Button>
                                <Button size="sm" variant="secondary" className="h-12 px-5 text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
