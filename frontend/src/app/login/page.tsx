'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(formData);
        } catch {
            // Error is handled in AuthContext
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <Card className="w-full max-w-md relative z-10 glass-card border-white/10">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-4xl font-bold text-center bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent font-display">
                        LydzzAI
                    </CardTitle>
                    <CardDescription className="text-center text-muted-foreground">
                        Entre com sua conta para continuar
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="seu@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                disabled={isLoading}
                                className="bg-secondary/50"
                            />
                            <Input
                                label="Senha"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                disabled={isLoading}
                                className="bg-secondary/50"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full btn-gradient h-12 text-lg font-medium shadow-neon hover:shadow-neon-strong transition-all duration-300"
                            disabled={isLoading}
                            isLoading={isLoading}
                        >
                            Entrar
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="absolute bottom-6 text-center text-xs text-muted-foreground/40 font-medium select-none">
                v{process.env.NEXT_PUBLIC_APP_VERSION} • {process.env.NEXT_PUBLIC_BUILD_DATE}
            </div>
        </div>
    );
}
