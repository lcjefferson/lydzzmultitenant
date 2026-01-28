'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Search } from 'lucide-react';
import { useInternalUsers, useInternalDMs, useOpenInternalDM, useInternalDMMessages, useSendInternalDMMessage } from '@/hooks/api/use-internal-chat';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/hooks/use-socket';

export default function InternalChatPage() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const canDM = ['admin', 'manager'].includes(role);

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');

  const usersQuery = useInternalUsers();
  const dmsQuery = useInternalDMs();
  const openDM = useOpenInternalDM();
  const messagesQuery = useInternalDMMessages(selectedConvId || '');
  const sendMessage = useSendInternalDMMessage(selectedConvId || '');

  const dms = dmsQuery.data || [];
  const suggestions = useMemo(() => {
    const list = usersQuery.data || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [usersQuery.data, query]);

  const messages = messagesQuery.data || [];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const { joinConversation, leaveConversation, emitTyping, onTyping, offTyping } = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedConvId]);

  useEffect(() => {
    if (!selectedConvId) return;
    joinConversation(selectedConvId);
    const handleTyping = (p: { conversationId: string }) => {
      if (p.conversationId !== selectedConvId) return;
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
    };
    onTyping(handleTyping);
    return () => {
      leaveConversation(selectedConvId);
      offTyping(handleTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [selectedConvId, joinConversation, leaveConversation, onTyping, offTyping]);

  const handleOpenDM = async (targetUserId: string) => {
    if (!canDM) return;
    try {
      const conv = await openDM.mutateAsync(targetUserId);
      setSelectedConvId(conv.id);
    } catch {}
  };

  const handleSend = async () => {
    const text = content.trim();
    if (!selectedConvId || !text) return;
    try {
      await sendMessage.mutateAsync(text);
      setContent('');
    } catch {}
  };

  return (
    <div>
      <Header title="Chat Interno" description="Converse internamente com sua equipe" />
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card className="p-4 bg-[#111b21] border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                label="Buscar usuário"
                placeholder="Digite nome ou email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-[#202c33] border-none text-white focus:ring-0 placeholder-gray-400"
              />
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="text-sm text-gray-400">Sem usuários</div>
              ) : (
                suggestions.map((u) => (
                  <button
                    key={u.id}
                    className={`w-full text-left px-3 py-2 rounded-md border border-transparent hover:bg-white group transition-colors ${!canDM ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleOpenDM(u.id)}
                    disabled={!canDM}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-50 group-hover:text-neutral-900">{u.name}</span>
                      <span className="text-xs text-gray-400 group-hover:text-neutral-500">{u.email}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs text-gray-500">Somente <span className="font-medium">admin</span> e <span className="font-medium">gerente</span> podem iniciar conversas diretas.</p>
            </div>
          </Card>
          <Card className="p-4 mt-4 bg-[#111b21] border-white/10">
            <p className="text-sm font-medium text-gray-50 mb-2">Recentes</p>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto">
              {(dms || []).length === 0 ? (
                <div className="text-sm text-gray-400">Sem conversas</div>
              ) : (
                (dms || []).map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left px-3 py-2 rounded-md border transition-colors group ${selectedConvId === c.id ? 'bg-white border-transparent' : 'border-transparent hover:bg-white'}`}
                    onClick={() => setSelectedConvId(c.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${selectedConvId === c.id ? 'text-neutral-900' : 'text-gray-50 group-hover:text-neutral-900'}`}>{c.name}</span>
                      {c.lastMessageAt && (
                        <span className={`text-xs ${selectedConvId === c.id ? 'text-neutral-500' : 'text-gray-400 group-hover:text-neutral-500'}`}>{new Date(c.lastMessageAt).toLocaleString()}</span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <p className={`text-xs truncate mt-1 ${selectedConvId === c.id ? 'text-neutral-700' : 'text-gray-300 group-hover:text-neutral-700'}`}>{c.lastMessage}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="md:col-span-3">
          {selectedConvId ? (
            <Card className="flex flex-col h-[70vh]">
              <div className="p-4 border-b border-border bg-background-secondary">
                <p className="text-sm font-semibold text-neutral-900">{(dms.find((c) => c.id === selectedConvId)?.name) || 'Conversa'}</p>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-text-secondary">Sem mensagens</div>
                ) : (
                  messages.map((m) => (
                    <Card key={m.id} className="p-3">
                      <div className="text-sm">
                        <span className="font-semibold text-neutral-900">{m.user?.name || 'Usuário'}</span>
                        <span className="text-neutral-700 ml-2">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[13px] mt-1 text-neutral-900 whitespace-pre-wrap">{m.content}</p>
                    </Card>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border bg-background-secondary flex items-center gap-2">
              <Input
                label="Mensagem"
                value={content}
                onChange={(e) => {
                  const v = e.target.value;
                  setContent(v);
                  const now = Date.now();
                  if (selectedConvId && now - lastTypingSentRef.current > 600) {
                    lastTypingSentRef.current = now;
                    emitTyping(selectedConvId, user?.id, user?.name || 'Usuário');
                  }
                }}
                className="flex-1 bg-white border-neutral-300 text-neutral-900 focus:border-primary-500 focus:ring-primary-500/20 placeholder:text-neutral-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
              />
              {isTyping && (
                <div className="text-xs text-text-secondary">Digitando...</div>
              )}
                <Button onClick={handleSend} isLoading={sendMessage.isPending}>
                  <Send className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="h-[70vh] flex items-center justify-center">
              <div className="text-text-secondary">Selecione um usuário para conversar</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
