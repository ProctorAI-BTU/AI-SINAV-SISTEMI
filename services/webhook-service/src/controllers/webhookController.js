const { deliver } = require('../services/webhookDelivery');
const WebhookLog = require('../models/WebhookLog');

/**
 * POST /api/webhooks/send
 * Webhook gönderme isteği (proctoring-service tarafından çağrılır)
 */
const sendWebhook = async (req, res) => {
  const { tenantId, event, url, webhookSecret, data } = req.body;

  if (!tenantId || !event || !url || !webhookSecret) {
    return res.status(400).json({
      success: false,
      message: 'tenantId, event, url ve webhookSecret zorunludur.',
    });
  }

  // Fire-and-forget: Hemen 202 döndür, arka planda gönder
  res.status(202).json({
    success: true,
    message: 'Webhook kuyruğa alındı.',
    event,
    tenantId,
  });

  // Arka planda gönder (await etmiyoruz)
  deliver({ tenantId, event, url, webhookSecret, data }).catch((err) => {
    console.error('[WebhookController] deliver hatası:', err.message);
  });
};

/**
 * POST /api/webhooks/test
 * Webhook endpoint'ini test et (admin aracı)
 */
const testWebhook = async (req, res) => {
  const { tenantId, url, webhookSecret } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'url zorunludur.' });
  }

  const log = await deliver({
    tenantId: tenantId || 'test-tenant',
    event: 'webhook.test',
    url,
    webhookSecret: webhookSecret || 'test-secret',
    data: {
      message: 'Bu bir test webhook isteğidir. Sisteminiz doğru çalışıyor.',
      timestamp: new Date().toISOString(),
    },
  });

  res.json({
    success: true,
    message: 'Test webhook gönderildi.',
    log: {
      id: log._id,
      status: log.status,
      responseStatus: log.responseStatus,
      durationMs: log.durationMs,
      errorMessage: log.errorMessage,
    },
  });
};

/**
 * GET /api/webhooks/logs/:tenantId
 * Tenant'ın webhook teslimat loglarını getir
 */
const getLogs = async (req, res) => {
  const { tenantId } = req.params;
  const { page = 1, limit = 50, status, event } = req.query;

  const filter = { tenantId };
  if (status) filter.status = status;
  if (event) filter.event = event;

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    WebhookLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-payload'), // Payload büyük olabilir, listede gösterme
    WebhookLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    pagination: { page: Number(page), limit: Number(limit), total },
    logs,
  });
};

/**
 * GET /api/webhooks/logs/:tenantId/:logId
 * Webhook log detayı (payload dahil)
 */
const getLogDetail = async (req, res) => {
  const log = await WebhookLog.findOne({
    _id: req.params.logId,
    tenantId: req.params.tenantId,
  });

  if (!log) {
    return res.status(404).json({ success: false, message: 'Log bulunamadı.' });
  }

  res.json({ success: true, log });
};

/**
 * GET /api/webhooks/stats/:tenantId
 * Tenant webhook istatistikleri
 */
const getStats = async (req, res) => {
  const { tenantId } = req.params;

  const [total, delivered, failed, retrying] = await Promise.all([
    WebhookLog.countDocuments({ tenantId }),
    WebhookLog.countDocuments({ tenantId, status: 'delivered' }),
    WebhookLog.countDocuments({ tenantId, status: 'failed' }),
    WebhookLog.countDocuments({ tenantId, status: 'retrying' }),
  ]);

  const successRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0';

  res.json({
    success: true,
    stats: { total, delivered, failed, retrying, successRate: `${successRate}%` },
  });
};

module.exports = { sendWebhook, testWebhook, getLogs, getLogDetail, getStats };
