'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { RouteGuard } from '@/components/route-guard';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();

    useEffect(() => {
        if (user?.organization?.name) {
            document.title = `${user.organization.name} - LydzzAI`;
        }
    }, [user]);

    return (
        <RouteGuard>
            <div className="flex h-screen overflow-hidden bg-white">
                <Sidebar />
                <main className="flex-1 overflow-y-auto bg-white">
                    {children}
                </main>
            </div>
        </RouteGuard>
    );
}
