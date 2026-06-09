const axios = require('axios');
const WebhookLog = require('../models/WebhookLog');
const { sign } = require('./hmacSigner');

const TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '8000', 10);
const MAX_ATTEMPTS = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10);

// Üstel geri çekilme: 1. hata→10s, 2. hata→60s, 3. hata→300s
const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];

/**
 * Webhook gönder (tek deneme)
 */
async function sendOnce(url, payload, signature, logId) {
  const bodyStr = JSON.stringify(payload);
  const start = Date.now();

  const response = await axios.post(url, payload, {
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'X-Proctor-Signature': signature,
      'X-Proctor-Event': payload.event,
      'X-Proctor-Delivery': logId,
      'User-Agent': 'ProctorPlatform-Webhook/1.0',
    },
    validateStatus: () => true, // Tüm HTTP kodlarını kabul et, axios error throw etmesin
  });

  const durationMs = Date.now() - start;
  return { status: response.status, body: String(response.data).slice(0, 500), durationMs };
}

/**
 * Webhook teslimatı (retry dahil)
 * @param {object} opts - { tenantId, event, url, webhookSecret, data }
 */
async function deliver({ tenantId, event, url, webhookSecret, data }) {
  const payload = {
    event,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  };

  const bodyStr = JSON.stringify(payload);
  const signature = sign(bodyStr, webhookSecret);

  // Log kaydı oluştur
  const log = await WebhookLog.create({
    tenantId,
    event,
    url,
    payload,
    signature,
    status: 'pending',
    maxAttempts: MAX_ATTEMPTS,
  });

  // İlk deneme
  await attempt(log, payload, signature);

  return log;
}

/**
 * Tek teslimat denemesi
 */
async function attempt(log, payload, signature) {
  log.attempts += 1;
  log.status = 'retrying';
  await log.save();

  try {
    const { status, body, durationMs } = await sendOnce(log.url, payload, signature, String(log._id));

    log.responseStatus = status;
    log.responseBody = body;
    log.durationMs = durationMs;

    if (status >= 200 && status < 300) {
      log.status = 'delivered';
      log.deliveredAt = new Date();
      log.errorMessage = null;
      console.log(`[Webhook] ✅ Teslim edildi → ${log.url} (${status}) in ${durationMs}ms`);
    } else {
      throw new Error(`HTTP ${status}: ${body}`);
    }
  } catch (err) {
    log.errorMessage = err.message;

    if (log.attempts < log.maxAttempts) {
      const delayMs = RETRY_DELAYS_MS[log.attempts - 1] || 300_000;
      log.nextRetryAt = new Date(Date.now() + delayMs);
      log.status = 'retrying';
      console.warn(
        `[Webhook] ⚠️  Deneme ${log.attempts}/${log.maxAttempts} başarısız → ${log.url}. ${delayMs / 1000}s sonra tekrar denenecek.`
      );
    } else {
      log.status = 'failed';
      log.nextRetryAt = null;
      console.error(
        `[Webhook] ❌ ${log.maxAttempts} denemede teslim edilemedi → ${log.url}: ${err.message}`
      );
    }
  }

  await log.save();
}

/**
 * Retry queue — başarısız webhook'ları yeniden dene
 * Her 30 saniyede bir çalıştırılır (cron benzeri)
 */
async function processRetryQueue() {
  const pending = await WebhookLog.find({
    status: 'retrying',
    nextRetryAt: { $lte: new Date() },
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
  }).limit(20);

  if (pending.length === 0) return;

  console.log(`[Webhook] Retry queue: ${pending.length} webhook yeniden deneniyor...`);

  for (const log of pending) {
    const signature = log.signature; // Aynı imzayı tekrar kullan
    await attempt(log, log.payload, signature);
  }
}

// Retry queue'yu başlat
setInterval(processRetryQueue, 30_000);

module.exports = { deliver };
