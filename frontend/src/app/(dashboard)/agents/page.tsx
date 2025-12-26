'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Bot,
    MoreVertical,
    Settings,
    X,
} from 'lucide-react';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '@/hooks/api/use-agents';

export default function AgentsPage() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        personality: '',
        systemMessage: '',
        model: 'gpt-4-turbo',
        temperature: 0.7,
    });

    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

    const { data: agents, isLoading } = useAgents();
    const createAgent = useCreateAgent();
    const updateAgent = useUpdateAgent();
    const deleteAgent = useDeleteAgent();

    const handleCreateOrUpdateAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAgentId) {
                await updateAgent.mutateAsync({
                    id: editingAgentId,
                    data: formData,
                });
            } else {
                await createAgent.mutateAsync(formData);
            }
            closeModal();
        } catch (error) {
            console.error('Error saving agent:', error);
        }
    };

    const handleEditAgent = (agent: import('@/types/api').Agent) => {
        setEditingAgentId(agent.id);
        setFormData({
            name: agent.name,
            description: agent.description || '',
            personality: agent.personality || '',
            systemMessage: agent.systemMessage || '',
            model: agent.model,
            temperature: agent.temperature,
        });
        setShowCreateModal(true);
        setSelectedAgent(null); // Close details modal if open
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingAgentId(null);
        setFormData({
            name: '',
            description: '',
            personality: '',
            systemMessage: '',
            model: 'gpt-4-turbo',
            temperature: 0.7,
        });
    };

    const handleToggleAgent = async (id: string, isActive: boolean) => {
        try {
            await updateAgent.mutateAsync({
                id,
                data: { isActive: !isActive },
            });
        } catch (error) {
            console.error('Error toggling agent:', error);
        }
    };

    const handleDeleteAgent = async () => {
        if (agentToDelete) {
            try {
                await deleteAgent.mutateAsync(agentToDelete);
                setSelectedAgent(null);
                setAgentToDelete(null);
            } catch (error) {
                console.error('Error deleting agent:', error);
            }
        }
    };

    return (
        <div>
            <Header
                title="Agentes"
                description="Gerencie seus agentes de IA"
                actions={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        Novo Agente
                    </Button>
                }
            />

            <div className="p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
                            <p className="mt-4 text-gray-500">Carregando agentes...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents && agents.length > 0 ? (
                            agents.map((agent) => (
                                <Card key={agent.id} className="p-6 space-y-4">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                fallback={<Bot className="h-5 w-5" />}
                                                size="lg"
                                            />
                                            <div>
                                                <h3 className="font-semibold text-text-primary">{agent.name}</h3>
                                                <p className="text-sm text-text-secondary">{agent.model}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedAgent(agent.id)}
                                            className="p-2 hover:bg-surface rounded-md transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {/* Description */}
                                    {agent.description && (
                                        <p className="text-sm text-text-secondary line-clamp-2">
                                            {agent.description}
                                        </p>
                                    )}

                                    {/* Status and Badges */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant={agent.isActive ? 'success' : 'default'}>
                                            {agent.isActive ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                        <Badge variant="default">
                                            Temp: {agent.temperature}
                                        </Badge>
                                    </div>

                                    {/* Personality */}
                                    {agent.personality && (
                                        <div className="pt-2 border-t border-border">
                                            <p className="text-xs text-text-tertiary mb-1">Personalidade</p>
                                            <p className="text-sm line-clamp-2">{agent.personality}</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t border-border">
                                        <Button
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => handleEditAgent(agent)}
                                        >
                                            <Settings className="h-4 w-4" />
                                            Editar
                                        </Button>
                                        <Button
                                            variant={agent.isActive ? 'ghost' : 'primary'}
                                            className="flex-1"
                                            onClick={() => handleToggleAgent(agent.id, agent.isActive)}
                                            disabled={updateAgent.isPending}
                                        >
                                            {agent.isActive ? 'Pausar' : 'Ativar'}
                                        </Button>
                                        <Button
                                            variant="danger"
                                            className="flex-1"
                                            onClick={() => {
                                                setSelectedAgent(null);
                                                setAgentToDelete(agent.id);
                                            }}
                                            isLoading={deleteAgent.isPending}
                                        >
                                            Excluir
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        ) : null}

                        {/* Create New Card */}
                        <Card
                            className="p-6 h-full min-h-[300px] flex flex-col items-center justify-center gap-4 hover:border-accent-primary cursor-pointer transition-all"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center">
                                <Plus className="h-8 w-8 text-accent-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold mb-1 text-neutral-900">Criar Novo Agente</h3>
                                <p className="text-sm text-text-secondary">
                                    Configure um novo agente de IA
                                </p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Create/Edit Agent Modal */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]"
                    onClick={closeModal}
                >
                    <Card
                        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 bg-white text-text-primary"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-6">
                                <h2 className="text-2xl font-bold text-neutral-900">
                                    {editingAgentId ? 'Editar Agente' : 'Novo Agente'}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="text-text-secondary hover:text-neutral-900"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateOrUpdateAgent} className="space-y-4">
                                <Input
                                    label="Nome"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Descrição"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                                <Input
                                    label="Personalidade"
                                    value={formData.personality}
                                    onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                                    placeholder="Ex: Profissional e amigável"
                                />
                                <div>
                                    <label className="block text-sm font-medium mb-2">System Message</label>
                                    <textarea
                                        value={formData.systemMessage}
                                        onChange={(e) => setFormData({ ...formData, systemMessage: e.target.value })}
                                        className="input resize-none"
                                        rows={4}
                                        placeholder="Instruções para o agente..."
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Modelo</label>
                                        <select
                                            value={formData.model}
                                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                            className="input"
                                        >
                                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                            <option value="gpt-4">GPT-4</option>
                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        </select>
                                    </div>
                                    <Input
                                        label="Temperatura"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={formData.temperature}
                                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button type="submit" className="flex-1" isLoading={createAgent.isPending || updateAgent.isPending}>
                                        {editingAgentId ? 'Salvar Alterações' : 'Criar Agente'}
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

            {/* Agent Details Modal */}
            {selectedAgent && (() => {
                const agent = agents?.find((a) => a.id === selectedAgent);
                if (!agent) return null;

                return (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]"
                        onClick={() => setSelectedAgent(null)}
                    >
                        <Card
                            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 space-y-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-text-primary">{agent.name}</h2>
                                        {agent.description && (
                                            <p className="text-text-secondary mt-1">{agent.description}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedAgent(null)}
                                        className="text-text-secondary hover:text-text-primary"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Badge variant={agent.isActive ? 'success' : 'default'}>
                                        {agent.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                    <span className="text-sm text-text-secondary">
                                        Modelo: <span className="font-medium">{agent.model}</span>
                                    </span>
                                    <span className="text-sm text-text-secondary">
                                        Temperatura: <span className="font-medium">{agent.temperature}</span>
                                    </span>
                                </div>

                                {agent.personality && (
                                    <div>
                                        <p className="text-sm text-text-tertiary mb-2">Personalidade</p>
                                        <p className="text-sm">{agent.personality}</p>
                                    </div>
                                )}

                                <div>
                                    <p className="text-sm text-text-tertiary mb-2">System Message</p>
                                    <div className="bg-surface p-4 rounded-lg">
                                        <p className="text-sm whitespace-pre-wrap">{agent.systemMessage}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => handleEditAgent(agent)}
                                    >
                                        <Settings className="h-4 w-4" />
                                        Editar
                                    </Button>
                                    <Button
                                        variant={agent.isActive ? 'ghost' : 'primary'}
                                        className="flex-1"
                                        onClick={() => handleToggleAgent(agent.id, agent.isActive)}
                                        disabled={updateAgent.isPending}
                                    >
                                        {agent.isActive ? 'Pausar' : 'Ativar'}
                                    </Button>
                                    <Button
                                        variant="danger"
                                        className="flex-1"
                                        onClick={() => {
                                            setSelectedAgent(null);
                                            setAgentToDelete(agent.id);
                                        }}
                                        isLoading={deleteAgent.isPending}
                                    >
                                        Excluir
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}

            {/* Delete Confirmation Modal */}
            {agentToDelete && (() => {
                const agent = agents?.find((a) => a.id === agentToDelete);
                if (!agent) return null;

                return (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]"
                        onClick={() => setAgentToDelete(null)}
                    >
                        <Card
                            className="w-full max-w-md m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold text-red-600">Confirmar Exclusão</h2>
                                    <p className="text-text-secondary mt-2">
                                        Tem certeza que deseja excluir o agente <strong>{agent.name}</strong>?
                                    </p>
                                    <p className="text-sm text-text-tertiary mt-1">
                                        Esta ação não pode ser desfeita.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="danger"
                                        className="flex-1"
                                        onClick={handleDeleteAgent}
                                        isLoading={deleteAgent.isPending}
                                    >
                                        Sim, Excluir
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => setAgentToDelete(null)}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}
        </div>
    );
}
