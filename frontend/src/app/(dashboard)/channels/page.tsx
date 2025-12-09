'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
    Plus,
    MessageCircle,
    Instagram,
    Facebook,
    Mail,
    Settings,
    CheckCircle,
    XCircle,
    X,
} from 'lucide-react';
import { useChannels, useChannel, useCreateChannel, useUpdateChannel, useDeleteChannel } from '@/hooks/api/use-channels';

const channelIcons = {
    whatsapp: MessageCircle,
    instagram: Instagram,
    facebook: Facebook,
    email: Mail,
};

export default function ChannelsPage() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'whatsapp' as 'whatsapp' | 'instagram',
        identifier: '',
        config: {},
    });
    const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
    const [waAccessToken, setWaAccessToken] = useState('');

    const { data: channels, isLoading } = useChannels();
    const { data: currentChannel } = useChannel(selectedChannel || '');
    const createChannel = useCreateChannel();
    const updateChannel = useUpdateChannel();
    const deleteChannel = useDeleteChannel();

    const { data: webhookData, refetch: refetchWebhook } = useQuery({
        queryKey: ['whatsappWebhookUrl'],
        queryFn: () => api.getWhatsAppWebhookUrl(),
        refetchInterval: selectedChannel ? 5000 : false,
        enabled: true,
    });

    const { data: webhookHealth, refetch: refetchHealth } = useQuery({
        queryKey: ['webhookHealth'],
        queryFn: () => api.getWebhookHealth(),
        refetchInterval: selectedChannel ? 10000 : false,
        enabled: true,
    });

    // WhatsApp config is initialized when opening the Configure modal

    const handleCreateChannel = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createChannel.mutateAsync(formData);
            setShowCreateModal(false);
            setFormData({ name: '', type: 'whatsapp', identifier: '', config: {} });
        } catch (error) {
            console.error('Error creating channel:', error);
        }
    };

    const handleToggleChannel = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            await updateChannel.mutateAsync({
                id,
                data: { status: newStatus },
            });
        } catch (error) {
            console.error('Error toggling channel:', error);
        }
    };

    const handleDeleteChannel = async () => {
        if (channelToDelete) {
            try {
                await deleteChannel.mutateAsync(channelToDelete);
                setSelectedChannel(null);
                setChannelToDelete(null);
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }
    };

    return (
        <div>
            <Header
                title="Canais"
                description="Gerencie seus canais de comunicação"
                actions={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        Novo Canal
                    </Button>
                }
            />

            <div className="p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
                            <p className="mt-4 text-gray-500">Carregando canais...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {channels && channels.length > 0 ? (
                            channels.map((channel) => {
                                const Icon = channelIcons[channel.type as keyof typeof channelIcons] || MessageCircle;

                                return (
                                    <Card key={channel.id} className="p-6 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                                                    <Icon className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{channel.name}</h3>
                                                    <p className="text-sm text-text-secondary capitalize">{channel.type}</p>
                                                </div>
                                            </div>
                                            {channel.status === 'active' ? (
                                                <CheckCircle className="h-5 w-5 text-success" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-error" />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant={channel.status === 'active' ? 'success' : 'default'}>
                                                {channel.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>

                                        <div className="flex gap-2 pt-4 border-t border-border">
                                            <Button
                                                variant="secondary"
                                                className="flex-1"
                                                onClick={() => {
                                                    setSelectedChannel(channel.id);
                                                    if (channel.type === 'whatsapp') {
                                                        const cfg = (channel.config || {}) as Record<string, unknown>;
                                                        const phoneId = (cfg.phoneNumberId as string) || '';
                                                        const token = channel.accessToken || '';
                                                        setWaPhoneNumberId(phoneId);
                                                        setWaAccessToken(token);
                                                    }
                                                }}
                                            >
                                                <Settings className="h-4 w-4" />
                                                Configurar
                                            </Button>
                                            <Button
                                                variant={channel.status === 'active' ? 'ghost' : 'primary'}
                                                className="flex-1"
                                                onClick={() => handleToggleChannel(channel.id, channel.status)}
                                                disabled={updateChannel.isPending}
                                            >
                                                {channel.status === 'active' ? 'Pausar' : 'Ativar'}
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })
                        ) : null}

                        {/* Create New Card */}
                        <Card
                            className="p-6 h-full min-h-[250px] flex flex-col items-center justify-center gap-4 hover:border-accent-primary cursor-pointer transition-all"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center">
                                <Plus className="h-8 w-8 text-accent-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold mb-1">Adicionar Canal</h3>
                                <p className="text-sm text-text-secondary">
                                    Conecte um novo canal de comunicação
                                </p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Create Channel Modal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setShowCreateModal(false)}
                >
                    <Card
                        className="w-full max-w-md m-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                                <h2 className="text-2xl font-bold">Novo Canal</h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-text-secondary hover:text-text-primary"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateChannel} className="space-y-4">
                                <Input
                                    label="Nome do Canal"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: WhatsApp Principal"
                                />

                                <Input
                                    label="Identificador"
                                    value={formData.identifier}
                                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                                    required
                                    placeholder="Ex: +5511999999999"
                                />

                                <div>
                                    <label className="block text-sm font-medium mb-2">Tipo de Canal</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'whatsapp' | 'instagram' })}
                                        className="input"
                                    >
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="instagram">Instagram</option>
                                    </select>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button type="submit" className="flex-1" isLoading={createChannel.isPending}>
                                        Criar Canal
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => setShowCreateModal(false)}
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
            {channelToDelete && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setChannelToDelete(null)}
                >
                    <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Confirmar Exclusão</h2>
                        <p className="mb-6">Tem certeza que deseja excluir este canal?</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="secondary" onClick={() => setChannelToDelete(null)}>
                                Cancelar
                            </Button>
                            <Button variant="danger" onClick={handleDeleteChannel} isLoading={deleteChannel.isPending}>
                                Excluir
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Edit/Configure Channel Modal */}
            {selectedChannel && currentChannel && (() => {
                const channel = currentChannel;
                return (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setSelectedChannel(null)}
                    >
                        <Card
                            className="w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold">Configurar Canal</h2>
                                        <p className="text-sm text-text-secondary mt-1">{channel.name}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedChannel(null)}
                                        className="text-text-secondary hover:text-text-primary"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Tipo</p>
                                            <p className="text-sm font-medium capitalize">{channel.type}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Identificador</p>
                                            <p className="text-sm font-medium">{channel.identifier}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-text-tertiary mb-1">Status</p>
                                            <Badge variant={channel.status === 'active' ? 'success' : 'default'}>
                                                {channel.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* WhatsApp Configuration */}
                                    {channel.type === 'whatsapp' && (
                                        <div className="border border-border rounded-lg p-4 space-y-4">
                                            <h3 className="font-semibold flex items-center gap-2">
                                                <MessageCircle className="h-5 w-5 text-success" />
                                                Configuração WhatsApp Business API
                                            </h3>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Phone Number ID</label>
                                                    <Input
                                                        placeholder="Ex: 123456789012345"
                                                        value={waPhoneNumberId}
                                                        onChange={(e) => setWaPhoneNumberId(e.target.value)}
                                                    />
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        Obtido no Meta Business Manager
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Access Token</label>
                                                    <Input
                                                        type="password"
                                                        placeholder="EAAG..."
                                                        value={waAccessToken}
                                                        onChange={(e) => setWaAccessToken(e.target.value)}
                                                    />
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        Token permanente do WhatsApp Business API
                                                    </p>
                                                </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                                                {webhookData?.webhookUrl ? (
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={webhookData.webhookUrl}
                                                            readOnly
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(webhookData.webhookUrl!);
                                                                alert('URL copiada!');
                                                            }}
                                                        >
                                                            Copiar
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-text-secondary">
                                                            Nenhum URL público detectado. Inicie o ngrok e tente novamente.
                                                        </p>
                                                        <div className="flex gap-2">
                                                            <Input value="" placeholder="Aguardando URL pública..." readOnly className="flex-1" />
                                                            <Button variant="secondary" onClick={() => refetchWebhook()}>Detectar</Button>
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-xs text-text-tertiary mt-1">
                                                    Configure esta URL no Meta Business Manager
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-2">Diagnóstico</label>
                                                <div className="grid grid-cols-2 gap-3 items-end">
                                                    <div>
                                                        <p className="text-xs text-text-tertiary">Última entrada</p>
                                                        <p className="text-sm font-medium">
                                                            {webhookHealth?.lastInboundMessageAt
                                                                ? new Date(webhookHealth.lastInboundMessageAt).toLocaleString('pt-BR')
                                                                : 'Sem dados'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-text-tertiary">Mensagens (24h)</p>
                                                        <p className="text-sm font-medium">{webhookHealth?.inbound24hCount ?? 0}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    <Button variant="secondary" onClick={() => refetchHealth()}>Atualizar</Button>
                                                </div>
                                            </div>

                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Verify Token</label>
                                                    {(() => {
                                                        const cfg = (channel.config || {}) as Record<string, unknown>;
                                                        const verifyToken = typeof cfg.verifyToken === 'string' ? (cfg.verifyToken as string) : 'smarterchat_verify_token';
                                                        return (
                                                            <Input value={verifyToken} readOnly />
                                                        );
                                                    })()}
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        Use este token na verificação do webhook
                                                    </p>
                                                </div>

                                                <div className="flex gap-2 pt-2">
                                                    <Button
                                                        onClick={async () => {
                                                            try {
                                                                await updateChannel.mutateAsync({
                                                                    id: channel.id,
                                                                    data: {
                                                                        accessToken: waAccessToken,
                                                                        config: {
                                                                            ...((channel.config || {}) as Record<string, unknown>),
                                                                            phoneNumberId: waPhoneNumberId,
                                                                            verifyToken: ((): string => {
                                                                                const cfg = (channel.config || {}) as Record<string, unknown>;
                                                                                return typeof cfg.verifyToken === 'string' ? (cfg.verifyToken as string) : 'smarterchat_verify_token';
                                                                            })(),
                                                                        },
                                                                    },
                                                                });
                                                            } catch (error) {
                                                                console.error('Error updating WhatsApp config:', error);
                                                            }
                                                        }}
                                                        isLoading={updateChannel.isPending}
                                                    >
                                                        Salvar Configuração
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram Configuration */}
                                    {channel.type === 'instagram' && (
                                        <div className="border border-border rounded-lg p-4 space-y-4">
                                            <h3 className="font-semibold flex items-center gap-2">
                                                <Instagram className="h-5 w-5 text-pink-500" />
                                                Configuração Instagram Graph API
                                            </h3>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Instagram Business Account ID</label>
                                                    <Input
                                                        placeholder="Ex: 17841400000000000"
                                                        defaultValue={String(((channel.config as Record<string, unknown>)?.instagramAccountId) ?? '')}
                                                        disabled
                                                    />
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        ID da conta comercial do Instagram
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Page Access Token</label>
                                                    <Input
                                                        type="password"
                                                        placeholder="EAAG..."
                                                        defaultValue={channel.accessToken || ''}
                                                        disabled
                                                    />
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        Token da página do Facebook vinculada
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Webhook URL</label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/api/webhooks/instagram/${channel.id}`}
                                                            readOnly
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/api/webhooks/instagram/${channel.id}`);
                                                                alert('URL copiada!');
                                                            }}
                                                        >
                                                            Copiar
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-text-tertiary mt-1">
                                                        Configure no Meta Business Manager
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t border-border">
                                        <Button
                                            variant={channel.status === 'active' ? 'ghost' : 'primary'}
                                            className="flex-1"
                                            onClick={() => handleToggleChannel(channel.id, channel.status)}
                                            isLoading={updateChannel.isPending}
                                        >
                                            {channel.status === 'active' ? 'Pausar Canal' : 'Ativar Canal'}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            className="flex-1"
                                            onClick={() => setChannelToDelete(channel.id)}
                                            isLoading={deleteChannel.isPending}
                                        >
                                            Excluir Canal
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}
        </div>
    );
}
