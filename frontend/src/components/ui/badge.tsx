import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'hot' | 'warm' | 'cold' | 'default' | 'success' | 'warning' | 'error';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        hot: 'badge-hot',
        warm: 'badge-warm',
        cold: 'badge-cold',
        default: 'badge bg-surface text-text-primary',
        success: 'badge bg-success text-white',
        warning: 'badge bg-warning text-white',
        error: 'badge bg-error text-white',
    };

    return (
        <div className={cn('badge', variants[variant], className)} {...props} />
    );
}
