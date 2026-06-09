const rateLimit = require('express-rate-limit');

// login için 15 dakikada max 10 deneme
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

// register için 1 saatte max 5 kayıt
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Çok fazla kayıt denemesi. Daha sonra tekrar deneyin.' },
});

// genel API 15 dakikada max 100 istek
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Çok fazla istek. Daha sonra tekrar deneyin.' },
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
