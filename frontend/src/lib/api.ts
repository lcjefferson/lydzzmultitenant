import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
    AuthResponse,
    LoginDto,
    RegisterDto,
    User,
    Organization,
    Agent,
    Channel,
    Conversation,
    Message,
    Lead,
    Webhook,
    DashboardMetrics,
    ConversationStats,
    LeadStats,
    CreateAgentDto,
    CreateChannelDto,
    CreateConversationDto,
    CreateMessageDto,
    CreateLeadDto,
    CreateUserDto,
    UpdateAgentDto,
    UpdateChannelDto,
    UpdateConversationDto,
    UpdateLeadDto,
    UpdateUserDto,
} from '@/types/api';

const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3001/api';

class ApiService {
    public api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.api.interceptors.request.use(
            (config) => {
                const token = this.getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling and token refresh
        this.api.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

                // If 401 and not already retried, try to refresh token
                if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const refreshToken = this.getRefreshToken();
                        if (refreshToken) {
                            const response = await this.api.post('/auth/refresh', {
                                refreshToken,
                            });
                            const { accessToken } = response.data;
                            this.setToken(accessToken);
                            if (!originalRequest.headers) originalRequest.headers = {};
                            (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
                            return this.api(originalRequest);
                        }
                    } catch (refreshError) {
                        this.clearTokens();
                        if (typeof window !== 'undefined') {
                            window.location.href = '/login';
                        }
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    // Token management
    getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('accessToken');
    }

    private getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('refreshToken');
    }

    private setToken(token: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', token);
        }
    }

