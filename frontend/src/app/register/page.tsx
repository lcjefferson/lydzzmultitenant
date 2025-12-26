'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
    const { register, isLoading } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        organizationName: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await register(formData);
        } catch {
            // Error is handled in AuthContext
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                        LydzzAI
                    </CardTitle>
                    <CardDescription className="text-center text-gray-400">
                        Crie sua conta e comece a usar
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                label="Nome"
                                type="text"
                                placeholder="Seu nome"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="seu@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Senha"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Nome da Organização (Cliente)"
                                type="text"
                                placeholder="Minha Empresa"
                                value={formData.organizationName}
                                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-gray-500">
                                Preencha para criar um novo ambiente exclusivo para este cliente.
                            </p>
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                            isLoading={isLoading}
                        >
                            Criar Conta
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm text-gray-400">
                        Já tem uma conta?{' '}
                        <Link href="/login" className="text-primary-400 hover:text-primary-300 transition-colors">
                            Faça login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
