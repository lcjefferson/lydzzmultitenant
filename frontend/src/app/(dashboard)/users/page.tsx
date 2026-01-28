'use client';

import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/hooks/api/use-users';
import type { CreateUserDto, UpdateUserDto, User } from '@/types/api';
import { useAuth } from '@/contexts/auth-context';
import { useState } from 'react';

export default function UsersPage() {
  const { user } = useAuth();
  const { data: users } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [form, setForm] = useState<CreateUserDto>({ name: '', email: '', password: '', role: 'consultant' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserDto>({});

  const isAdmin = user?.role === 'admin';

  const handleEditClick = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setEditForm({
      name: userToEdit.name,
      email: userToEdit.email,
      role: userToEdit.role,
      password: '', // Password is optional/empty by default
    });
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    
    // Remove empty password so it doesn't overwrite with empty string if the backend doesn't handle it
    const dataToUpdate = { ...editForm };
    if (!dataToUpdate.password) {
      delete dataToUpdate.password;
    }

    try {
      await updateUser.mutateAsync({ id: editingUser.id, data: dataToUpdate });
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to update user', error);
    }
  };

  return (
    <div>
      <Header title="Usuários" description="Gerencie consultores e administradores" />
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Lista</h3>
          <div className="space-y-2">
            {(users || []).map((u) => (
              <div key={u.id} className="flex items-center justify-between border border-border rounded-md p-2">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-text-secondary">{u.email} • {u.role}</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEditClick(u)}>Editar</Button>
                    <Button size="sm" variant="secondary" onClick={() => updateUser.mutate({ id: u.id, data: { role: u.role === 'consultant' ? 'admin' : 'consultant' } })}>Alternar Função</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteUser.mutate(u.id)} isLoading={deleteUser.isPending}>Excluir</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900 text-white border-slate-800" style={{ "--foreground": "0 0% 100%" } as React.CSSProperties}>
          <h3 className="text-lg font-semibold mb-3">Adicionar Usuário</h3>
          {isAdmin ? (
            <div className="space-y-3">
              <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <div className="flex gap-2">
                {(['consultant','admin'] as const).map((r) => (
                  <Button key={r} variant={form.role===r? 'primary':'secondary'} onClick={() => setForm({ ...form, role: r })}>{r}</Button>
                ))}
              </div>
              <Button onClick={() => createUser.mutate(form)} isLoading={createUser.isPending}>Criar</Button>
            </div>
          ) : (
            <p className="text-sm text-gray-300">Apenas administradores podem criar usuários.</p>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-neutral-900 border border-border rounded-lg p-6 w-full max-w-md shadow-lg" style={{ "--foreground": "222 47% 11%" } as React.CSSProperties}>
            <h3 className="text-lg font-semibold mb-4">Editar Usuário</h3>
            <div className="space-y-3">
              <Input 
                label="Nome" 
                value={editForm.name || ''} 
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
              />
              <Input 
                label="Email" 
                type="email" 
                value={editForm.email || ''} 
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
              />
              <Input 
                label="Nova Senha (opcional)" 
                type="password" 
                placeholder="Deixe em branco para manter"
                value={editForm.password || ''} 
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} 
              />
              <div className="space-y-1">
                <label className="text-sm font-medium">Função</label>
                <div className="flex gap-2">
                  {(['consultant', 'admin'] as const).map((r) => (
                    <Button 
                      key={r} 
                      size="sm"
                      variant={editForm.role === r ? 'primary' : 'secondary'} 
                      onClick={() => setEditForm({ ...editForm, role: r })}
                    >
                      {r}
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
    </div>
  );
}
