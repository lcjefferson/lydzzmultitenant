import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    iconColor?: string;
}

export function StatCard({ title, value, icon: Icon, trend, iconColor = 'text-accent-primary' }: StatCardProps) {
    return (
        <div className="glass-card rounded-xl p-5 md:p-8 transition-all duration-300 hover:bg-card/80">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="stat-label text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
                    <p className="stat-value mt-2 text-2xl md:text-3xl font-bold text-foreground tracking-tight">{value}</p>
                    {trend && (
                        <p className={cn(
                            'text-sm mt-3 flex items-center gap-1.5 font-medium',
                            trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
                        )}>
                            <span>{trend.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend.value)}%</span>
                            <span className="text-muted-foreground/60">vs mês anterior</span>
                        </p>
                    )}
                </div>
                <div className={cn('p-3 rounded-xl bg-secondary border border-border shadow-sm', iconColor)}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}
