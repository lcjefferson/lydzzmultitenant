import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ConversationItemProps {
    id: string;
    contactName: string;
    contactIdentifier?: string;
    lastMessage: string;
    timestamp: string;
    status: 'active' | 'waiting' | 'closed';
    unreadCount?: number;
    isSelected?: boolean;
    onClick?: () => void;
}

export function ConversationItem({
    contactName,
    contactIdentifier,
    lastMessage,
    timestamp,
    status,
    unreadCount,
    isSelected,
    onClick,
}: ConversationItemProps) {
    const statusColors = {
        active: 'bg-success',
        waiting: 'bg-warning',
        closed: 'bg-text-tertiary',
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full p-4 flex items-start gap-3 hover:bg-surface transition-colors border-b border-border text-left',
                isSelected && 'bg-surface'
            )}
        >
            {/* Status Indicator */}
            <div className={cn('h-2 w-2 rounded-full mt-2 flex-shrink-0', statusColors[status])} />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                        <h4 className="font-medium truncate">{contactName}</h4>
                        {contactIdentifier && (
                            <p className="text-xs text-text-tertiary truncate">{contactIdentifier}</p>
                        )}
                    </div>
                    <span className="text-xs text-text-tertiary flex-shrink-0">
                        {formatRelativeTime(timestamp)}
                    </span>
                </div>
                <p className="text-sm text-text-secondary truncate">{lastMessage}</p>
            </div>

            {/* Unread Badge */}
            {unreadCount && unreadCount > 0 && (
                <Badge variant="default" className="flex-shrink-0">
                    {unreadCount}
                </Badge>
            )}
        </button>
    );
}
