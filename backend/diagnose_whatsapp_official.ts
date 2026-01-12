
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loader
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env')
  ];

  for (const envPath of envPaths) {
     if (fs.existsSync(envPath)) {
       console.log(`Loading .env from ${envPath}`);
       const content = fs.readFileSync(envPath, 'utf-8');
       const lines = content.split('\n');
       for (const line of lines) {
         const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
         if (match) {
           const key = match[1];
           let value = match[2] || '';
           // Remove quotes if present
           if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
             value = value.slice(1, -1);
           }
           if (!process.env[key]) {
             process.env[key] = value;
           }
         }
       }
     }
   }
 }
 
 loadEnv();

 if (!process.env.DATABASE_URL) {
     console.log('DATABASE_URL not found in .env, using default local docker URL');
     process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/smarterchat';
 }
  
 const prisma = new PrismaClient();

async function main() {
  console.log('Starting WhatsApp Official API Diagnosis...');

  // 1. Check Channels
  console.log('\n--- Checking Channels ---');
  const channels = await prisma.channel.findMany({
    where: { type: 'whatsapp' },
    include: { organization: true },
  });

  if (channels.length === 0) {
    console.error('No WhatsApp channels found.');
    return;
  }

  console.log(`Found ${channels.length} WhatsApp channels.`);

  const officialChannels = channels.filter(c => {
    // Check if provider is explicitly whatsapp-official OR if config looks like official (has phoneNumberId)
    const config = c.config as any;
    return c.provider === 'whatsapp-official' || (config && config.phoneNumberId && !config.instanceId);
  });

  if (officialChannels.length === 0) {
    console.log('No WhatsApp Official channels identified in DB.');
    console.log('Creating a TEMPORARY in-memory channel context for diagnosis using .env placeholders...');
    
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'your_phone_number_id';
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN || 'your_whatsapp_access_token';

    if (envPhoneId === 'your_phone_number_id' || envToken === 'your_whatsapp_access_token') {
        console.warn('WARNING: .env contains default placeholders. Connection tests WILL FAIL with Auth Error.');
    }

    officialChannels.push({
        id: 'temp-diag-id',
        name: 'Temporary Diagnosis Channel',
        type: 'whatsapp',
        provider: 'whatsapp-official',
        identifier: envPhoneId,
        accessToken: envToken,
        config: { phoneNumberId: envPhoneId, accessToken: envToken },
        organizationId: 'temp-org',
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: { id: 'temp-org', name: 'Temp Org' } // Mock relation
    } as any);
  }

  console.log(`Proceeding with ${officialChannels.length} Official API channels (real or temp).`);

  for (const channel of officialChannels) {
    console.log(`\nTesting Channel: ${channel.name} (ID: ${channel.id})`);
    const config = channel.config as any;
    const phoneNumberId = config.phoneNumberId || channel.identifier;
    const accessToken = config.accessToken || channel.accessToken;

    if (!phoneNumberId || !accessToken) {
      console.error('  MISSING CREDENTIALS: phoneNumberId or accessToken not found.');
      console.log(`  phoneNumberId: ${phoneNumberId ? 'Present' : 'Missing'}`);
      console.log(`  accessToken: ${accessToken ? 'Present' : 'Missing'}`);
      continue;
    }

    // 2. Test Connection (GET Phone Number Info)
    console.log(`  Testing connection to Graph API for Phone ID: ${phoneNumberId}...`);
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
      console.log(`  URL: ${url}`);
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('  Connection SUCCESS!');
      console.log('  Phone Number Info:', JSON.stringify(response.data, null, 2));
      
      // Check validation
      if (response.data.id !== phoneNumberId) {
          console.warn(`  WARNING: Returned ID (${response.data.id}) does not match configured ID (${phoneNumberId})`);
      }

    } catch (error: any) {
      console.error('  Connection FAILED.');
      if (axios.isAxiosError(error)) {
        console.error(`  Status: ${error.response?.status}`);
        console.error(`  Data: ${JSON.stringify(error.response?.data, null, 2)}`);
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }

    // 3. Webhook Config Check
    console.log('\n  Checking Webhook Configuration...');
    const verifyToken = config.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'smarterchat_verify_token';
    console.log(`  Verify Token configured: ${verifyToken}`);
    
    // We cannot easily check if the webhook is registered on Meta side without App Access Token and App ID
    // But we can remind the user to check it.
    console.log('  TODO: Verify in Meta Developer Portal that the webhook URL is set correctly.');
    console.log('  Expected Callback URL format: https://<YOUR_DOMAIN>/api/webhooks/whatsapp');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
