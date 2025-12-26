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
    GitBranch,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useConversations } from '@/hooks/api/use-conversations';

const navigation = [
    {
        title: 'Principal',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Conversas', href: '/conversations', icon: MessageSquare, badge: 'conversations' },
            { name: 'Chat Interno', href: '/chat', icon: MessageSquare },
            { name: 'Leads', href: '/leads', icon: Users },
        ],
    },
    {
        title: 'Pipeline',
        items: [
            { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
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
    const { data: conversations } = useConversations();

    const role = (typeof user?.role === 'string' ? user.role : 'user').toLowerCase();
    
    const rawOrgName = user?.organization?.name;
    const orgDisplayName = rawOrgName || 'LydzzAI';
    const orgInitials = rawOrgName
        ? rawOrgName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : 'LA';

    const canAccess = (href: string) => {
        // Debug logging
        // console.log(`Checking access for ${href} with role ${role}`);
        
        if (href === '/settings') {
            return role === 'admin';
        }
        if (role === 'admin') return true;
        if (role === 'sdr') {
            return ['/dashboard', '/conversations', '/leads'].includes(href);
        }
        if (role === 'vendedor') {
            return ['/dashboard', '/conversations', '/leads', '/pipeline'].includes(href);
        }
        if (role === 'consultant' || role === 'manager') {
            return ['/dashboard', '/conversations', '/leads', '/pipeline', '/chat'].includes(href);
        }
        return ['/dashboard', '/conversations', '/leads'].includes(href);
    };

    return (
        <div
            className={cn(
                'flex flex-col h-screen bg-white border-r border-border transition-all duration-300',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{orgInitials}</span>
                        </div>
                        <span className="font-display font-bold text-lg text-neutral-900">{orgDisplayName}</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 rounded-md hover:bg-surface transition-colors"
                >
                    {collapsed ? (
                        <ChevronRight className="h-5 w-5 text-neutral-900" />
                    ) : (
                        <ChevronLeft className="h-5 w-5 text-neutral-900" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
                {navigation.map((section) => (
                    <div key={section.title}>
                        {!collapsed && (
                            <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-2 px-4">
                                {section.title}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const hasAccess = canAccess(item.href);
                                if (!hasAccess) return null;

                                const isActive = pathname === item.href;
                                let badgeValue: number | string | undefined;

                                if (item.badge === 'conversations') {
                                    // Count active conversations
                                    badgeValue = conversations?.filter(c => c.status !== 'closed').length;
                                } else {
                                    badgeValue = item.badge;
                                }

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                            isActive
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                                        )}
                                        title={collapsed ? item.name : undefined}
                                    >
                                        <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-blue-700' : 'text-text-tertiary group-hover:text-text-primary')} />
                                        {!collapsed && (
                                            <span className="flex-1 truncate">
                                                {item.name}
                                            </span>
                                        )}
                                        {!collapsed && badgeValue && (typeof badgeValue === 'number' ? badgeValue > 0 : true) && (
                                            <span className={cn(
                                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                                isActive ? 'bg-blue-700 text-white' : 'bg-surface-active text-text-primary'
                                            )}>
                                                {badgeValue}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border space-y-2">
                {role === 'admin' && (
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
                                <p className="text-sm font-medium truncate text-neutral-900">{user?.name || 'Usuário'}</p>
                                <p className="text-xs text-text-secondary truncate">{roleLabel || 'User'}</p>
                            </div>
                        )}
                        <Settings className={cn('h-4 w-4 text-text-secondary', collapsed && 'hidden')} />
                    </Link>
                )}

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
