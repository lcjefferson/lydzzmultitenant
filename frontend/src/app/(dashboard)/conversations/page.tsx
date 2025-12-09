'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConversationItem } from '@/components/chat/conversation-item';
import { MessageBubble } from '@/components/chat/message-bubble';
import { Search, Send, Paperclip, MoreVertical, User, Wifi, WifiOff } from 'lucide-react';
import { useConversations, useConversation, useUpdateConversation } from '@/hooks/api/use-conversations';
import { useMessages, useCreateMessage } from '@/hooks/api/use-messages';
import { useSocket } from '@/hooks/use-socket';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'next/navigation';

export default function ConversationsPage() {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'waiting'>('all');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

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

    const { data: selectedConversation } = useConversation(effectiveSelectedId || '');
    const { data: messages } = useMessages(effectiveSelectedId || '');
    const createMessage = useCreateMessage();
    const updateConversation = useUpdateConversation();

    // WebSocket connection
    const { isConnected, joinConversation, leaveConversation, onNewMessage, offNewMessage, onMessageCreated, offMessageCreated } = useSocket();

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

        return () => {
            offNewMessage(handleNewMessage);
            offMessageCreated(handleNewMessage);
        };
    }, [effectiveSelectedId, onNewMessage, offNewMessage, onMessageCreated, offMessageCreated, queryClient]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                    data: { status: 'active' },
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
                            filteredConversations.map((conv) => (
                                <ConversationItem
                                    key={conv.id}
                                    id={conv.id}
                                    contactName={conv.contactName}
                                    contactIdentifier={conv.contactIdentifier}
                                    lastMessage={conv.messages?.[conv.messages.length - 1]?.content || 'Sem mensagens'}
                                    timestamp={new Date(conv.lastMessageAt).toISOString()}
                                    status={conv.status}
                                    isSelected={effectiveSelectedId === conv.id}
                                    onClick={() => setSelectedConversationId(conv.id)}
                                />
                            ))
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
                                    <h3 className="font-semibold">{currentConversation.contactName}</h3>
                                    <p className="text-sm text-text-secondary">{currentConversation.contactIdentifier}</p>
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
                        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
                            {messages && messages.length > 0 ? (
                                messages.map((message) => (
                                    <MessageBubble
                                        key={message.id}
                                        type={message.senderType}
                                        content={message.content}
                                        timestamp={new Date(message.createdAt).toISOString()}
                                        confidence={message.confidence}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-gray-500">Nenhuma mensagem ainda</div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 border-t border-border bg-background-secondary">
                            <div className="flex items-end gap-2">
                                <button className="p-2 hover:bg-surface rounded-md transition-colors">
                                    <Paperclip className="h-5 w-5" />
                                </button>
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
                                <Button onClick={handleSendMessage} disabled={createMessage.isPending}>
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
                            {/* Lead Info */}
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                                        <User className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{currentConversation.contactName}</h3>
                                        <Badge variant="default">Contato</Badge>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-text-tertiary">Identificador</p>
                                        <p className="text-sm">{currentConversation.contactIdentifier}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-text-tertiary">Status</p>
                                        <p className="text-sm capitalize">{currentConversation.status}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-text-tertiary">Última mensagem</p>
                                        <p className="text-sm">
                                            {formatDistanceToNow(new Date(currentConversation.lastMessageAt), {
                                                addSuffix: true,
                                                locale: ptBR,
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div>
                                <h4 className="font-semibold mb-3">🎯 Ações</h4>
                                <div className="space-y-2">
                                    <Button
                                        variant="primary"
                                        className="w-full"
                                        onClick={handleAssignConversation}
                                        disabled={updateConversation.isPending}
                                    >
                                        Assumir Conversa
                                    </Button>
                                    <Button variant="secondary" className="w-full">
                                        Transferir
                                    </Button>
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
                    </div>
                )}
            </div>
        </div>
    );
}
