 'use client';
 
 import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText } from 'lucide-react';

interface MessageBubbleProps {
    type: 'contact' | 'ai' | 'user';
    content: string;
    timestamp: string;
    senderName?: string;
    confidence?: number;
    messageType?: 'text' | 'image' | 'file' | 'audio' | 'video';
    attachments?: Record<string, unknown>;
}

export function MessageBubble({ type, content, timestamp, senderName, confidence, messageType, attachments }: MessageBubbleProps) {
     const bubbleStyles = {
         contact: 'chat-bubble-contact',
         ai: 'chat-bubble-ai',
         user: 'chat-bubble-user',
     };
 
     const [mediaSrc, setMediaSrc] = useState<string | null>(null);
     const [mediaError, setMediaError] = useState<string | null>(null);
     const [mediaLoading, setMediaLoading] = useState(false);
 
     useEffect(() => {
         const urlRaw = (attachments as { url?: unknown })?.url;
         const urlStr = typeof urlRaw === 'string' ? urlRaw : null;
         const mediaId = (attachments as { mediaId?: unknown })?.mediaId;
         const mediaIdStr = typeof mediaId === 'string' ? mediaId : null;
 
         let objectUrl: string | null = null;
 
         async function loadMedia() {
                if (!urlStr && !mediaIdStr) {
                    setMediaSrc(null);
                    return;
                }
                if (messageType === 'text') {
                    setMediaSrc(null);
                    return;
                }

                // Handle local uploads (static files)
                if (urlStr && urlStr.startsWith('/uploads')) {
                    const baseApi = String(api.api.defaults.baseURL || '');
                    const root = baseApi.replace(/\/api\/?$/, '');
                    setMediaSrc(`${root}${urlStr}`);
                    return;
                }

                try {
                 setMediaLoading(true);
                 setMediaError(null);
                 const base = String(api.api.defaults.baseURL || '').replace(/\/$/, '');
                 const requestUrl =
                     mediaIdStr
                         ? `${base}/media/whatsapp/${encodeURIComponent(mediaIdStr)}`
                         : (urlStr as string);
                 const response = await api.api.get(requestUrl, { responseType: 'blob' });
                 const blob = response.data as Blob;
                 objectUrl = URL.createObjectURL(blob);
                 setMediaSrc(objectUrl);
             } catch {
                 setMediaError('Falha ao carregar mídia');
                 setMediaSrc(null);
             } finally {
                 setMediaLoading(false);
             }
         }
 
         void loadMedia();
 
         return () => {
             if (objectUrl) {
                 URL.revokeObjectURL(objectUrl);
             }
         };
     }, [messageType, attachments]);
 
     return (
         <div className={cn('flex flex-col', type !== 'contact' && 'items-end')}>
             {senderName && (
                 <span className="text-xs text-text-tertiary mb-1 px-1">{senderName}</span>
             )}
             <div className={cn('chat-bubble', bubbleStyles[type])}>
                 {messageType === 'image' && mediaSrc ? (
                    <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
                        <img src={mediaSrc} alt="imagem" className="max-w-xs rounded-md hover:opacity-90 transition-opacity" />
                    </a>
                ) : messageType === 'video' && mediaSrc ? (
                    <video controls src={mediaSrc} className="max-w-xs rounded-md" />
                ) : messageType === 'audio' && mediaSrc ? (
                     <audio controls src={mediaSrc} className="w-64" />
                 ) : messageType === 'file' && mediaSrc ? (
                    <a href={mediaSrc} target="_blank" rel="noreferrer" className="text-primary-600 underline flex items-center gap-2 bg-neutral-50 p-2 rounded-md hover:bg-neutral-100 transition-colors">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate max-w-[200px] text-sm font-medium">
                            {(attachments as { name?: string })?.name || 'Abrir arquivo'}
                        </span>
                    </a>
                ) : mediaLoading ? (
                     <p className="whitespace-pre-wrap opacity-70">Carregando mídia…</p>
                 ) : mediaError ? (
                     <p className="whitespace-pre-wrap opacity-70">Não foi possível carregar a mídia</p>
                 ) : (
                     <p className="whitespace-pre-wrap">{content}</p>
                 )}
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
