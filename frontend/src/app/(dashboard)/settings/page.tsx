'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Save, Pencil, Trash } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationsForm } from '@/components/settings/integrations-form';
import { useAuth } from '@/contexts/auth-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUpdateUser } from '@/hooks/api/use-users';
import type { UpdateUserDto, User } from '@/types/api';

export default function SettingsPage() {
    const { user } = useAuth();
    const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
    const usersQuery = useQuery({
        queryKey: ['users'],
        queryFn: () => api.getUsers(),
        enabled: isAdmin,
    });
    const updateUser = useUpdateUser();
    const users = usersQuery.data || [];
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'consultant' as 'admin' | 'manager' | 'consultant' });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<UpdateUserDto>({});

    const handleEditClick = (u: User) => {
        setEditingUser(u);
        setEditForm({
            name: u.name,
            email: u.email,
            role: u.role,
            password: '',
        });
    };

    const handleUpdate = async () => {
        if (!editingUser) return;
        const data = { ...editForm };
        if (!data.password) delete data.password;

        try {
            await updateUser.mutateAsync({ id: editingUser.id, data });
            setEditingUser(null);
            void usersQuery.refetch();
        } catch {}
    };

    return (
        <div>
            <Header title="Configurações" description="Gerencie suas preferências e conta" />

            <div className="p-4 md:p-6 max-w-4xl space-y-4 md:space-y-6">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className={`grid w-full h-auto ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="organization">Organização</TabsTrigger>
                        <TabsTrigger value="integrations">Integrações</TabsTrigger>
                        {isAdmin && <TabsTrigger value="users">Usuários</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="profile" className="space-y-6 mt-6">
                        {/* Profile */}
                        <Card className="bg-slate-900 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white">Perfil do Usuário</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Avatar fallback="JS" size="lg" />
                                    <Button variant="secondary" className="text-white bg-slate-800 hover:bg-slate-700">Alterar Foto</Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Nome Completo</label>
                                        <Input defaultValue="João Silva" className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Email</label>
                                        <Input type="email" defaultValue="joao@empresa.com" className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Telefone</label>
                                        <Input defaultValue="+55 11 99999-9999" className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Cargo</label>
                                        <Input defaultValue="Admin" className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <div className="flex justify-end">
                            <Button>
                                <Save className="h-4 w-4" />
                                Salvar Alterações
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="organization" className="space-y-6 mt-6">
                        {/* Organization */}
                        <Card className="bg-slate-900 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white">Organização</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Nome da Empresa</label>
                                        <Input defaultValue="Minha Empresa" className="bg-slate-800 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white">Plano</label>
                                        <Input defaultValue="Professional" disabled className="bg-slate-800 border-slate-700 text-white opacity-50" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <div className="flex justify-end">
                            <Button>
                                <Save className="h-4 w-4" />
                                Salvar Alterações
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="integrations" className="mt-6">
                        <IntegrationsForm />
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="users" className="space-y-6 mt-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white">Nome</label>
                                            <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white">Email</label>
                                            <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-white">Senha</label>
                                            <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-white">Papel</label>
                                            <select
                                                value={newUser.role}
                                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'manager' | 'consultant' })}
                                                className="input w-full bg-slate-800 border-slate-700 text-white"
                                            >
                                                <option value="consultant">Consultor</option>
                                                <option value="manager">Gerente</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button onClick={async () => {
                                            try {
                                                await api.createUser(newUser);
                                                setNewUser({ name: '', email: '', password: '', role: 'consultant' });
                                                void usersQuery.refetch();
                                            } catch {}
                                        }}>Adicionar Usuário</Button>
                                    </div>
                                    <div className="pt-4 border-t border-slate-800">
                                        <p className="text-sm text-gray-400 mb-2">Usuários da organização</p>
                                        {users.length === 0 ? (
                                            <p className="text-sm text-gray-500">Sem usuários cadastrados</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {users.map((u) => (
                                                    <div key={u.id} className="flex items-center justify-between p-3 rounded-md border border-slate-700 bg-slate-800/50">
                                                        <div>
                                                            <p className="text-sm font-medium text-white">{u.name}</p>
                                                            <p className="text-xs text-gray-400">{u.email} • {u.role}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => handleEditClick(u)}
                                                                title="Editar Usuário"
                                                                className="text-white bg-slate-700 hover:bg-slate-600"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={async () => {
                                                                    try {
                                                                        if (u.id === user?.id) return; // evitar remover a si mesmo
                                                                        await api.deleteUser(u.id);
                                                                        void usersQuery.refetch();
                                                                    } catch {}
                                                                }}
                                                                title="Excluir Usuário"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Edit User Modal */}
                            {editingUser && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-white border border-neutral-200 rounded-lg p-6 w-full max-w-md shadow-lg" style={{ "--foreground": "222 47% 11%" } as React.CSSProperties}>
                                        <h3 className="text-lg font-semibold mb-4 text-neutral-900">Editar Usuário</h3>
                                        <div className="space-y-3">
                                            <Input 
                                                label="Nome" 
                                                value={editForm.name || ''} 
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                                                className="bg-white border-neutral-300 text-neutral-900"
                                            />
                                            <Input 
                                                label="Email" 
                                                type="email" 
                                                value={editForm.email || ''} 
                                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
                                                className="bg-white border-neutral-300 text-neutral-900"
                                            />
                                            <Input 
                                                label="Nova Senha (opcional)" 
                                                type="password" 
                                                placeholder="Deixe em branco para manter"
                                                value={editForm.password || ''} 
                                                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} 
                                                className="bg-white border-neutral-300 text-neutral-900"
                                            />
                                            <div className="space-y-1">
                                                <label className="text-sm font-medium text-neutral-900">Função</label>
                                                <div className="flex gap-2">
                                                    {(['consultant', 'manager', 'admin'] as const).map((r) => (
                                                        <Button 
                                                            key={r} 
                                                            size="sm"
                                                            variant={editForm.role === r ? 'primary' : 'secondary'} 
                                                            onClick={() => setEditForm({ ...editForm, role: r })}
                                                        >
                                                            {r === 'consultant' ? 'Consultor' : r === 'manager' ? 'Gerente' : 'Admin'}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-end gap-2 mt-4">
                                                <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancelar</Button>
                                                <Button onClick={handleUpdate} isLoading={updateUser.isPending}>Salvar</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}
