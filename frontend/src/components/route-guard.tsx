'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            const isAuthPage = pathname === '/login' || pathname === '/register';
            const isDashboardPage = pathname?.startsWith('/dashboard') ||
                pathname?.startsWith('/conversations') ||
                pathname?.startsWith('/leads') ||
                pathname?.startsWith('/agents') ||
                pathname?.startsWith('/channels') ||
                pathname?.startsWith('/analytics') ||
                pathname?.startsWith('/webhooks') ||
                pathname?.startsWith('/settings');

            // Redirect to login if trying to access protected pages without auth
            if (isDashboardPage && !isAuthenticated) {
                router.push('/login');
            }

            // Redirect to dashboard if trying to access auth pages while authenticated
            if (isAuthPage && isAuthenticated) {
                router.push('/dashboard');
            }
        }
    }, [isAuthenticated, isLoading, pathname, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Carregando...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
