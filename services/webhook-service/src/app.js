require('dotenv').config();
require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 3005;
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/ai_sinav_db';

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'webhook-service',
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/webhooks', webhookRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[WebhookService] Hata:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Webhook service hatası.',
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[WebhookService] MongoDB bağlantısı başarılı.');
  })
  .catch((err) => {
    console.warn('[WebhookService] MongoDB bağlantısı başarısız:', err.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[WebhookService] Webhook Service çalışıyor: http://localhost:${PORT}`);
    });
  });

module.exports = app;
