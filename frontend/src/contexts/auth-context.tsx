'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { LoginDto, RegisterDto, AuthResponse } from '@/types/api';
import { toast } from 'sonner';

interface AuthContextType {
    user: AuthResponse['user'] | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (data: LoginDto) => Promise<void>;
    register: (data: RegisterDto) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthResponse['user'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check if user is logged in on mount
        const currentUser = api.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        }
        setIsLoading(false);
    }, []);

    // logout and refreshToken must be defined before using them in effects

    const login = async (data: LoginDto) => {
        try {
            setIsLoading(true);
            const response = await api.login(data);
            setUser(response.user);
            toast.success('Login realizado com sucesso!');
            // Use window.location instead of router.push to ensure full page reload
            // This ensures the RouteGuard picks up the new auth state
            window.location.href = '/dashboard';
        } catch (error: unknown) {
            type ApiErrorResp = { response?: { data?: { message?: string } } };
            const e = error as ApiErrorResp;
            console.error('Login error:', error);
            toast.error(e.response?.data?.message || 'Erro ao fazer login');
            throw error as Error;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (data: RegisterDto) => {
        try {
            setIsLoading(true);
            console.log('Attempting registration with data:', { ...data, password: '***' });
            const response = await api.register(data);
            setUser(response.user);
            toast.success('Cadastro realizado com sucesso!');
            // Use window.location instead of router.push to ensure full page reload
            window.location.href = '/dashboard';
        } catch (error: unknown) {
            type ApiErrorResp = { response?: { data?: { message?: string } }; message?: string; status?: number };
            const e = error as ApiErrorResp;
            console.error('Register error:', error);

            if (e.response?.data?.message) {
                const message = Array.isArray(e.response.data.message)
                    ? e.response.data.message.join(', ')
                    : e.response.data.message;
                toast.error(message);
            } else if (e.status === 400) {
                toast.error('Dados inválidos. Verifique se a senha tem pelo menos 8 caracteres.');
            } else if (e.message) {
                toast.error(e.message);
            } else {
                toast.error('Erro ao fazer cadastro. Tente novamente.');
            }
            throw error as Error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = useCallback(async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (token) {
                // Call backend logout endpoint to blacklist token
                await api.api.post('/auth/logout');
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local state regardless of API call success
            api.logout();
            setUser(null);
            toast.success('Logout realizado com sucesso!');
            router.push('/login');
        }
    }, [router]);

    const refreshToken = useCallback(async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token');
            }

            const response = await api.api.post('/auth/refresh', { refreshToken });
            const { accessToken } = response.data;

            localStorage.setItem('accessToken', accessToken);
        } catch (error) {
            console.error('Token refresh error:', error);
            // If refresh fails, logout user
            await logout();
        }
    }, [logout]);

    // Auto-refresh token before expiration
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            refreshToken();
        }, 14 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user, refreshToken]);

    const isAuthed = !!user && (typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: isAuthed,
                login,
                register,
                logout,
                refreshToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
