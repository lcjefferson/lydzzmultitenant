
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChannels() {
  try {
    const channels = await prisma.channel.findMany();
    console.log('Found channels:', channels.length);
    
    for (const channel of channels) {
      console.log(`\nChannel: ${channel.name} (${channel.type})`);
      console.log(`ID: ${channel.id}`);
      console.log(`Status: ${channel.status}`);
      console.log(`Config:`, JSON.stringify(channel.config, null, 2));
      
      if (channel.type === 'whatsapp') {
          const cfg = channel.config || {};
          const provider = cfg.provider || 'whatsapp-official';
          console.log(`Provider: ${provider}`);
          
          if (provider === 'uazapi') {
              console.log('Checking Uazapi configuration...');
              if (!cfg.token && !process.env.UAZAPI_INSTANCE_TOKEN) {
                  console.error('❌ Missing Token (both in config and env)');
              } else {
                  console.log('✅ Token present');
              }
              
              if (!cfg.instanceId) {
                  console.warn('⚠️ Missing Instance ID in config (might be optional if single instance)');
              }
              
              if (!cfg.webhookUrl) {
                  console.warn('⚠️ Webhook URL not saved in channel config (might affect UI, but backend calculates it dynamically)');
              }
          }
      }
    }
  } catch (error) {
    console.error('Error checking channels:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChannels();
