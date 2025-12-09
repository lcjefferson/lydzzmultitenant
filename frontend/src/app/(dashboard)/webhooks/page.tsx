'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Webhook as WebhookIcon, CheckCircle, XCircle, X, Trash2, Edit } from 'lucide-react';
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '@/hooks/api/use-webhooks';
import type { Webhook } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AVAILABLE_EVENTS = [
    'lead.created',
    'lead.updated',
    'lead.qualified',
    'conversation.new',
    'conversation.updated',
    'message.received',
];

export default function WebhooksPage() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
    const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        events: [] as string[],
        isActive: true,
    });

    const { data: webhooks, isLoading } = useWebhooks();
    const createWebhook = useCreateWebhook();
    const updateWebhook = useUpdateWebhook();
    const deleteWebhook = useDeleteWebhook();

    const handleCreateWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedWebhook) {
                await updateWebhook.mutateAsync({ id: selectedWebhook, data: formData });
            } else {
                await createWebhook.mutateAsync(formData);
            }
            closeModal();
        } catch (error) {
            console.error('Error saving webhook:', error);
        }
    };

    const handleDeleteWebhook = async () => {
        if (webhookToDelete) {
            try {
                await deleteWebhook.mutateAsync(webhookToDelete);
                setWebhookToDelete(null);
            } catch (error) {
                console.error('Error deleting webhook:', error);
            }
        }
    };

    const openEditModal = (webhook: Webhook) => {
        setSelectedWebhook(webhook.id);
        setFormData({
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            isActive: webhook.isActive,
        });
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setSelectedWebhook(null);
        setFormData({
            name: '',
            url: '',
            events: [],
            isActive: true,
        });
    };

    const toggleEvent = (event: string) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(event)
                ? prev.events.filter(e => e !== event)
                : [...prev.events, event]
        }));
    };

    return (
        <div>
            <Header
                title="Webhooks"
                description="Configure integrações via webhooks"
                actions={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        Novo Webhook
                    </Button>
                }
            />

            <div className="p-6 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
                            <p className="mt-4 text-gray-500">Carregando webhooks...</p>
                        </div>
                    </div>
                ) : (
                    webhooks?.map((webhook) => (
                        <Card key={webhook.id} className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                                        <WebhookIcon className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{webhook.name}</h3>
                                        <p className="text-sm text-text-secondary">{webhook.url}</p>
                                    </div>
                                </div>
                                {webhook.isActive ? (
                                    <CheckCircle className="h-5 w-5 text-success" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-error" />
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Eventos</p>
                                    <div className="flex flex-wrap gap-1">
                                        {webhook.events.map((event) => (
                                            <Badge key={event} variant="default" className="text-xs">
                                                {event}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Organização</p>
                                    <p className="text-sm font-medium">{webhook.organizationId}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-text-tertiary mb-1">Status</p>
                                    <Badge variant={webhook.isActive ? 'success' : 'default'}>
                                        {webhook.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-border">
                                <Button variant="secondary" onClick={() => openEditModal(webhook)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => setWebhookToDelete(webhook.id)}
                                    isLoading={deleteWebhook.isPending}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                </Button>
                            </div>
                        </Card>
                    ))
                )}

                {!isLoading && webhooks?.length === 0 && (
                    <div className="text-center py-12 text-text-secondary">
                        <WebhookIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhum webhook configurado</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={closeModal}
                >
                    <Card
                        className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                                <h2 className="text-2xl font-bold">
                                    {selectedWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="text-text-secondary hover:text-text-primary"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateWebhook} className="space-y-4">
                                <Input
                                    label="Nome"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: Integração CRM"
                                />

                                <Input
                                    label="URL do Webhook"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    required
                                    placeholder="https://api.exemplo.com/webhook"
                                />

                                <div>
                                    <label className="block text-sm font-medium mb-2">Eventos</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {AVAILABLE_EVENTS.map((event) => (
                                            <div
                                                key={event}
                                                className={`
                                                    p-2 rounded-md border cursor-pointer text-sm transition-colors
                                                    ${formData.events.includes(event)
                                                        ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                                                        : 'border-border hover:border-text-secondary'
                                                    }
                                                `}
                                                onClick={() => toggleEvent(event)}
                                            >
                                                {event}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Status</label>
                                    <select
                                        value={formData.isActive ? 'active' : 'inactive'}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                                        className="input w-full"
                                    >
                                        <option value="active">Ativo</option>
                                        <option value="inactive">Inativo</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button
                                        type="submit"
                                        className="flex-1"
                                        isLoading={createWebhook.isPending || updateWebhook.isPending}
                                    >
                                        {selectedWebhook ? 'Salvar Alterações' : 'Criar Webhook'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={closeModal}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {webhookToDelete && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setWebhookToDelete(null)}
                >
                    <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Confirmar Exclusão</h2>
                        <p className="mb-6">Tem certeza que deseja excluir este webhook? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="secondary" onClick={() => setWebhookToDelete(null)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleDeleteWebhook}
                                isLoading={deleteWebhook.isPending}
                            >
                                Excluir
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
