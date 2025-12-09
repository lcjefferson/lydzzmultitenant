'use client';

import { Bell, Search, LogOut, User, ChevronDown } from 'lucide-react';
import type { Message } from '@/types/api';
import { useAuth } from '@/contexts/auth-context';
import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useRouter } from 'next/navigation';

interface HeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
    const { user, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const roleLabel = typeof user?.role === 'string' ? user.role : 'user';
    const { onMessageCreated, offMessageCreated } = useSocket();
    const [notifCount, setNotifCount] = useState(() => {
        try {
            const initial = Number(localStorage.getItem('unreadCount') || '0');
            return Number.isNaN(initial) ? 0 : initial;
        } catch {
            return 0;
        }
    });
    const [notifications, setNotifications] = useState<Array<{ id: string; conversationId: string; content: string; createdAt: string }>>(() => {
        try {
            const raw = localStorage.getItem('unreadItems');
            const arr = raw ? (JSON.parse(raw) as Array<{ id: string; conversationId: string; content: string; createdAt: string }>) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    });
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleMessageCreated = (message: unknown) => {
            const msg = message as Partial<Message> | null;
            if (msg?.senderType === 'contact') {
                setNotifCount((c) => {
                    const next = c + 1;
                    try {
                        localStorage.setItem('unreadCount', String(next));
                        window.dispatchEvent(new CustomEvent('unread:update', { detail: next }));
                    } catch {}
                    return next;
                });
                setNotifications((list) => {
                    const item = {
                        id: String(msg.id || crypto.randomUUID()),
                        conversationId: String(msg.conversationId || ''),
                        content: String(msg.content || ''),
                        createdAt: String(msg.createdAt ? new Date(msg.createdAt as unknown as string).toISOString() : new Date().toISOString()),
                    };
                    const next = [item, ...list].slice(0, 20);
                    try {
                        localStorage.setItem('unreadItems', JSON.stringify(next));
                    } catch {}
                    return next;
                });
            }
        };

        onMessageCreated(handleMessageCreated);
        return () => {
            offMessageCreated(handleMessageCreated);
        };
    }, [onMessageCreated, offMessageCreated]);

    return (
        <div className="border-b border-border bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center justify-between p-6">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{title}</h1>
                    {description && (
                        <p className="text-sm text-text-secondary mt-1">{description}</p>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="input pl-10 w-64"
                        />
                    </div>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            className="relative p-2 rounded-md hover:bg-surface transition-colors"
                            onClick={() => setShowNotifMenu((o) => !o)}
                        >
                        <Bell className="h-5 w-5" />
                        {notifCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-error text-white text-xs font-medium px-2 py-0.5 rounded-full">
                                {notifCount}
                            </span>
                        )}
                        </button>
                        {showNotifMenu && (
                            <div className="absolute right-0 mt-2 w-80 bg-secondary border border-border rounded-lg shadow-glow py-2 z-20">
                                <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                                    <p className="text-sm font-semibold">Notificações</p>
                                    <button
                                        className="text-xs text-text-tertiary hover:text-text-primary"
                                        onClick={() => {
                                            setNotifCount(0);
                                            setNotifications([]);
                                            try {
                                                localStorage.setItem('unreadCount', '0');
                                                localStorage.setItem('unreadItems', '[]');
                                                window.dispatchEvent(new CustomEvent('unread:update', { detail: 0 }));
                                            } catch {}
                                        }}
                                    >
                                        Marcar todas como lidas
                                    </button>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-6 text-sm text-text-secondary">Sem novas mensagens</div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div key={n.id} className="px-4 py-2 border-b border-border">
                                                <p className="text-sm truncate">{n.content || 'Nova mensagem'}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <p className="text-xs text-text-tertiary">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                                                    <button
                                                        className="text-xs text-accent-primary hover:underline"
                                                        onClick={() => {
                                                            setShowNotifMenu(false);
                                                            router.push(`/conversations?conversationId=${encodeURIComponent(n.conversationId)}`);
                                                        }}
                                                    >
                                                        Abrir conversa
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="px-4 py-2">
                                    <button
                                        className="text-xs text-text-secondary hover:text-text-primary"
                                        onClick={() => {
                                            setShowNotifMenu(false);
                                            router.push('/conversations');
                                        }}
                                    >
                                        Ver todas as conversas
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-surface transition-colors"
                        >
                            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium">{user?.name || 'Usuário'}</p>
                                <p className="text-xs text-text-tertiary">{roleLabel || 'user'}</p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-text-tertiary" />
                        </button>

                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowUserMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-secondary border border-border rounded-lg shadow-glow py-2 z-20">
                                    <div className="px-4 py-2 border-b border-border">
                                        <p className="text-sm font-medium">{user?.name}</p>
                                        <p className="text-xs text-text-tertiary">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            logout();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-surface transition-colors flex items-center gap-2 text-error"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sair
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {actions}
                </div>
            </div>
        </div>
    );
}
