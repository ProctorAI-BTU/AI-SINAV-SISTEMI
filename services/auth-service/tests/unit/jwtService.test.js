// .env'den JWT_SECRET okumak için
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { generateToken, verifyToken, decodeToken } = require('../../src/services/jwtService');

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) { console.log(`  PASSED: ${name}`); passed++; }
  else { console.log(`  FAILED: ${name}`); failed++; }
}

function assertThrows(name, fn) {
  try {
    fn();
    console.log(`  FAILED: ${name} (hata beklendi ama fırlatılmadı)`);
    failed++;
  } catch (e) {
    console.log(`  PASSED: ${name} (hata: ${e.message})`);
    passed++;
  }
}

// Mock user nesnesi
const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@test.com',
  role: 'student',
};

const mockAdmin = {
  _id: '507f1f77bcf86cd799439022',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin',
};

function runTests() {
  console.log('\n' + '='.repeat(50));
  console.log(' JWT SERVICE — UNIT TESTS');
  console.log('='.repeat(50));

  // ─── generateToken ─────────────────────────────────────
  console.log('\n generateToken:');

  const token = generateToken(mockUser);
  assert('Token is a string', typeof token === 'string');
  assert('Token has 3 parts (xxx.xxx.xxx)', token.split('.').length === 3);
  assert('Token is not empty', token.length > 0);

  const adminToken = generateToken(mockAdmin);
  assert('Admin token generated', typeof adminToken === 'string');
  assert('Different users get different tokens', token !== adminToken);

  // ─── verifyToken ────────────────────────────────────────
  console.log('\n verifyToken:');

  const decoded = verifyToken(token);
  assert('Decoded has id', decoded.id === mockUser._id);
  assert('Decoded has role', decoded.role === mockUser.role);
  assert('Decoded has iat (issued at)', typeof decoded.iat === 'number');
  assert('Decoded has exp (expires at)', typeof decoded.exp === 'number');
  assert('exp > iat', decoded.exp > decoded.iat);

  const adminDecoded = verifyToken(adminToken);
  assert('Admin decoded has admin role', adminDecoded.role === 'admin');
  assert('Admin decoded has correct id', adminDecoded.id === mockAdmin._id);

  // ─── verifyToken — geçersiz token ──────────────────────
  console.log('\n verifyToken — Invalid Tokens:');

  assertThrows('Tampered token throws error', () => {
    verifyToken(token + 'tampered');
  });

  assertThrows('Random string throws error', () => {
    verifyToken('this.is.not.a.valid.token');
  });

  assertThrows('Empty string throws error', () => {
    verifyToken('');
  });

  assertThrows('null throws error', () => {
    verifyToken(null);
  });

  // ─── decodeToken ────────────────────────────────────────
  console.log('\n decodeToken:');

  const decodedNoVerify = decodeToken(token);
  assert('Decode returns object', typeof decodedNoVerify === 'object');
  assert('Decode has id', decodedNoVerify.id === mockUser._id);
  assert('Decode has role', decodedNoVerify.role === mockUser.role);
  assert('Decode has iat', typeof decodedNoVerify.iat === 'number');

  // decode tampered token (decode does NOT verify signature)
  const tamperedToken = token.slice(0, -5) + 'XXXXX';
  const decodedTampered = decodeToken(tamperedToken);
  assert('Decode tampered returns null or object (no verification)', decodedTampered === null || typeof decodedTampered === 'object');

  // ─── Token payload kontrolü ─────────────────────────────
  console.log('\n Payload Security:');

  const payload = decodeToken(token);
  assert('Payload does NOT contain password', !payload.password);
  assert('Payload does NOT contain email', !payload.email);
  assert('Payload does NOT contain name', !payload.name);
  assert('Payload only has: id, role, iat, exp', 
    Object.keys(payload).sort().join(',') === 'exp,iat,id,role'
  );

  // ─── Token süresi kontrolü ──────────────────────────────
  console.log('\n Token Expiration:');

  const now = Math.floor(Date.now() / 1000);
  assert('Token is not expired', decoded.exp > now);

  // JWT_EXPIRES_IN=7d ise 7 gün sonra expire olmalı (tolerans: +/- 10 sn)
  const expectedExpiry = now + (30 * 24 * 60 * 60);
  const diff = Math.abs(decoded.exp - expectedExpiry);
  assert('Token expires in ~30 days', diff < 10);

  // ─── Farklı roller ──────────────────────────────────────
  console.log('\n Different Roles:');

  const instructorUser = { _id: '507f1f77bcf86cd799439033', role: 'instructor' };
  const instructorToken = generateToken(instructorUser);
  const instructorDecoded = verifyToken(instructorToken);
  assert('Instructor token has instructor role', instructorDecoded.role === 'instructor');
  assert('Instructor token has correct id', instructorDecoded.id === instructorUser._id);

  // ─── Summary ────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(` Sonuc: ${passed} gecti, ${failed} basarisiz`);
  if (failed === 0) console.log(' Tum testler basarili!');
  else console.log(' Basarisiz testleri kontrol edin.');
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
