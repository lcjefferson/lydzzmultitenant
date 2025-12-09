'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Bot,
    Plug,
    Webhook,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/hooks/use-socket';

const navigation = [
    {
        title: 'Principal',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Conversas', href: '/conversations', icon: MessageSquare, badge: 5 },
            { name: 'Leads', href: '/leads', icon: Users },
        ],
    },
    {
        title: 'Configuração',
        items: [
            { name: 'Agentes', href: '/agents', icon: Bot },
            { name: 'Canais', href: '/channels', icon: Plug },
            { name: 'Webhooks', href: '/webhooks', icon: Webhook },
        ],
    },
    {
        title: 'Análise',
        items: [
            { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { user, logout } = useAuth();
    const roleLabel = typeof user?.role === 'string' ? user.role : 'user';
    const { onMessageCreated, offMessageCreated } = useSocket();
    const [unread, setUnread] = useState(() => {
        try {
            const initial = Number(localStorage.getItem('unreadCount') || '0');
            return Number.isNaN(initial) ? 0 : initial;
        } catch {
            return 0;
        }
    });

    useEffect(() => {
        const handleUpdate = (e: Event) => {
            const ce = e as CustomEvent<number>;
            const value = typeof ce.detail === 'number'
                ? ce.detail
                : (() => {
                      try {
                          const v = Number(localStorage.getItem('unreadCount') || '0');
                          return Number.isNaN(v) ? 0 : v;
                      } catch {
                          return 0;
                      }
                  })();
            setUnread(value);
        };
        window.addEventListener('unread:update', handleUpdate as EventListener);

        const handleMessageCreated = (message: unknown) => {
            const msg = message as { senderType?: string } | null;
            if (msg?.senderType === 'contact') {
                setUnread((c) => {
                    const next = c + 1;
                    try {
                        localStorage.setItem('unreadCount', String(next));
                    } catch {}
                    return next;
                });
            }
        };
        onMessageCreated(handleMessageCreated);

        return () => {
            offMessageCreated(handleMessageCreated);
            window.removeEventListener('unread:update', handleUpdate as EventListener);
        };
    }, [onMessageCreated, offMessageCreated]);

    return (
        <div
            className={cn(
                'flex flex-col h-screen bg-secondary/50 border-r border-border transition-all duration-300',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                            <span className="text-white font-bold text-sm">LA</span>
                        </div>
                        <span className="font-display font-bold text-lg">LydzzAI</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 rounded-md hover:bg-surface transition-colors"
                >
                    {collapsed ? (
                        <ChevronRight className="h-5 w-5" />
                    ) : (
                        <ChevronLeft className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
                {navigation.map((section) => (
                    <div key={section.title}>
                        {!collapsed && (
                            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-4">
                                {section.title}
                            </h3>
                        )}
                        <ul className="space-y-1">
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;

                                return (
                                    <li key={item.name}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'sidebar-item',
                                                isActive && 'sidebar-item-active',
                                                collapsed && 'justify-center px-0'
                                            )}
                                            title={collapsed ? item.name : undefined}
                                        >
                                            <Icon className="h-5 w-5 flex-shrink-0" />
                                            {!collapsed && (
                                                <>
                                                    <span className="flex-1">{item.name}</span>
                                                    {item.name === 'Conversas' && unread > 0 && (
                                                        <span className="bg-accent-primary text-white text-xs font-medium px-2 py-0.5 rounded-full">
                                                            {unread}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border space-y-2">
                <Link
                    href="/settings"
                    className={cn(
                        'flex items-center gap-3 p-3 rounded-md hover:bg-surface transition-colors',
                        collapsed && 'justify-center'
                    )}
                >
                    <Avatar fallback={user?.name?.substring(0, 2).toUpperCase() || 'U'} size="sm" />
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.name || 'Usuário'}</p>
                            <p className="text-xs text-text-secondary truncate">{roleLabel || 'User'}</p>
                        </div>
                    )}
                    <Settings className={cn('h-4 w-4 text-text-secondary', collapsed && 'hidden')} />
                </Link>

                <button
                    onClick={() => logout()}
                    className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-md hover:bg-surface transition-colors text-error',
                        collapsed && 'justify-center'
                    )}
                    title={collapsed ? 'Sair' : undefined}
                >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">Sair</span>}
                </button>
            </div>
        </div>
    );
}
