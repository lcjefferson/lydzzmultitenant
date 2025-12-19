// API Types matching backend DTOs

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'manager' | 'consultant';
    organizationId: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: 'starter' | 'professional' | 'enterprise';
    isActive: boolean;
    openaiApiKey?: string;
    openaiModel?: string;
    openaiMaxTokens?: number;
    openaiTemperature?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Agent {
    id: string;
    name: string;
    description?: string;
    personality?: string;
    systemMessage: string;
    model: string;
    temperature: number;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Channel {
    id: string;
    type: 'whatsapp' | 'instagram' | 'facebook' | 'email' | 'internal';
    provider: 'whatsapp-official' | 'uazapi';
    name: string;
    identifier: string;
    accessToken?: string;
    config?: Record<string, unknown>;
    status: 'active' | 'inactive' | 'error';
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Conversation {
  id: string;
  contactName: string;
  contactIdentifier: string;
  status: 'active' | 'waiting' | 'closed';
  channelId: string;
  agentId?: string;
  assignedToId?: string;
  organizationId: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
  agent?: Agent;
  assignedTo?: User;
  lead?: Lead;
}

export interface Message {
    id: string;
    conversationId: string;
    type: 'text' | 'image' | 'file' | 'audio';
    content: string;
    senderType: 'contact' | 'ai' | 'user';
    confidence?: number;
    metadata?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Lead {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    temperature: 'hot' | 'warm' | 'cold';
    score: number;
    status: 'Lead Novo' | 'Em Qualificação' | 'Qualificado (QUENTE)' | 'Reuniões Agendadas' | 'Proposta enviada (Follow-up)' | 'No Show (Não compareceu) (Follow-up)' | 'Contrato fechado';
    source?: string;
    interest?: string;
    customFields?: Record<string, unknown>;
    organizationId: string;
    assignedToId?: string;
    assignedTo?: User;
    createdAt: Date;
    updatedAt: Date;
}

export interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    secret?: string;
    isActive: boolean;
    timeout: number;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DashboardMetrics {
    totalConversations: number;
    activeLeads: number;
    totalMessages: number;
    totalAgents: number;
}

export interface ConversationStats {
    byStatus: Array<{ status: string; _count: { id: number } }>;
    byChannel: Array<{ channelId: string; _count: { id: number } }>;
}

export interface LeadStats {
    byStatus: Array<{ status: string; _count: { id: number } }>;
    byTemperature: Array<{ temperature: string; _count: { id: number } }>;
}

// Auth types
export interface LoginDto {
    email: string;
    password: string;
}

export interface RegisterDto {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
    };
}

// Create DTOs
export interface CreateAgentDto {
    name: string;
    description?: string;
    personality?: string;
    systemMessage: string;
    model?: string;
    temperature?: number;
    isActive?: boolean;
}

export interface CreateChannelDto {
    type: 'whatsapp' | 'instagram';
    provider?: 'whatsapp-official' | 'uazapi';
    name: string;
    identifier: string;
    accessToken?: string;
    config?: Record<string, unknown>;
    status?: string;
}

export interface CreateConversationDto {
    contactName: string;
    contactIdentifier: string;
    channelId: string;
    status?: string;
}

export interface CreateMessageDto {
    conversationId: string;
    type?: 'text' | 'image' | 'file' | 'audio' | 'video';
    content: string;
    senderType: 'contact' | 'ai' | 'user';
    confidence?: number;
    metadata?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
}

export interface CreateLeadDto {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    temperature?: 'hot' | 'warm' | 'cold';
    score?: number;
    status?: string;
    source?: string;
    interest?: string;
    customFields?: Record<string, unknown>;
}

export interface CreateUserDto {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'manager' | 'consultant';
}

// Update DTOs (Partial of Create DTOs)
export type UpdateAgentDto = Partial<CreateAgentDto>;
export type UpdateChannelDto = Partial<CreateChannelDto>;
export type UpdateConversationDto = Partial<CreateConversationDto> & {
    agentId?: string;
    assignedToId?: string;
};
export type UpdateLeadDto = Partial<CreateLeadDto>;
export type UpdateUserDto = Partial<CreateUserDto>;