    private setRefreshToken(token: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem('refreshToken', token);
        }
    }

    private clearTokens(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        }
    }

    // Auth endpoints
    async login(data: LoginDto): Promise<AuthResponse> {
        const response = await this.api.post<AuthResponse>('/auth/login', data);
        this.setToken(response.data.accessToken);
        this.setRefreshToken(response.data.refreshToken);
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    }

    async register(data: RegisterDto): Promise<AuthResponse> {
        const response = await this.api.post<AuthResponse>('/auth/register', data);
        this.setToken(response.data.accessToken);
        this.setRefreshToken(response.data.refreshToken);
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    }

    logout(): void {
        this.clearTokens();
    }

    getCurrentUser(): User | null {
        if (typeof window === 'undefined') return null;
        const user = localStorage.getItem('user');
        return user ? (JSON.parse(user) as User) : null;
    }

    // Organizations
    async getOrganizations(): Promise<Organization[]> {
        const response = await this.api.get<Organization[]>('/organizations');
        return response.data;
    }

    async getOrganization(id: string): Promise<Organization> {
        const response = await this.api.get<Organization>(`/organizations/${id}`);
        return response.data;
    }

    async updateOrganization(id: string, data: Partial<Organization> & Record<string, unknown>): Promise<Organization> {
        const response = await this.api.put<Organization>(`/organizations/${id}`, data);
        return response.data;
    }

    // Users
    async getUsers(): Promise<User[]> {
        const response = await this.api.get<User[]>('/users');
        return response.data;
    }

    async getUser(id: string): Promise<User> {
        const response = await this.api.get<User>(`/users/${id}`);
        return response.data;
    }

    async createUser(data: CreateUserDto): Promise<User> {
        const response = await this.api.post<User>('/users', data);
        return response.data;
    }

    async updateUser(id: string, data: UpdateUserDto): Promise<User> {
        const response = await this.api.put<User>(`/users/${id}`, data);
        return response.data;
    }

    async deleteUser(id: string): Promise<void> {
        await this.api.delete(`/users/${id}`);
    }

    // Agents
    async getAgents(): Promise<Agent[]> {
        const response = await this.api.get<Agent[]>('/agents');
        return response.data;
    }

    async getAgent(id: string): Promise<Agent> {
        const response = await this.api.get<Agent>(`/agents/${id}`);
        return response.data;
    }

    async createAgent(data: CreateAgentDto): Promise<Agent> {
        const response = await this.api.post<Agent>('/agents', data);
        return response.data;
    }

    async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent> {
        const response = await this.api.patch<Agent>(`/agents/${id}`, data);
        return response.data;
    }

    async deleteAgent(id: string): Promise<void> {
        await this.api.delete(`/agents/${id}`);
    }

    // Channels
    async getChannels(): Promise<Channel[]> {
        const response = await this.api.get<Channel[]>('/channels');
        return response.data;
    }

    async getChannel(id: string): Promise<Channel> {
        const response = await this.api.get<Channel>(`/channels/${id}`);
        return response.data;
    }

    async createChannel(data: CreateChannelDto): Promise<Channel> {
        const response = await this.api.post<Channel>('/channels', data);
        return response.data;
    }

    async updateChannel(id: string, data: UpdateChannelDto): Promise<Channel> {
        const response = await this.api.patch<Channel>(`/channels/${id}`, data);
        return response.data;
    }

    async deleteChannel(id: string): Promise<void> {
        await this.api.delete(`/channels/${id}`);
    }

    async getWhatsAppWebhookUrl(): Promise<{ webhookUrl: string | null }> {
        const response = await this.api.get<{ webhookUrl: string | null }>(
            '/webhooks/url'
        );
        return response.data;
    }

    async getWebhookHealth(): Promise<{
        publicWebhookUrl: string | null;
        verifyToken: string;
        whatsappChannelCount: number;
        inbound24hCount: number;
        lastInboundMessageAt: string | null;
    }> {
        const response = await this.api.get<{
            publicWebhookUrl: string | null;
            verifyToken: string;
            whatsappChannelCount: number;
            inbound24hCount: number;
            lastInboundMessageAt: string | null;
        }>('/webhooks/health');
        return response.data;
    }

    // Conversations
    async getConversations(): Promise<Conversation[]> {
        const response = await this.api.get<Conversation[]>('/conversations');
        return response.data;
    }

    async getConversation(id: string): Promise<Conversation> {
        const response = await this.api.get<Conversation>(`/conversations/${id}`);
        return response.data;
    }

    async createConversation(data: CreateConversationDto): Promise<Conversation> {
        const response = await this.api.post<Conversation>('/conversations', data);
        return response.data;
    }

    async updateConversation(id: string, data: UpdateConversationDto): Promise<Conversation> {
        const response = await this.api.patch<Conversation>(`/conversations/${id}`, data);
        return response.data;
    }

    async deleteConversation(id: string): Promise<void> {
        await this.api.delete(`/conversations/${id}`);
    }

    // Messages
    async getMessages(conversationId: string): Promise<Message[]> {
        const response = await this.api.get<Message[]>(`/messages?conversationId=${conversationId}`);
        return response.data;
    }

    async getMessage(id: string): Promise<Message> {
        const response = await this.api.get<Message>(`/messages/${id}`);
        return response.data;
    }

    async createMessage(data: CreateMessageDto): Promise<Message> {
        const response = await this.api.post<Message>('/messages', data);
        return response.data;
    }

    async deleteMessage(id: string): Promise<void> {
        await this.api.delete(`/messages/${id}`);
    }

    // Leads
    async getLeads(params?: {
        search?: string;
        temperature?: 'hot' | 'warm' | 'cold';
        status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
        source?: string;
    }): Promise<Lead[]> {
        const query = new URLSearchParams();
        if (params?.search) query.set('search', params.search);
        if (params?.temperature) query.set('temperature', params.temperature);
        if (params?.status) query.set('status', params.status);
        if (params?.source) query.set('source', params.source);
        const url = query.toString() ? `/leads?${query.toString()}` : '/leads';
        const response = await this.api.get<Lead[]>(url);
        return response.data;
    }

    async getLead(id: string): Promise<Lead> {
        const response = await this.api.get<Lead>(`/leads/${id}`);
        return response.data;
    }

    async createLead(data: CreateLeadDto): Promise<Lead> {
        const response = await this.api.post<Lead>('/leads', data);
        return response.data;
    }

    async updateLead(id: string, data: UpdateLeadDto): Promise<Lead> {
        const response = await this.api.patch<Lead>(`/leads/${id}`, data);
        return response.data;
    }

    async deleteLead(id: string): Promise<void> {
        await this.api.delete(`/leads/${id}`);
    }

    async addLeadTag(id: string, tag: string) {
        const response = await this.api.post(`/leads/${id}/tags`, { tag });
        return response.data;
    }

    async removeLeadTag(id: string, tag: string) {
        const response = await this.api.delete(`/leads/${id}/tags`, { data: { tag } });
        return response.data;
    }

    async addLeadComment(id: string, content: string) {
        const response = await this.api.post(`/leads/${id}/comments`, { content });
        return response.data;
    }

    async getLeadComments(id: string) {
        const response = await this.api.get(`/leads/${id}/comments`);
        return response.data as Array<{ id: string; content: string; userId?: string; createdAt: string }>;
    }

    // Webhooks
    async getWebhooks(): Promise<Webhook[]> {
        const response = await this.api.get<Webhook[]>('/webhooks');
        return response.data;
    }

    async getWebhook(id: string): Promise<Webhook> {
        const response = await this.api.get<Webhook>(`/webhooks/${id}`);
        return response.data;
    }

    // Analytics
    async getDashboardMetrics(): Promise<DashboardMetrics> {
        const response = await this.api.get<DashboardMetrics>('/analytics/dashboard');
        return response.data;
    }

    async getConversationStats(): Promise<ConversationStats> {
        const response = await this.api.get<ConversationStats>('/analytics/conversations');
        return response.data;
    }

    async getLeadStats(): Promise<LeadStats> {
        const response = await this.api.get<LeadStats>('/analytics/leads');
        return response.data;
    }
}

export const api = new ApiService();
