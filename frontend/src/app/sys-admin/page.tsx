'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function SysAdminPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        orgName: '',
        userName: '',
        userEmail: '',
        userPassword: '',
        masterKey: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.api.post('/internal/onboarding', formData);
            toast.success('Empresa e Administrador criados com sucesso!');
            // Redirect to login after successful creation
            router.push('/login');
        } catch (error: any) {
            console.error('Erro ao criar empresa:', error);
            toast.error(error.response?.data?.message || 'Erro ao criar empresa. Verifique a chave mestra.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-4">
            <Card className="w-full max-w-md border-red-900/20">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center text-red-500">
                        Área Restrita
                    </CardTitle>
                    <CardDescription className="text-center text-gray-400">
                        Criação de Nova Empresa e Administrador
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                label="Nome da Empresa"
                                placeholder="Ex: Minha Empresa Ltda"
                                value={formData.orgName}
                                onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Nome do Administrador"
                                placeholder="Nome Completo"
                                value={formData.userName}
                                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Email do Administrador"
                                type="email"
                                placeholder="admin@empresa.com"
                                value={formData.userEmail}
                                onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                label="Senha do Administrador"
                                type="password"
                                placeholder="••••••••"
                                value={formData.userPassword}
                                onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        
                        <div className="pt-4 border-t border-gray-800">
                            <div className="space-y-2">
                                <Input
                                    label="Chave Mestra (Segurança)"
                                    type="password"
                                    placeholder="Chave de segurança do sistema"
                                    value={formData.masterKey}
                                    onChange={(e) => setFormData({ ...formData, masterKey: e.target.value })}
                                    required
                                    disabled={isLoading}
                                    className="border-red-900/50 focus:border-red-500"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            disabled={isLoading}
                            isLoading={isLoading}
                        >
                            Criar Empresa
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
