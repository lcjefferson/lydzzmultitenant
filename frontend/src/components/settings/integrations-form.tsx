'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { User, Organization } from '@/types/api';

export function IntegrationsForm() {
    const [loading, setLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
    const [editingKey, setEditingKey] = useState(false);

    // Mock initial data - in real app this would come from API
    const [formData, setFormData] = useState({
        openaiApiKey: '',
        openaiModel: 'gpt-4-turbo',
        openaiMaxTokens: 500,
        openaiTemperature: 0.7
    });

    useEffect(() => {
        const currentUser = api.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            // Fetch current organization settings if needed
            // For now we assume we are setting them fresh or need to fetch org details
            if (currentUser.organizationId) {
                loadOrganizationSettings(currentUser.organizationId);
            }
        }
    }, []);

    const loadOrganizationSettings = async (orgId: string) => {
        try {
            const org = await api.getOrganization(orgId);
            if (org) {
                setHasOpenAIKey(!!org.openaiApiKey);
                setFormData(prev => ({
                    ...prev,
                    openaiModel: org.openaiModel || 'gpt-4-turbo',
                    openaiMaxTokens: org.openaiMaxTokens || 500,
                    openaiTemperature: org.openaiTemperature || 0.7,
                    // We don't load the API key back for security, or maybe we do if we want to show it masked?
                    // Usually we leave it empty unless the user wants to change it.
                    openaiApiKey: ''
                }));
            }
        } catch (error) {
            console.error('Error loading organization settings:', error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'openaiMaxTokens' || name === 'openaiTemperature' ? Number(value) : value
        }));
    };

    const handleSelectChange = (value: string) => {
        setFormData(prev => ({ ...prev, openaiModel: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!user?.organizationId) {
                toast.error('Erro: Organização não encontrada');
                return;
            }

            const payload: Partial<Organization> & Record<string, unknown> = {
                openaiModel: formData.openaiModel,
                openaiMaxTokens: formData.openaiMaxTokens,
                openaiTemperature: formData.openaiTemperature,
            };

            if (formData.openaiApiKey && formData.openaiApiKey.trim().length > 0) {
                payload.openaiApiKey = formData.openaiApiKey.trim();
            }

            await api.updateOrganization(user.organizationId, payload);

            toast.success('Configurações salvas com sucesso!');
            if (payload.openaiApiKey) {
                setHasOpenAIKey(true);
            }
            setEditingKey(false);
            setShowKey(false);
            setFormData(prev => ({ ...prev, openaiApiKey: '' }));
        } catch (error) {
            toast.error('Erro ao salvar configurações');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>OpenAI Integration</CardTitle>
                <CardDescription>
                    Configure sua chave de API da OpenAI para habilitar os recursos de IA.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6 text-neutral-900">
                    <div className="space-y-2">
                        <Label htmlFor="openaiApiKey" className="text-neutral-900">API Key</Label>
                        <div className="relative">
                            <Input
                                id="openaiApiKey"
                                name="openaiApiKey"
                                type={showKey && editingKey ? "text" : "password"}
                                placeholder={hasOpenAIKey ? "Chave configurada" : "sk-..."}
                                value={editingKey ? formData.openaiApiKey : hasOpenAIKey ? "••••••••••" : formData.openaiApiKey}
                                onChange={handleChange}
                                disabled={hasOpenAIKey && !editingKey}
                                className="pr-28"
                            />
                            <div className="absolute right-0 top-0 h-full flex items-center gap-1 pr-2">
                                {hasOpenAIKey && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setEditingKey((prev) => {
                                                const next = !prev;
                                                if (next) {
                                                    setShowKey(false);
                                                    setFormData(p => ({ ...p, openaiApiKey: '' }));
                                                } else {
                                                    setFormData(p => ({ ...p, openaiApiKey: '' }));
                                                }
                                                return next;
                                            });
                                        }}
                                    >
                                        {editingKey ? 'Cancelar' : 'Editar'}
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-transparent"
                                    disabled={!editingKey}
                                    onClick={() => setShowKey(!showKey)}
                                >
                                    {showKey ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {hasOpenAIKey
                                ? (editingKey
                                    ? 'Digite uma nova chave para substituir a atual.'
                                    : 'Uma chave está configurada e está oculta. Clique em Editar para alterar.')
                                : 'Sua chave será armazenada de forma segura e criptografada.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="openaiModel" className="text-neutral-900">Modelo</Label>
                            <Select
                                value={formData.openaiModel}
                                onValueChange={handleSelectChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o modelo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="openaiMaxTokens" className="text-neutral-900">Max Tokens</Label>
                            <Input
                                id="openaiMaxTokens"
                                name="openaiMaxTokens"
                                type="number"
                                min={100}
                                max={4000}
                                value={formData.openaiMaxTokens}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="openaiTemperature" className="text-neutral-900">Temperatura (0-1)</Label>
                            <Input
                                id="openaiTemperature"
                                name="openaiTemperature"
                                type="number"
                                min={0}
                                max={1}
                                step={0.1}
                                value={formData.openaiTemperature}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Salvar Configurações
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
