
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('================================================');
    console.log('       DIAGNÓSTICO DE CONFIGURAÇÃO UAZAPI       ');
    console.log('================================================');
    console.log(`Data: ${new Date().toISOString()}`);
    
    // 1. Verificar Variáveis de Ambiente
    console.log('\n[1] Verificando Variáveis de Ambiente (.env):');
    const envVars = [
        'APP_URL', 
        'UAZAPI_API_URL', 
        'UAZAPI_INSTANCE_TOKEN',
        'DATABASE_URL'
    ];
    
    let appUrlDefined = false;

    envVars.forEach(v => {
        const val = process.env[v];
        if (v === 'APP_URL' && val) appUrlDefined = true;
        
        if (v.includes('TOKEN') || (v.includes('URL') && v.includes('DATABASE'))) {
             console.log(`   ${v}: ${val ? '✅ Definido' : '❌ NÃO DEFINIDO'}`);
        } else {
             console.log(`   ${v}: ${val || '❌ NÃO DEFINIDO'}`);
        }
    });

    if (!appUrlDefined) {
        console.warn('\n   ⚠️  ALERTA: APP_URL não está definida!');
        console.warn('      Sem APP_URL, o sistema não sabe o endereço público da VPS.');
        console.warn('      Isso faz com que a URL do Webhook apareça como "localhost" ou vazia.');
        console.warn('      SOLUÇÃO: Adicione APP_URL=https://seu-dominio-ou-ip.com no arquivo .env');
    }

    // 2. Verificar Canais no Banco de Dados
    console.log('\n[2] Verificando Canais no Banco de Dados:');
    let channels = [];
    try {
        channels = await prisma.channel.findMany({
            where: { type: 'whatsapp' }
        });
    } catch (e) {
        console.error('   ❌ Erro ao conectar no banco de dados:', e.message);
        return;
    }

    if (channels.length === 0) {
        console.error('   ❌ Nenhum canal WhatsApp encontrado no banco de dados.');
    } else {
        console.log(`   Encontrados ${channels.length} canais WhatsApp.`);
        
        for (const channel of channels) {
            console.log(`\n   ------------------------------------------------`);
            console.log(`   Canal: ${channel.name} (ID: ${channel.id})`);
            console.log(`   Status: ${channel.status}`);
            
            const cfg = channel.config || {};
            const provider = cfg.provider || 'whatsapp-official';
            console.log(`   Provider configurado: ${provider}`);
            
            if (provider === 'uazapi') {
                const token = cfg.token || process.env.UAZAPI_INSTANCE_TOKEN;
                const instanceId = cfg.instanceId;
                const serverUrl = cfg.serverUrl || process.env.UAZAPI_API_URL || 'https://api.uazapi.dev';
                
                console.log(`\n   Configuração Uazapi (usada para ENVIO):`);
                console.log(`   - Server URL: ${serverUrl}`);
                console.log(`   - Instance ID: ${instanceId || '❌ NÃO DEFINIDO'}`);
                console.log(`   - Token: ${token ? '✅ Presente (' + token.substring(0, 5) + '...)' : '❌ NÃO DEFINIDO'}`);
                
                if (!token || !instanceId) {
                    console.error('\n   ❌ ERRO CRÍTICO: Token ou Instance ID faltando. O ENVIO de mensagens FALHARÁ.');
                    console.error('      Vá em "Canais" > "Configurar" e preencha o Instance ID e Token.');
                } else {
                    console.log('\n   ✅ Configuração de envio parece completa.');
                    console.log('      Se as mensagens não chegam, verifique:');
                    console.log('      1. Se o Instance ID está correto no painel do Uazapi.');
                    console.log('      2. Se a instância está CONECTADA (QR Code lido).');
                    console.log('      3. Se o número do lead tem formato válido (o sistema tenta adicionar 55 automaticamente).');
                }
            } else {
                console.log('   Este canal não está configurado para Uazapi.');
            }
        }
    }
    
    console.log('\n================================================');
    console.log('FIM DO DIAGNÓSTICO');
    console.log('================================================');
}

run()
    .catch(e => console.error('Erro fatal no script:', e))
    .finally(async () => await prisma.$disconnect());
