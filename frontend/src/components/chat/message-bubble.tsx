 'use client';
 
 import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText, FileSpreadsheet, File, FileImage, FileAudio, FileVideo, FileCode } from 'lucide-react';

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

    // Extract stable primitives from attachments to prevent unnecessary re-renders/fetches
    const attachmentUrl = (attachments as { url?: unknown })?.url;
    const attachmentMediaId = (attachments as { mediaId?: unknown })?.mediaId;
    const urlStr = typeof attachmentUrl === 'string' ? attachmentUrl : null;
    const mediaIdStr = typeof attachmentMediaId === 'string' ? attachmentMediaId : null;

    useEffect(() => {
        let objectUrl: string | null = null;
        let isMounted = true;

        async function loadMedia() {
              // If no URL/ID yet, but it is a media type, we might be waiting for backend processing
              if (!urlStr && !mediaIdStr) {
                  if (isMounted) setMediaSrc(null);
                  // Keep loading true if we expect media but don't have it yet
                  if (messageType !== 'text' && isMounted) {
                      setMediaLoading(true);
                  }
                  return;
              }

              if (messageType === 'text') {
                  if (isMounted) {
                      setMediaSrc(null);
                      setMediaLoading(false);
                  }
                  return;
              }

              // Handle local uploads (static files)
              if (urlStr && urlStr.startsWith('/uploads')) {
                  // Use relative URL to leverage Next.js rewrites (proxies to backend)
                  // This avoids CORS and port issues
                  const relativeUrl = urlStr;

                  // Special handling for audio: fetch as blob to ensure duration works
                  // This fixes the "0 seconds" bug on reload
                  if (messageType === 'audio') {
                      try {
                          if (isMounted) {
                              setMediaLoading(true);
                              setMediaError(null);
                          }
                          // Use fetch for static files (proxied by Next.js)
                          const response = await fetch(relativeUrl);
                          if (!response.ok) throw new Error('Failed to load audio');
                          
                          const blob = await response.blob();
                          if (!isMounted) return;
                          
                          objectUrl = URL.createObjectURL(blob);
                          setMediaSrc(objectUrl);
                      } catch (err) {
                          console.error('Error loading audio:', err);
                          if (isMounted) {
                              setMediaError('Erro no arquivo');
                              setMediaSrc(null);
                          }
                      } finally {
                          if (isMounted) setMediaLoading(false);
                      }
                      return;
                  }

                  if (isMounted) {
                      setMediaSrc(relativeUrl);
                      setMediaLoading(false); // Local files don't need async fetch to get URL
                  }
                  return;
              }

              try {
               if (isMounted) {
                   setMediaLoading(true);
                   setMediaError(null);
               }
               const base = String(api.api.defaults.baseURL || '').replace(/\/$/, '');
               const requestUrl =
                   mediaIdStr
                       ? `${base}/media/whatsapp/${encodeURIComponent(mediaIdStr)}`
                       : (urlStr as string);
               
               // For external URLs (not local uploads), we might need to fetch blob
               // But if it's a direct public URL, we might just use it.
               // Assuming this path is for proxied media or protected resources
               const response = await api.api.get(requestUrl, { responseType: 'blob' });
               if (!isMounted) return;

               const blob = response.data as Blob;
               objectUrl = URL.createObjectURL(blob);
               setMediaSrc(objectUrl);
           } catch {
               if (isMounted) {
                   setMediaError('Erro no arquivo');
                   setMediaSrc(null);
               }
           } finally {
               if (isMounted) setMediaLoading(false);
           }
       }

       void loadMedia();

       return () => {
           isMounted = false;
           if (objectUrl) {
               URL.revokeObjectURL(objectUrl);
           }
       };
    }, [messageType, urlStr, mediaIdStr]);

    const getFileIcon = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        
        switch(ext) {
            case 'pdf': return <FileText className="h-8 w-8 text-red-500" />;
            case 'xls':
            case 'xlsx':
            case 'csv': return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
            case 'doc':
            case 'docx': return <FileText className="h-8 w-8 text-blue-600" />;
            case 'ppt':
            case 'pptx': return <FileText className="h-8 w-8 text-orange-500" />;
            case 'txt': return <FileText className="h-8 w-8 text-gray-500" />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif': return <FileImage className="h-8 w-8 text-purple-500" />;
            case 'mp3':
            case 'wav':
            case 'ogg': return <FileAudio className="h-8 w-8 text-yellow-500" />;
            case 'mp4':
            case 'avi':
            case 'mov': return <FileVideo className="h-8 w-8 text-pink-500" />;
            case 'js':
            case 'ts':
            case 'html':
            case 'css':
            case 'json': return <FileCode className="h-8 w-8 text-yellow-600" />;
            default: return <File className="h-8 w-8 text-gray-400" />;
        }
    };

    const fileName = (attachments as { name?: string })?.name || (attachments as { filename?: string })?.filename || 'Documento';

    return (
        <div className={cn('flex flex-col', type !== 'contact' && 'items-end')}>
            {senderName && (
                <span className="text-xs text-text-tertiary mb-1 px-1">{senderName}</span>
            )}
            <div className={cn('chat-bubble', bubbleStyles[type])}>
                {messageType === 'image' && mediaSrc ? (
                   <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
                       <img 
                           src={mediaSrc} 
                           alt="imagem" 
                           className="max-w-xs rounded-md hover:opacity-90 transition-opacity"
                           onError={() => setMediaError('Erro no arquivo')} 
                       />
                   </a>
               ) : messageType === 'video' && mediaSrc ? (
                   <video controls src={mediaSrc} className="max-w-xs rounded-md" onError={() => setMediaError('Erro no arquivo')} />
               ) : messageType === 'audio' && mediaSrc ? (
                    <audio controls src={mediaSrc} className="w-64" onError={() => setMediaError('Erro no arquivo')} />
                ) : messageType === 'file' && mediaSrc ? (
                   <a 
                       href={mediaSrc} 
                       target="_blank" 
                       rel="noreferrer" 
                       className="flex flex-col items-center justify-center p-3 gap-2 bg-neutral-100 border border-neutral-200 rounded-lg hover:bg-neutral-200 transition-colors min-w-[100px] max-w-[160px] group text-decoration-none"
                       title={fileName}
                   >
                       {getFileIcon(fileName)}
                       <span className="text-xs font-medium text-neutral-700 text-center w-full truncate px-1">
                           {fileName}
                       </span>
                   </a>
               ) : (mediaLoading || (messageType !== 'text' && !mediaSrc && !mediaError)) ? (
                    <div className="flex items-center gap-2 text-sm opacity-70">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        <span>Carregando {messageType === 'image' ? 'imagem' : 'mídia'}...</span>
                    </div>
                ) : mediaError ? (
                    <div className="flex items-center gap-2 text-red-400">
                        <span className="text-sm">Erro no arquivo</span>
                    </div>
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
