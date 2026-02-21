import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { MessageCircle, Instagram, Facebook, Mail } from 'lucide-react';

interface ConversationItemProps {
    id: string;
    contactName: string;
    contactIdentifier?: string;
    contactTag?: string | null; // e.g. "Oficial", "Não oficial"
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
    contactTag,
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
            aria-label={`Conversa com ${contactName}. ${unreadCount && unreadCount > 0 ? `${unreadCount} mensagens não lidas.` : ''}`}
            className={cn(
                'w-full p-3 py-4 sm:py-3 flex items-center gap-3 hover:bg-white active:bg-white/80 transition-colors border-b border-white/10 text-left group relative min-h-[64px] sm:min-h-0',
                isSelected && 'bg-white',
                !isSelected && unreadCount && unreadCount > 0 && 'bg-[#2a3942] border-l-4 border-l-[#00a884]'
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
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <h4 className={cn(
                            "truncate text-base",
                            isSelected ? "text-neutral-900 font-semibold" : "text-gray-50 group-hover:text-neutral-900",
                            !isSelected && unreadCount && unreadCount > 0 ? "font-bold text-white" : "font-semibold"
                        )}>{contactName}</h4>
                        {contactTag && (
                            <Badge variant="default" className="flex-shrink-0 text-[10px] px-1.5 py-0 bg-neutral-600 text-gray-200 border-0 font-normal hidden sm:inline-flex">
                                {contactTag}
                            </Badge>
                        )}
                    </div>
                    <span className={cn(
                        "text-xs flex-shrink-0 whitespace-nowrap",
                        isSelected ? "text-neutral-500" : "text-gray-400 group-hover:text-neutral-500",
                        !isSelected && unreadCount && unreadCount > 0 && "text-[#00a884] font-medium"
                    )}>
                        {formatRelativeTime(timestamp)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                        "text-sm truncate flex-1",
                        isSelected ? "text-neutral-600" : "text-gray-300 group-hover:text-neutral-600",
                        !isSelected && unreadCount && unreadCount > 0 ? "font-medium text-gray-100" : ""
                    )}>{lastMessage}</p>
                    {/* Unread Badge */}
                    {unreadCount && unreadCount > 0 ? (
                        <Badge variant="default" className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 h-5 min-w-[1.25rem] px-1 justify-center rounded-full">
                            {unreadCount}
                        </Badge>
                    ) : null}
                </div>
            </div>
        </button>
    );
}
