const crypto = require('crypto');

/**
 * HMAC-SHA256 İmzalama Servisi
 *
 * Webhook payload'ını imzalamak için kullanılır.
 * Alıcı taraf bu imzayı doğrulayarak webhook'un gerçekten bizden geldiğini teyit eder.
 */

/**
 * Payload'ı HMAC-SHA256 ile imzalar
 * @param {string|object} payload - JSON payload (string veya object)
 * @param {string} secret - Tenant webhook secret
 * @returns {string} - "sha256=<hex>" formatında imza
 */
const sign = (payload, secret) => {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
};

/**
 * Alınan webhook imzasını doğrular
 * @param {string|object} payload - Gelen payload
 * @param {string} signature - "sha256=<hex>" formatında imza
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
const verify = (payload, signature, secret) => {
  const expected = sign(payload, secret);
  try {
    // Timing-safe karşılaştırma (timing attack'a karşı)
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
};

module.exports = { sign, verify };
