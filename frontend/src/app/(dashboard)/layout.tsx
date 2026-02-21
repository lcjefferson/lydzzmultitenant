'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { RouteGuard } from '@/components/route-guard';
import { useAuth } from '@/contexts/auth-context';
import { useNavigation } from '@/contexts/navigation-context';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();
    const { isNavigating } = useNavigation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (user?.organization?.name) {
            document.title = `${user.organization.name} - LydzzAI`;
        }
    }, [user]);

    return (
        <RouteGuard>
            <div className="flex h-screen overflow-hidden bg-white relative">
                {/* Desktop Sidebar */}
                <div className="hidden md:flex">
                    <Sidebar />
                </div>

                {/* Mobile Sidebar Overlay */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 flex md:hidden">
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                        <div className="relative flex h-full w-72 flex-col bg-background shadow-2xl animate-in slide-in-from-left duration-200">
                            <Sidebar className="w-full border-r-0" onClose={() => setIsMobileMenuOpen(false)} />
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground md:hidden z-50"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Barra de progresso ao trocar de rota */}
                {isNavigating && (
                    <div className="absolute top-0 left-0 right-0 z-50 h-0.5 bg-primary/20 overflow-hidden">
                        <div className="h-full w-1/3 bg-[#00a884] animate-nav-progress" />
                    </div>
                )}

                <main className="flex-1 overflow-y-auto bg-white flex flex-col w-full">
                    {/* Mobile Header Trigger */}
                    <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-[#0f172a] sticky top-0 z-40">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-white">
                                <Menu className="h-6 w-6" />
                            </button>
                            <span className="font-bold text-lg text-white">LydzzAI</span>
                        </div>
                    </div>

                    <div className="flex-1">
                        {children}
                    </div>
                </main>
            </div>
        </RouteGuard>
    );
}
