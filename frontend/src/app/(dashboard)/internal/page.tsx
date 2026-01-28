'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageBubble } from '@/components/chat/message-bubble';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, MessageSquare, Send } from 'lucide-react';

export default function InternalChatPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'rooms' | 'dms'>('rooms');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const roomsQuery = useQuery({ queryKey: ['internal', 'rooms'], queryFn: () => api.getInternalRooms() });
  const dmsQuery = useQuery({ queryKey: ['internal', 'dms'], queryFn: () => api.listInternalDMs() });

  const messagesQuery = useQuery({
    queryKey: ['internal', tab, selectedId, 'messages'],
    queryFn: async () => {
      if (!selectedId) return [] as Array<{ id: string; content: string; user?: { id: string; name: string; email: string }; createdAt: string }>;
      return tab === 'rooms' ? api.getInternalMessages(selectedId) : api.getInternalDMMessages(selectedId);
    },
    enabled: !!selectedId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedId) return;
      return tab === 'rooms' ? api.sendInternalMessage(selectedId, content) : api.sendInternalDMMessage(selectedId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal', tab, selectedId, 'messages'] });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data]);

  const items = useMemo(() => (tab === 'rooms' ? roomsQuery.data || [] : dmsQuery.data || []), [tab, roomsQuery.data, dmsQuery.data]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Chat Interno" description="Mensagens entre equipe e DMs internas" />
      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full md:w-80 border-r border-border bg-background-secondary flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border flex gap-2">
            <Button size="sm" variant={tab === 'rooms' ? 'primary' : 'ghost'} onClick={() => setTab('rooms')}>Salas</Button>
            <Button size="sm" variant={tab === 'dms' ? 'primary' : 'ghost'} onClick={() => setTab('dms')}>DMs</Button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {items.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Nenhum item</div>
            ) : (
              items.map((it) => (
                <button key={it.id} className={`w-full p-4 flex items-start gap-3 hover:bg-slate-800 transition-colors border-b border-border text-left ${selectedId === it.id ? 'bg-slate-900' : ''}`} onClick={() => setSelectedId(it.id)}>
                  <div className="h-2 w-2 rounded-full mt-2 flex-shrink-0 bg-info" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <h4 className={`font-medium truncate ${selectedId === it.id ? 'text-white' : 'text-neutral-900'}`}>{'name' in it ? it.name : 'Sala'}</h4>
                        <p className={`text-xs truncate ${selectedId === it.id ? 'text-gray-300' : 'text-text-tertiary'}`}>{it.lastMessage || ''}</p>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${selectedId === it.id ? 'text-gray-300' : 'text-text-tertiary'}`}>{new Date(it.lastMessageAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border bg-background-secondary flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                {tab === 'rooms' ? <Users className="h-5 w-5 text-white" /> : <MessageSquare className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">{tab === 'rooms' ? 'Sala' : 'DM'}</h3>
                <p className="text-sm text-neutral-700">{selectedId || 'Selecione um item'}</p>
              </div>
            </div>
            <Badge variant="default">Interno</Badge>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4 bg-white">
            {messagesQuery.data && messagesQuery.data.length > 0 ? (
              messagesQuery.data.map((m) => (
                <MessageBubble key={m.id} type={m.user ? 'user' : 'contact'} content={m.content} timestamp={new Date(m.createdAt).toISOString()} />
              ))
            ) : (
              <div className="text-center text-gray-500">Nenhuma mensagem ainda</div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-4 border-t border-border bg-background-secondary">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (messageInput.trim() && selectedId) {
                        void sendMutation.mutateAsync(messageInput.trim());
                        setMessageInput('');
                      }
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  className="input resize-none"
                  rows={1}
                  disabled={sendMutation.isPending || !selectedId}
                />
              </div>
              <Button onClick={() => { if (messageInput.trim() && selectedId) { void sendMutation.mutateAsync(messageInput.trim()); setMessageInput(''); } }} disabled={sendMutation.isPending || !selectedId}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
