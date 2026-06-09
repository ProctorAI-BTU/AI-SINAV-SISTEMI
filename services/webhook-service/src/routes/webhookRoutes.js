const express = require('express');
const router = express.Router();
const {
  sendWebhook,
  testWebhook,
  getLogs,
  getLogDetail,
  getStats,
} = require('../controllers/webhookController');

// Dahili servis çağrısı: Webhook gönder
router.post('/send', sendWebhook);

// Test aracı
router.post('/test', testWebhook);

// Log'lar
router.get('/logs/:tenantId', getLogs);
router.get('/logs/:tenantId/:logId', getLogDetail);

// İstatistikler
router.get('/stats/:tenantId', getStats);

module.exports = router;
