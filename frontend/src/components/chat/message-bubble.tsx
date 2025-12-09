import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

interface MessageBubbleProps {
    type: 'contact' | 'ai' | 'user';
    content: string;
    timestamp: string;
    senderName?: string;
    confidence?: number;
}

export function MessageBubble({ type, content, timestamp, senderName, confidence }: MessageBubbleProps) {
    const bubbleStyles = {
        contact: 'chat-bubble-contact',
        ai: 'chat-bubble-ai',
        user: 'chat-bubble-user',
    };

    return (
        <div className={cn('flex flex-col', type !== 'contact' && 'items-end')}>
            {senderName && (
                <span className="text-xs text-text-tertiary mb-1 px-1">{senderName}</span>
            )}
            <div className={cn('chat-bubble', bubbleStyles[type])}>
                <p className="whitespace-pre-wrap">{content}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs opacity-70">{formatRelativeTime(timestamp)}</span>
                    {type === 'ai' && confidence && (
                        <span className="text-xs opacity-70">• {Math.round(confidence * 100)}%</span>
                    )}
                </div>
            </div>
        </div>
    );
}
