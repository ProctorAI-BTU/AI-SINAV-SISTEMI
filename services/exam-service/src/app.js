const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const examRoutes = require('./routes/examRoutes');
const questionRoutes = require('./routes/questionRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  return res.json({
    success: true,
    service: 'exam-service',
    status: 'ok',
  });
});

app.use('/exams', examRoutes);
app.use('/api/exams', examRoutes);

app.use('/sessions', sessionRoutes);
app.use('/api/sessions', sessionRoutes);

app.use('/', questionRoutes);
app.use('/api', questionRoutes);

app.use(errorHandler);

module.exports = app;
