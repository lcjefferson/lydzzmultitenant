import axios from 'axios';

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@smarterchat.com',
      password: 'senha123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Login success:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Login failed:', error.response?.status, error.response?.data);
    } else {
      console.error('Login error:', error);
    }
  }
}

testLogin();
