'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                    mutations: {
                        onError: (error: unknown) => {
                            console.error('Mutation error:', error);
                        },
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {children}
                <Toaster
                    position="top-right"
                    theme="dark"
                    toastOptions={{
                        style: {
                            background: '#141824',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#FFFFFF',
                        },
                    }}
                />
            </AuthProvider>
        </QueryClientProvider>
    );
}
