require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const morgan = require('morgan');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3003;
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/ai_sinav_db';

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'reporting-service',
    database: mongoose.connection.readyState === 1 ? 'mongodb' : 'disconnected',
  });
});

app.use('/api/reports', reportRoutes);
app.use('/reports', reportRoutes);

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Reporting service hatasi.',
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Reporting Service MongoDB baglantisi basarili.');
  })
  .catch((error) => {
    console.warn('Reporting Service MongoDB baglantisi basarisiz:', error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Reporting Service running on port ${PORT}`);
    });
  });

module.exports = app;
