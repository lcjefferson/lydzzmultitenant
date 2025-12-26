import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-primary disabled:opacity-50 disabled:cursor-not-allowed';

        const variants = {
            primary: 'bg-gradient-primary text-white shadow-glow hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(99,102,241,0.4)] focus:ring-accent-primary',
            secondary: 'bg-white text-text-primary border border-neutral-200 shadow-sm hover:bg-neutral-50 focus:ring-neutral-200',
            ghost: 'bg-transparent text-text-secondary hover:bg-neutral-100 focus:ring-neutral-200',
            danger: 'bg-error text-white hover:bg-error/90 focus:ring-error',
            outline: 'bg-transparent border border-neutral-300 text-text-secondary hover:bg-neutral-50 focus:ring-neutral-300',
        };

        const sizes = {
            sm: 'px-4 py-2 text-sm',
            md: 'px-6 py-3 text-base',
            lg: 'px-8 py-4 text-lg',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
