'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { User, Building, Mail, Phone, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationsForm } from '@/components/settings/integrations-form';

export default function SettingsPage() {
    return (
        <div>
            <Header title="Configurações" description="Gerencie suas preferências e conta" />

            <div className="p-6 max-w-4xl space-y-6">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="organization">Organização</TabsTrigger>
                        <TabsTrigger value="integrations">Integrações</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-6 mt-6">
                        {/* Profile */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Perfil do Usuário</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Avatar fallback="JS" size="lg" />
                                    <Button variant="secondary">Alterar Foto</Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Nome Completo" defaultValue="João Silva" />
                                    <Input label="Email" type="email" defaultValue="joao@empresa.com" />
                                    <Input label="Telefone" defaultValue="+55 11 99999-9999" />
                                    <Input label="Cargo" defaultValue="Admin" />
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Organização</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Nome da Empresa" defaultValue="Minha Empresa" />
                                    <Input label="Plano" defaultValue="Professional" disabled />
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
                </Tabs>
            </div>
        </div>
    );
}
