const express = require('express');
const router = express.Router();
const { requireAdminKey } = require('../middleware/apiKeyAuth');
const {
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  regenerateApiKey,
  regenerateWebhookSecret,
  deactivateTenant,
  getStats,
} = require('../controllers/tenantController');

// Tüm admin rotaları ADMIN_API_KEY gerektirir
router.use(requireAdminKey);

// İstatistikler
router.get('/stats', getStats);

// Tenant CRUD
router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.get('/tenants/:tenantId', getTenant);
router.put('/tenants/:tenantId', updateTenant);
router.delete('/tenants/:tenantId', deactivateTenant);

// Credential yönetimi
router.post('/tenants/:tenantId/regenerate-key', regenerateApiKey);
router.post('/tenants/:tenantId/regenerate-webhook-secret', regenerateWebhookSecret);

module.exports = router;
