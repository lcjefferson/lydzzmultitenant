
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWhatsAppConfig() {
  try {
    const channel = await prisma.channel.findFirst({
      where: { type: 'whatsapp' },
    });

    if (!channel) {
      console.log('No WhatsApp channel found.');
      return;
    }

    console.log('WhatsApp Channel Found:');
    console.log(`ID: ${channel.id}`);
    console.log(`Status: ${channel.status}`);
    console.log(`Provider: ${channel.provider}`);
    
    const config = channel.config as any;
    console.log('Config:', JSON.stringify(config, null, 2));

    if (config && config.verifyToken) {
      console.log(`Configured Verify Token: ${config.verifyToken}`);
    } else {
      console.log('No verifyToken in config. Using default.');
    }

    console.log(`Default Verify Token (from env): ${process.env.WHATSAPP_VERIFY_TOKEN || 'smarterchat_verify_token'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWhatsAppConfig();
