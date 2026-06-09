require('dotenv').config();
require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./routes/adminRoutes');
const { requireApiKey } = require('./middleware/apiKeyAuth');
const { tenantContext, tenantCors } = require('./middleware/tenantContext');
const Tenant = require('./models/Tenant');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_sinav_db';

// Upstream servis URL'leri
const SERVICES = {
  auth:       process.env.AUTH_SERVICE_URL       || 'http://auth-service:3001',
  exam:       process.env.EXAM_SERVICE_URL        || 'http://exam-service:3002',
  reporting:  process.env.REPORTING_SERVICE_URL   || 'http://reporting-service:3003',
  proctoring: process.env.PROCTORING_SERVICE_URL  || 'http://proctoring-service:3004',
};

// =============================================================
// Global Middleware
// =============================================================
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(morgan('combined'));

// Genel rate limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla istek. Lütfen bir dakika bekleyin.' },
});
app.use(globalLimiter);

// =============================================================
// Health Check (auth gerektirmez)
// =============================================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'gateway-service',
    status: 'healthy',
    version: '1.0.0',
    upstreams: SERVICES,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'AI Proctoring Platform — API Gateway',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/health',
  });
});

// =============================================================
// Admin Rotaları (X-Admin-Key gerektirir, proxy değil)
// =============================================================
app.use('/api/admin', adminRoutes);

// =============================================================
// Tenant API Proxy Rotaları (X-API-Key gerektirir)
// =============================================================

// Ortak middleware: API key doğrula + tenant context ekle
const tenantMiddleware = [requireApiKey, tenantCors, tenantContext];

// Proxy fabrika fonksiyonu
function makeProxy(target, pathRewrite = {}) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: Object.keys(pathRewrite).length ? pathRewrite : undefined,
    on: {
      error: (err, req, res) => {
        console.error(`[Gateway] Proxy hatası (${target}):`, err.message);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: 'Upstream servis şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
            service: target,
          });
        }
      },
    },
    logger: console,
  });
}

// Auth Service: /api/auth/*
app.use(
  '/api/auth',
  ...tenantMiddleware,
  makeProxy(SERVICES.auth)
);

// User Service: /api/users/*
app.use(
  '/api/users',
  ...tenantMiddleware,
  makeProxy(SERVICES.auth)
);

// Exam Service: /api/exams/*
app.use(
  '/api/exams',
  ...tenantMiddleware,
  makeProxy(SERVICES.exam)
);

// Reporting Service: /api/reports/*
app.use(
  '/api/reports',
  ...tenantMiddleware,
  makeProxy(SERVICES.reporting)
);

// Proctoring Service: /api/proctoring/*
app.use(
  '/api/proctoring',
  ...tenantMiddleware,
  makeProxy(SERVICES.proctoring)
);

// =============================================================
// Tenant Bilgi Endpoint'i (kendi bilgilerini görmek için)
// =============================================================
app.get('/api/me', requireApiKey, (req, res) => {
  const { apiKeyHash, webhookSecret, ...safeData } = req.tenant;
  res.json({
    success: true,
    tenant: safeData,
  });
});

// =============================================================
// Socket.io (WebSocket) Proxy — Proctoring Service
// =============================================================
app.use(
  '/socket.io',
  createProxyMiddleware({
    target: SERVICES.proctoring,
    changeOrigin: true,
    ws: true,
    logger: console,
  })
);

// =============================================================
// 404 Handler
// =============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route bulunamadı: ${req.method} ${req.originalUrl}`,
    availableRoutes: ['/api/auth', '/api/exams', '/api/proctoring', '/api/reports', '/api/admin'],
  });
});

// =============================================================
// Global Error Handler
// =============================================================
app.use((err, req, res, next) => {
  console.error('[Gateway] Hata:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Gateway hatası.',
  });
});

// =============================================================
// MongoDB + Server Başlatma
// =============================================================
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('[Gateway] MongoDB bağlantısı başarılı.');
    
    // Demo tenant'ı otomatik seed et
    try {
      const demoTenant = await Tenant.findOne({ slug: 'demo-kurumu' });
      if (!demoTenant) {
        const newTenant = new Tenant({
          tenantId: 'tenant_demo12345',
          name: 'Demo Kurumu',
          slug: 'demo-kurumu',
          contactEmail: 'demo@proctoring.io',
          plan: 'pro',
          allowedOrigins: ['*'],
        });
        await newTenant.setApiKey('pk_live_demo12345678901');
        newTenant.webhookSecret = 'whsec_demo12345678901234567890';
        await newTenant.save();
        console.log('[Gateway] Demo tenant (pk_live_demo12345678901) başarıyla seed edildi.');
      }
    } catch (seedErr) {
      console.error('[Gateway] Demo tenant seed hatası:', seedErr.message);
    }

    app.listen(PORT, () => {
      console.log(`[Gateway] API Gateway çalışıyor: http://localhost:${PORT}`);
      console.log(`[Gateway] Upstream servisler:`, SERVICES);
    });
  })
  .catch((err) => {
    console.error('[Gateway] MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });

module.exports = app;
