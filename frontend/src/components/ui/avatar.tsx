import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
    src?: string;
    alt?: string;
    fallback?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ src, alt, fallback, size = 'md', className, ...props }: AvatarProps) {
    const sizes = {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
    };

    return (
        <div
            className={cn(
                'relative inline-flex items-center justify-center rounded-full bg-gradient-primary text-white font-medium overflow-hidden',
                sizes[size],
                className
            )}
            {...props}
        >
            {src ? (
                <img src={src} alt={alt || 'Avatar'} className="h-full w-full object-cover" />
            ) : (
                <span>{fallback || '?'}</span>
            )}
        </div>
    );
}
