/**
 * Tenant Context Middleware
 *
 * apiKeyAuth middleware'inden sonra çalışır.
 * Downstream servislere tenant bilgisini header olarak iletir.
 */

const tenantContext = (req, res, next) => {
  if (req.tenant) {
    // Downstream servislere tenant bilgisini header olarak ekle
    req.headers['x-tenant-id'] = req.tenant.tenantId;
    req.headers['x-tenant-name'] = req.tenant.name;
    req.headers['x-tenant-plan'] = req.tenant.plan;
    req.headers['x-webhook-url'] = req.tenant.webhookUrl || '';
    req.headers['x-webhook-secret'] = req.tenant.webhookSecret || '';

    // Orijinal API key'i downstream'e gönderme (güvenlik)
    delete req.headers['x-api-key'];
  }
  next();
};

/**
 * CORS middleware — tenant'ın izin verilen origin'lerini kontrol eder
 */
const tenantCors = (req, res, next) => {
  const origin = req.headers.origin;

  if (!req.tenant) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
  }

  const allowedOrigins = req.tenant.allowedOrigins || ['*'];

  if (allowedOrigins.includes('*') || !origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    return res.status(403).json({
      success: false,
      message: `Bu origin'e izin verilmiyor: ${origin}`,
      code: 'ORIGIN_NOT_ALLOWED',
    });
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Key, X-Tenant-Id'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  next();
};

module.exports = { tenantContext, tenantCors };
