// tüm hataları yakalayan global middleware
const errorHandler = (err, req, res, next) => {

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Sunucu hatası';

  // mongoose validation hatası
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // mongoose duplicate key 
  if (err.code === 11000) {
    status = 409;
    message = `Bu ${Object.keys(err.keyValue)[0]} zaten kayıtlı`;
  }

  // mongoose geçersiz id formatı
  if (err.name === 'CastError') {
    status = 400;
    message = 'Geçersiz ID formatı';
  }

  // jwt hataları
  if (err.name === 'JsonWebTokenError') { status = 401; message = 'Geçersiz token'; }
  if (err.name === 'TokenExpiredError') { status = 401; message = 'Token süresi dolmuş'; }

  // development'ta konsola logla
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', status, message);
  }

  res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
