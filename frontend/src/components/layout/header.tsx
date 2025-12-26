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
    const { onMessageCreated, offMessageCreated, onNotificationCreated, offNotificationCreated } = useSocket();
    const [notifCount, setNotifCount] = useState(0);
    const [notifications, setNotifications] = useState<Array<{ id: string; type: string; entityId: string; data?: any; createdAt: string; readAt?: string; content?: string }>>([]);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const load = async () => {
            try {
                const items = await (await import('@/lib/api')).api.getNotifications();
                setNotifications(items.map((n) => ({ id: n.id, type: n.type, entityId: n.entityId, data: n.data, createdAt: n.createdAt, readAt: n.readAt })));
                setNotifCount(items.filter((n) => !n.readAt).length);
            } catch {}
        };
        void load();

        const handleMessageCreated = async () => {
            try {
                const items = await (await import('@/lib/api')).api.getNotifications();
                setNotifications(items.map((n) => ({ id: n.id, type: n.type, entityId: n.entityId, data: n.data, createdAt: n.createdAt, readAt: n.readAt })));
                setNotifCount(items.filter((n) => !n.readAt).length);
            } catch {}
        };

        const handleNotificationCreated = async (notification: any) => {
             try {
                // Optionally verify if the notification belongs to the user, but the socket event should be targeted or filtered.
                // Since we don't have user context in the event easily, we just reload the list.
                // Or we can optimistic add it.
                // For now, let's reload to be safe and consistent with handleMessageCreated.
                const items = await (await import('@/lib/api')).api.getNotifications();
                setNotifications(items.map((n) => ({ id: n.id, type: n.type, entityId: n.entityId, data: n.data, createdAt: n.createdAt, readAt: n.readAt })));
                setNotifCount(items.filter((n) => !n.readAt).length);
                 // Show toast? Maybe later.
            } catch {}
        };

        onMessageCreated(handleMessageCreated);
        onNotificationCreated(handleNotificationCreated);
        return () => {
            offMessageCreated(handleMessageCreated);
            offNotificationCreated(handleNotificationCreated);
        };
    }, [onMessageCreated, offMessageCreated, onNotificationCreated, offNotificationCreated]);

    const getNotificationTitle = (n: any) => {
        const leadName = n.data?.leadName || 'Lead';
        if (n.type === 'lead_comment_added') return `Novo comentário em ${leadName}`;
        if (n.type === 'lead_message_received') return `Nova mensagem de ${leadName}`;
        if (n.type === 'lead_delegated') return `Lead ${leadName} atribuído a você`;
        return n.type || 'Nova notificação';
    };

    const getNotificationContent = (n: any) => {
        if (n.type === 'lead_comment_added') return n.data?.commentContent;
        if (n.type === 'lead_message_received') return n.data?.messageContent;
        return '';
    };

    return (
        <div className="border-b border-border bg-white sticky top-0 z-10">
            <div className="flex items-center justify-between p-6">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{title}</h1>
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
                        <Bell className="h-5 w-5 text-neutral-900" />
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
                                        onClick={async () => {
                                            try {
                                                const unread = notifications.filter((n) => !n.readAt);
                                                for (const n of unread) {
                                                    await (await import('@/lib/api')).api.markNotificationRead(n.id);
                                                }
                                                const items = await (await import('@/lib/api')).api.getNotifications();
                                                setNotifications(items.map((n) => ({ id: n.id, type: n.type, entityId: n.entityId, createdAt: n.createdAt, readAt: n.readAt })));
                                                setNotifCount(items.filter((n) => !n.readAt).length);
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
                                                <p className="text-sm font-medium truncate">{getNotificationTitle(n)}</p>
                                                {getNotificationContent(n) && (
                                                    <p className="text-xs text-text-secondary truncate mt-0.5">{getNotificationContent(n)}</p>
                                                )}
                                                <div className="flex items-center justify-between mt-1">
                                                    <p className="text-xs text-text-tertiary">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                                                    <button
                                                        className="text-xs text-accent-primary hover:underline"
                                                        onClick={async () => {
                                                            try {
                                                                await (await import('@/lib/api')).api.markNotificationRead(n.id);
                                                            } catch {}
                                                            setShowNotifMenu(false);
                                                            if (n.type === 'lead_comment_added' || n.type === 'lead_message_received' || n.type === 'lead_delegated') {
                                                                router.push(`/leads?lead=${encodeURIComponent(n.data?.leadId || n.entityId)}`);
                                                            } else if (n.entityId) {
                                                                router.push(`/conversations?conversationId=${encodeURIComponent(n.entityId)}`);
                                                            } else {
                                                                router.push('/conversations');
                                                            }
                                                        }}
                                                    >
                                                        Ver
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
                            <div className="h-8 w-8 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center">
                                <User className="h-4 w-4 text-neutral-900" />
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-neutral-900">{user?.name || 'Usuário'}</p>
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
                                        <p className="text-sm font-medium text-neutral-900">{user?.name}</p>
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
