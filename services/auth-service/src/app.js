require('dotenv').config();
require('express-async-errors'); // try/catch otomatik tüm async hatalar errorHandler'a gider

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// global middleware
app.use(helmet()); // güvenlik header'ları
app.use(cors({ origin: '*', credentials: true })); // cross-origin izni
app.use(express.json({ limit: '10mb' })); // JSON body parse
app.use(morgan('dev')); // HTTP request log
app.use(apiLimiter); // genel rate limit

// health check
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'auth-service', status: 'running' });
});

// route'ları bağla
app.use('/api/auth', authRoutes);   // /api/auth/register, /api/auth/login, /api/auth/me
app.use('/api/users', userRoutes);  // /api/users, /api/users/:id, /api/users/:id/role

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route bulunamadı: ${req.method} ${req.originalUrl}` });
});

// hata yakalayıcı
app.use(errorHandler);

// mongodb bağlantısı ve sunucu başlatma
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_sinav_db';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB bağlantısı başarılı');
    app.listen(PORT, () => {
      console.log(`Auth Service çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });

module.exports = app;
