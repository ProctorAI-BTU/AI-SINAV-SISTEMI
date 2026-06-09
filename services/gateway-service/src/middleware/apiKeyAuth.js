const Tenant = require('../models/Tenant');

/**
 * API Key Doğrulama Middleware
 *
 * Gelen isteğin X-API-Key header'ını okur, veritabanında doğrular.
 * Admin rotaları ADMIN_API_KEY ile korunur.
 * Diğer rotalar tenant API key'i gerektirir.
 */

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-super-secret-change-me';

// Tenant cache (60 saniye TTL) — DB yükünü azaltır
const tenantCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedTenant(prefix) {
  const entry = tenantCache.get(prefix);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    tenantCache.delete(prefix);
    return null;
  }
  return entry.tenant;
}

function setCachedTenant(prefix, tenant) {
  tenantCache.set(prefix, { tenant, ts: Date.now() });
}

/**
 * Admin API Key doğrulama
 */
const requireAdminKey = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.headers['x-api-key'];
  if (!key || key !== ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Yetkisiz: Geçerli admin API key gereklidir.',
      code: 'INVALID_ADMIN_KEY',
    });
  }
  req.isAdmin = true;
  next();
};

/**
 * Tenant API Key doğrulama
 */
const requireApiKey = async (req, res, next) => {
  const rawKey = req.headers['x-api-key'] || req.query.apiKey || req.query['x-api-key'];

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      message: 'X-API-Key header eksik. Lütfen API anahtarınızı ekleyin.',
      code: 'MISSING_API_KEY',
      docs: 'https://docs.proctoring.io/api-keys',
    });
  }

  // Prefix ile cache'e bak (ilk 16 karakter)
  const prefix = rawKey.slice(0, 16);

  try {
    // Cache'de var mı?
    let tenant = getCachedTenant(prefix);

    if (!tenant) {
      // DB'den prefix'e göre tenant adaylarını bul
      const candidates = await Tenant.find({
        apiKeyPrefix: { $regex: `^${prefix}` },
        isActive: true,
      }).select('+apiKeyHash +webhookSecret');

      // Her aday için gerçek hash doğrula
      for (const candidate of candidates) {
        const valid = await candidate.verifyApiKey(rawKey);
        if (valid) {
          tenant = candidate;
          break;
        }
      }

      if (!tenant) {
        return res.status(401).json({
          success: false,
          message: 'Geçersiz veya deaktif API key.',
          code: 'INVALID_API_KEY',
        });
      }

      setCachedTenant(prefix, tenant.toObject({ virtuals: true }));
    }

    // Kota kontrolü
    if (tenant.usage && tenant.quota) {
      if (tenant.usage.currentMonthExams >= tenant.quota.examLimit) {
        return res.status(429).json({
          success: false,
          message: `Aylık kota aşıldı (${tenant.quota.examLimit} sınav). Plan yükseltmek için iletişime geçin.`,
          code: 'QUOTA_EXCEEDED',
          quota: tenant.quota,
        });
      }
    }

    // Request'e tenant bilgisini ekle
    req.tenant = tenant;
    req.tenantId = tenant.tenantId;

    next();
  } catch (err) {
    console.error('[ApiKeyAuth] Hata:', err.message);
    return res.status(500).json({
      success: false,
      message: 'API key doğrulama hatası.',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Cache temizleme (tenant güncellendiğinde çağrılır)
 */
const invalidateTenantCache = (prefix) => {
  tenantCache.delete(prefix);
};

module.exports = { requireAdminKey, requireApiKey, invalidateTenantCache };
