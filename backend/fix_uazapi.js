
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log('🛠️  Iniciando Correção Automática Uazapi...');
    
    // Dados fornecidos pelo usuário
    const targetToken = 'a235279d-5a23-433b-a8c0-ca9b6da76e4a';
    const targetServer = 'https://fortalabs.uazapi.com';
    // Geralmente o Instance ID é o nome ou ID. Se o usuário passou o token como ID, vamos usar o mesmo, 
    // mas o crucial é o campo 'token' estar preenchido.
    const targetInstanceId = 'a235279d-5a23-433b-a8c0-ca9b6da76e4a'; 
    
    // Buscar canal whatsapp
    const channel = await prisma.channel.findFirst({
        where: { type: 'whatsapp' } 
    });
    
    if (!channel) {
        console.error('❌ Canal WhatsApp não encontrado!');
        return;
    }
    
    console.log(`✅ Canal encontrado: ${channel.name} (ID: ${channel.id})`);
    
    // Atualizar configuração
    const currentConfig = channel.config || {};
    
    const newConfig = {
        ...currentConfig,
        provider: 'uazapi',
        serverUrl: targetServer,
        instanceId: targetInstanceId,
        token: targetToken, // O CAMPO MAIS IMPORTANTE
        // Definindo a URL do webhook explicitamente para ajudar na visualização
        webhookUrl: 'https://lydzz.com.br/api/webhooks/uazapi'
    };
    
    await prisma.channel.update({
        where: { id: channel.id },
        data: {
            config: newConfig
        }
    });
    
    console.log('\n✅ Configuração atualizada com sucesso no Banco de Dados!');
    console.log('--------------------------------------------------');
    console.log('Nova Configuração Aplicada:');
    console.log(`   Provider: ${newConfig.provider}`);
    console.log(`   Server URL: ${newConfig.serverUrl}`);
    console.log(`   Token: ${newConfig.token.substring(0, 10)}... (Preenchido!)`);
    console.log(`   Webhook URL: ${newConfig.webhookUrl}`);
    console.log('--------------------------------------------------');
    console.log('👉 Agora tente enviar uma mensagem novamente.');
}

fix()
    .catch(e => console.error('❌ Erro fatal:', e))
    .finally(async () => await prisma.$disconnect());
