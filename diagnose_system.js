import pg from 'pg';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

console.log('--- DIAGNOSTIC START ---');
console.log('Environment Check:');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD provided:', !!process.env.DB_PASSWORD);
console.log('JWT_SECRET provided:', !!process.env.JWT_SECRET);

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runDiagnostics() {
  // 1. Test Database connection
  console.log('\n1. Testing Database Connection...');
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully. Server time:', res.rows[0].now);
    client.release();
    
    // Check roles
    const rolesRes = await pool.query('SELECT * FROM roles');
    console.log('✅ Roles table check:', rolesRes.rowCount, 'roles found.');
    if (rolesRes.rowCount > 0) {
        console.log('   Sample role:', rolesRes.rows[0]);
    } else {
        console.log('⚠️ Roles table is empty! Registration might fail.');
    }

  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    if (err.message.includes('SASL')) {
        console.error('   Hint: Check DB_PASSWORD in .env');
    }
  } finally {
    await pool.end();
  }

  // 2. Test API Connectivity
  console.log('\n2. Testing API Connectivity (http://localhost:3000)...');
  
  const testUrl = (path, method = 'GET', body = null) => {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data });
        });
      });

      req.on('error', (e) => {
        resolve({ error: e.message });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    const rootRes = await testUrl('/');
    if (rootRes.error) {
        console.error('❌ API is not reachable:', rootRes.error);
    } else {
        console.log(`✅ API Root (/): Status ${rootRes.status}`);
        console.log('   Response:', rootRes.body.substring(0, 100) + '...');
    }

    // Test Registration with a dummy user
    console.log('\n3. Testing Registration Endpoint...');
    const randomUser = 'diag_' + Math.floor(Math.random() * 10000);
    const payload = {
        username: randomUser,
        password: 'password123',
        role_id: 1 // Assuming 1 exists, otherwise it might fail with 400 which is good
    };
    
    const regRes = await testUrl('/auth/register', 'POST', payload);
    if (regRes.error) {
        console.error('❌ Register request failed:', regRes.error);
    } else {
        console.log(`ℹ️ Register Response Status: ${regRes.status}`);
        console.log('   Response Body:', regRes.body);
    }

  } catch (err) {
    console.error('Diagnostic error:', err);
  }

  console.log('\n--- DIAGNOSTIC END ---');
}

runDiagnostics();
