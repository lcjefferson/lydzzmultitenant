import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { MessageCircle, Instagram, Facebook, Mail } from 'lucide-react';

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
    avatarUrl?: string;
    channelType?: string;
}

const channelIcons: Record<string, any> = {
    whatsapp: MessageCircle,
    instagram: Instagram,
    facebook_leads: Facebook,
    email: Mail,
};

export function ConversationItem({
    contactName,
    contactIdentifier,
    lastMessage,
    timestamp,
    status,
    unreadCount,
    isSelected,
    onClick,
    avatarUrl,
    channelType,
}: ConversationItemProps) {
    const statusColors = {
        active: 'bg-success',
        waiting: 'bg-warning',
        closed: 'bg-neutral-400',
    };

    const ChannelIcon = channelType ? channelIcons[channelType] : null;

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full p-3 flex items-center gap-3 hover:bg-white transition-colors border-b border-white/10 text-left group',
                isSelected && 'bg-white'
            )}
        >
            {/* Avatar with Status */}
            <div className="relative flex-shrink-0">
                <Avatar 
                    src={avatarUrl} 
                    fallback={contactName.charAt(0).toUpperCase()} 
                    className="h-12 w-12"
                />
                <div className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white', 
                    statusColors[status]
                )} />
                {ChannelIcon && (
                    <div className="absolute -bottom-1 -left-1 bg-white rounded-full p-0.5 shadow-sm">
                         <ChannelIcon className={cn("h-4 w-4", 
                             channelType === 'whatsapp' ? "text-green-500" : 
                             channelType === 'instagram' ? "text-pink-500" : 
                             channelType === 'facebook_leads' ? "text-blue-600" : "text-gray-500"
                         )} />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4 className={cn(
                        "font-semibold truncate text-base",
                        isSelected ? "text-neutral-900" : "text-gray-50 group-hover:text-neutral-900"
                    )}>{contactName}</h4>
                    <span className={cn(
                        "text-xs flex-shrink-0 whitespace-nowrap",
                        isSelected ? "text-neutral-500" : "text-gray-400 group-hover:text-neutral-500"
                    )}>
                        {formatRelativeTime(timestamp)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                        "text-sm truncate flex-1",
                        isSelected ? "text-neutral-600" : "text-gray-300 group-hover:text-neutral-600"
                    )}>{lastMessage}</p>
                    {/* Unread Badge */}
                    {unreadCount && unreadCount > 0 ? (
                        <Badge variant="default" className="flex-shrink-0 bg-green-500 hover:bg-green-600 h-5 min-w-[1.25rem] px-1 justify-center rounded-full">
                            {unreadCount}
                        </Badge>
                    ) : null}
                </div>
            </div>
        </button>
    );
}
