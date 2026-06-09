
const http = require('http');

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let authToken = '';
let adminToken = '';
let userId = '';

// HTTP Helper 
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers,
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(name, condition) {
  if (condition) { console.log(`  ${name}`); passed++; }
  else { console.log(`  ${name}`); failed++; }
}

// TESTS 
async function run() {
  const ts = Date.now();
  const testEmail = `test_${ts}@test.com`;

  console.log('\n' + '═'.repeat(50));
  console.log(' AUTH SERVICE — INTEGRATION TESTS');
  console.log('═'.repeat(50));

  // Health Check
  console.log('\n Health Check:');
  try {
    const r = await request('GET', '/health');
    assert('Health returns 200', r.status === 200);
    assert('Service name correct', r.body.service === 'auth-service');
  } catch (e) {
    console.log(`  Servis çalışmıyor: ${e.message}`);
    console.log('\n Önce servisi başlat: docker-compose up -d\n');
    return;
  }

  //  Register 
  console.log('\n Register:');
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Test User', email: testEmail, password: 'test123456',
  });
  assert('Register returns 201', regRes.status === 201);
  assert('Success true', regRes.body.success === true);
  assert('Has token', !!regRes.body.data?.token);
  assert('Has user.id', !!regRes.body.data?.user?.id);
  assert('Has user.role', regRes.body.data?.user?.role === 'student');
  assert('Email matches', regRes.body.data?.user?.email === testEmail);

  if (regRes.body.data?.token) {
    authToken = regRes.body.data.token;
    userId = regRes.body.data.user.id;
  }

  // Register — validasyon
  console.log('\n Register Validasyon:');
  const valRes = await request('POST', '/api/auth/register', {
    name: '', email: 'invalid', password: '12',
  });
  assert('Validation returns 400', valRes.status === 400);

  //  Register — duplicate
  console.log('\n Register:');
  const dupRes = await request('POST', '/api/auth/register', {
    name: 'Dup', email: testEmail, password: 'test123456',
  });
  assert('Duplicate returns 409', dupRes.status === 409);

  // Login — başarılı
  console.log('\n Login:');
  const loginRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'test123456',
  });
  assert('Login returns 200', loginRes.status === 200);
  assert('Has token', !!loginRes.body.data?.token);
  assert('Role is student', loginRes.body.data?.user?.role === 'student');

  // 6. Login — yanlış şifre
  console.log('\n Wrong Password:');
  const wrongRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'wrongpassword',
  });
  assert('Wrong password returns 401', wrongRes.status === 401);

  //  Get Me
  console.log('\n Get Profile (/me):');
  const meRes = await request('GET', '/api/auth/me', null, authToken);
  assert('GetMe returns 200', meRes.status === 200);
  assert('Has user.name', !!meRes.body.data?.user?.name);
  assert('Has user.role', !!meRes.body.data?.user?.role);

  // 8. Get Me — token yok
  console.log('\n Get Profile — No Token:');
  const noTokenRes = await request('GET', '/api/auth/me');
  assert('No token returns 401', noTokenRes.status === 401);

  // Change Password
  console.log('\n Change Password:');
  const cpRes = await request('PUT', '/api/auth/change-password', {
    currentPassword: 'test123456', newPassword: 'newpass123',
  }, authToken);
  assert('Change password returns 200', cpRes.status === 200);

  // Login with new password
  console.log('\n Login with New Password:');
  const newLoginRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'newpass123',
  });
  assert('New password login works', newLoginRes.status === 200);
  authToken = newLoginRes.body.data?.token || authToken;

  // Update Profile
  console.log('\n Update Profile:');
  const upRes = await request('PUT', '/api/auth/update-profile', {
    name: 'Updated Name',
  }, authToken);
  assert('Update profile returns 200', upRes.status === 200);
  assert('Name updated', upRes.body.data?.user?.name === 'Updated Name');

  // Admin login 
  console.log('\n Admin Login:');
  const adminRes = await request('POST', '/api/auth/login', {
    email: 'admin@sinav.com', password: 'admin123',
  });
  if (adminRes.status === 200) {
    adminToken = adminRes.body.data.token;
    assert('Admin login works', true);
    assert('Admin role correct', adminRes.body.data?.user?.role === 'admin');

    //  Admin — list users
    console.log('\n Admin — List Users:');
    const usersRes = await request('GET', '/api/users', null, adminToken);
    assert('List users returns 200', usersRes.status === 200);
    assert('Has users array', Array.isArray(usersRes.body.data?.users));
    assert('Count > 0', usersRes.body.count > 0);

    //  Admin — get single user
    console.log('\n Admin — Get User:');
    const singleRes = await request('GET', `/api/users/${userId}`, null, adminToken);
    assert('Get user returns 200', singleRes.status === 200);

    //  Admin — deactivate user
    console.log('\n Admin — Deactivate User:');
    const deactRes = await request('PUT', `/api/users/${userId}/active`, { isActive: false }, adminToken);
    assert('Deactivate returns 200', deactRes.status === 200);

    //  Deactivated user cannot login
    console.log('\n Deactivated User Login:');
    const deactLogin = await request('POST', '/api/auth/login', {
      email: testEmail, password: 'newpass123',
    });
    assert('Deactivated user returns 401', deactLogin.status === 401);

    //  Admin — reactivate
    const reactRes = await request('PUT', `/api/users/${userId}/active`, { isActive: true }, adminToken);
    assert('Reactivate works', reactRes.status === 200);

  } else {
    console.log(' Admin hesabı yok, seed çalıştırın: node scripts/seed.js');
  }

  //  Non-admin cannot access admin routes
  console.log('\n Authorization Check:');
  const forbiddenRes = await request('GET', '/api/users', null, authToken);
  assert('Student cannot list users (403)', forbiddenRes.status === 403);

  //  Invalid route
  console.log('\n 404 Handler:');
  const notFoundRes = await request('GET', '/api/nonexistent');
  assert('Unknown route returns 404', notFoundRes.status === 404);

  //  Summary 
  console.log('\n' + '═'.repeat(50));
  console.log(` Sonuç: ${passed} geçti, ${failed} başarısız`);
  if (failed === 0) console.log(' Tüm testler başarılı!');
  else console.log(' Başarısız testleri kontrol edin.');
  console.log('═'.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test çalıştırma hatası:', e.message);
  process.exit(1);
});
