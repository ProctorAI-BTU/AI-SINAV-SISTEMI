/*
 *  AI MÜLAKAT SİSTEM TESTİ
 *  MongoDB Bağlantı + Auth API + JWT Doğrulama
 * 
 * Kullanım:
 *   1) Auth Service'i başlat: cd services/auth-service && npm run dev
 *   2) Bu testi çalıştır:     node scripts/full-integration-test.js
 */

const http = require('http');

const AUTH_BASE = 'http://localhost:3001';

let passed = 0;
let failed = 0;
let total = 0;

// HTTP Helper 
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AUTH_BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers,
      timeout: 10000,
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
  total++;
  if (condition) { console.log(` ${name}`); passed++; }
  else { console.log(` ${name}`); failed++; }
}

function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

// MAIN TEST FLOW 
async function run() {
  const ts = Date.now();
  const testEmail = `test_${ts}@test.com`;
  let authToken = '';
  let refreshToken = '';
  let userId = '';
  let adminToken = '';

  console.log('\n' + '═'.repeat(56));
  console.log('  AI MÜLAKAT SİSTEMİ — TAM ENTEGRASYON TESTİ');
  console.log('═'.repeat(56));
  console.log(`  Zaman: ${new Date().toLocaleString('tr-TR')}`);
  console.log(`  Hedef: ${AUTH_BASE}`);

  //  1. BAĞLANTI TESTİ 
  section('1) BAĞLANTI TESTLERİ');

  try {
    const health = await request('GET', '/health');
    assert('Auth Service erişilebilir (HTTP 200)', health.status === 200);
    assert('Service name: auth-service', health.body.service === 'auth-service');
    assert('Status: running', health.body.status === 'running');
  } catch (e) {
    console.log(`\n Auth Service'e bağlanılamadı: ${e.message}`);
    console.log('\n Çözüm:');
    console.log('    cd services/auth-service');
    console.log('    npm run dev');
    console.log(`\n MongoDB'nin de çalıştığından emin olun!`);
    process.exit(1);
  }

  //  2. KAYIT TESTLERİ 
  section('2) KAYIT (REGISTER) TESTLERİ');

  //  başarılı kayıt
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Test Kullanıcı', email: testEmail, password: 'test123456',
  });
  assert('Register → HTTP 201', regRes.status === 201);
  assert('success: true', regRes.body.success === true);
  assert('Token döndü', !!regRes.body.data?.token);
  assert('Refresh token döndü', !!regRes.body.data?.refreshToken);
  assert('User ID döndü', !!regRes.body.data?.user?.id);
  assert('Role: student', regRes.body.data?.user?.role === 'student');
  assert('Email doğru', regRes.body.data?.user?.email === testEmail);

  if (regRes.body.data?.token) {
    authToken = regRes.body.data.token;
    refreshToken = regRes.body.data.refreshToken;
    userId = regRes.body.data.user.id;
  }

  // eksik alan validasyonu
  const valRes = await request('POST', '/api/auth/register', {
    name: '', email: 'gecersiz', password: '12',
  });
  assert('Eksik alan → HTTP 400', valRes.status === 400);

  // duplicate email
  const dupRes = await request('POST', '/api/auth/register', {
    name: 'Tekrar', email: testEmail, password: 'test123456',
  });
  assert('Tekrar kayıt → HTTP 409', dupRes.status === 409);

  // 3. GİRİŞ TESTLERİ 
  section('3) GİRİŞ (LOGIN) TESTLERİ');

  const loginRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'test123456',
  });
  assert('Login → HTTP 200', loginRes.status === 200);
  assert('Token döndü', !!loginRes.body.data?.token);
  assert('User role: student', loginRes.body.data?.user?.role === 'student');

  // yanlış şifre
  const wrongRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'yanlis_sifre',
  });
  assert('Yanlış şifre → HTTP 401', wrongRes.status === 401);

  // var olmayan kullanıcı
  const noUserRes = await request('POST', '/api/auth/login', {
    email: 'yok@yok.com', password: 'test123456',
  });
  assert('Olmayan kullanıcı → HTTP 401', noUserRes.status === 401);

  // 4. JWT DOĞRULAMA TESTLERİ 
  section('4) JWT TOKEN DOĞRULAMA');

  // /me — geçerli token
  const meRes = await request('GET', '/api/auth/me', null, authToken);
  assert('/me → HTTP 200 (geçerli token)', meRes.status === 200);
  assert('Kullanıcı adı döndü', !!meRes.body.data?.user?.name);
  assert('Kullanıcı email döndü', !!meRes.body.data?.user?.email);
  assert('Kullanıcı role döndü', !!meRes.body.data?.user?.role);

  // /me — token yok
  const noTokenRes = await request('GET', '/api/auth/me');
  assert('/me (tokensız) → HTTP 401', noTokenRes.status === 401);

  // /me — geçersiz token
  const badTokenRes = await request('GET', '/api/auth/me', null, 'invalid.token.here');
  assert('/me (geçersiz token) → HTTP 401', badTokenRes.status === 401);

  // 5. REFRESH TOKEN TESTİ
  section('5) REFRESH TOKEN');

  if (refreshToken) {
    const refreshRes = await request('POST', '/api/auth/refresh-token', {
      token: refreshToken,
    });
    assert('Refresh token → HTTP 200', refreshRes.status === 200);
    assert('Yeni access token döndü', !!refreshRes.body.data?.token);
    if (refreshRes.body.data?.token) {
      authToken = refreshRes.body.data.token; // yeni token ile devam et
    }
  } else {
    console.log(' Refresh token mevcut değil, atlanıyor');
  }

  // geçersiz refresh token
  const badRefreshRes = await request('POST', '/api/auth/refresh-token', {
    token: 'invalid-refresh-token',
  });
  assert('Geçersiz refresh → HTTP 401', badRefreshRes.status === 401);

  // 6. ŞİFRE DEĞİŞTİRME 
  section('6) ŞİFRE DEĞİŞTİRME');

  const cpRes = await request('PUT', '/api/auth/change-password', {
    currentPassword: 'test123456', newPassword: 'yeni_sifre_123',
  }, authToken);
  assert('Şifre değiştirme → HTTP 200', cpRes.status === 200);

  // yeni şifre ile giriş
  const newLoginRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'yeni_sifre_123',
  });
  assert('Yeni şifre ile giriş → HTTP 200', newLoginRes.status === 200);
  if (newLoginRes.body.data?.token) {
    authToken = newLoginRes.body.data.token;
  }

  // eski şifre ile giriş denemesi
  const oldPassRes = await request('POST', '/api/auth/login', {
    email: testEmail, password: 'test123456',
  });
  assert('Eski şifre ile giriş → HTTP 401', oldPassRes.status === 401);

  // 7. PROFİL GÜNCELLEME
  section('7) PROFİL GÜNCELLEME');

  const upRes = await request('PUT', '/api/auth/update-profile', {
    name: 'Güncellenmiş İsim',
  }, authToken);
  assert('Profil güncelleme → HTTP 200', upRes.status === 200);
  assert('İsim güncellendi', upRes.body.data?.user?.name === 'Güncellenmiş İsim');

  // 8. ADMIN İŞLEMLERİ
  section('8) ADMIN İŞLEMLERİ');

  const adminLoginRes = await request('POST', '/api/auth/login', {
    email: 'admin@sinav.com', password: 'admin123',
  });

  if (adminLoginRes.status === 200) {
    adminToken = adminLoginRes.body.data.token;
    assert('Admin giriş başarılı', true);
    assert('Admin role: admin', adminLoginRes.body.data?.user?.role === 'admin');

    // kullanıcı listesi
    const usersRes = await request('GET', '/api/users', null, adminToken);
    assert('Kullanıcı listesi → HTTP 200', usersRes.status === 200);
    assert('Users array döndü', Array.isArray(usersRes.body.data?.users));
    assert('Birden fazla kullanıcı var', usersRes.body.count > 0);

    // tek kullanıcı detayı
    const singleRes = await request('GET', `/api/users/${userId}`, null, adminToken);
    assert('Tek kullanıcı detayı → HTTP 200', singleRes.status === 200);

    // kullanıcıyı deaktif et
    const deactRes = await request('PUT', `/api/users/${userId}/active`, { isActive: false }, adminToken);
    assert('Kullanıcı deaktif → HTTP 200', deactRes.status === 200);

    // deaktif kullanıcı giriş yapamamalı
    const deactLoginRes = await request('POST', '/api/auth/login', {
      email: testEmail, password: 'yeni_sifre_123',
    });
    assert('Deaktif kullanıcı giriş yapamaz → HTTP 401', deactLoginRes.status === 401);

    // kullanıcıyı tekrar aktif et
    const reactRes = await request('PUT', `/api/users/${userId}/active`, { isActive: true }, adminToken);
    assert('Kullanıcı reaktif → HTTP 200', reactRes.status === 200);

    // rol değiştirme
    const roleRes = await request('PUT', `/api/users/${userId}/role`, { role: 'instructor' }, adminToken);
    assert('Rol değiştirme → HTTP 200', roleRes.status === 200);

    // student, admin route'larına erişememeli
    const forbiddenRes = await request('GET', '/api/users', null, authToken);
    assert('Student → admin routes → HTTP 403', forbiddenRes.status === 403);

  } else {
    console.log(' Admin hesabı yok. Seed çalıştırın:');
    console.log('     cd services/auth-service && npm run seed');
  }

  // 9. 404 HANDLER
  section('9) 404 & EDGE CASE TESTLERİ');

  const notFoundRes = await request('GET', '/api/nonexistent');
  assert('Bilinmeyen route → HTTP 404', notFoundRes.status === 404);

  const emptyBodyRes = await request('POST', '/api/auth/login', {});
  assert('Boş body → HTTP 400', emptyBodyRes.status === 400);

  // SONUÇ
  console.log('\n' + '═'.repeat(56));
  console.log(`  SONUÇ: ${passed}/${total} test geçti`);
  if (failed === 0) {
    console.log('  TÜM TESTLER BAŞARILI!');
    console.log('');
    console.log('  Sistem hazır durumda:');
    console.log('  MongoDB bağlantısı aktif');
    console.log('  Auth API çalışıyor');
    console.log('  JWT token üretim & doğrulama çalışıyor');
    console.log('  Refresh token mekanizması aktif');
    console.log('  RBAC (rol bazlı erişim) çalışıyor');
    console.log('  Şifre değiştirme & profil güncelleme çalışıyor');
  } else {
    console.log(`  ${failed} test başarısız!`);
  }
  console.log('═'.repeat(56) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('\n Test çalıştırma hatası:', e.message);
  console.error('Auth service çalışıyor mu kontrol edin.\n');
  process.exit(1);
});
