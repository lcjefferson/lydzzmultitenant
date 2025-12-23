const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const API_URL = process.env.UAZAPI_API_URL || 'https://api.uazapi.dev';
const TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;
const NUMBER = process.argv[2]; // Get number from command line arg

if (!TOKEN) {
    console.error('Error: UAZAPI_INSTANCE_TOKEN not found in backend/.env');
    process.exit(1);
}

if (!NUMBER) {
    console.error('Usage: node test_uazapi_send.js <phone_number>');
    console.log('Example: node test_uazapi_send.js 11999999999');
    process.exit(1);
}

async function testSend() {
    console.log(`Testing Uazapi Connection...`);
    console.log(`URL: ${API_URL}`);
    console.log(`Token: ${TOKEN.substring(0, 5)}...`);
    console.log(`Target Number: ${NUMBER}`);

    // Simulate the fix logic
    let cleanNumber = NUMBER.replace(/\D/g, '');
    if ((cleanNumber.length === 10 || cleanNumber.length === 11) && parseInt(cleanNumber.substring(0, 2)) >= 11) {
        console.log(`Applying Brazilian country code fix: ${cleanNumber} -> 55${cleanNumber}`);
        cleanNumber = '55' + cleanNumber;
    }

    try {
        const url = `${API_URL}/send/text`;
        const payload = {
            number: cleanNumber,
            text: 'Teste de envio pelo script de diagnóstico Lydzz',
        };

        console.log(`Sending payload:`, payload);

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'token': TOKEN,
            },
            timeout: 10000
        });

        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Data:', response.data);

    } catch (error) {
        console.error('❌ Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.error('Suggestion: Check if the Uazapi container is running and reachable.');
        }
    }
}

testSend();
