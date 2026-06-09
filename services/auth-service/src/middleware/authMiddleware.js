const createError = require('http-errors');
const { verifyToken } = require('../services/jwtService');
const User = require('../models/User');

// jwt token doğrulama
const protect = async (req, res, next) => {
  // 1) header'dan token al
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Giriş yapmanız gerekiyor');
  }
  const token = authHeader.split(' ')[1];

  // 2) token'ı doğrula
  const decoded = verifyToken(token); // geçersizse hata fırlatır

  // 3) kullanıcı hâlâ var mı kontrol et
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw createError(401, 'Bu token geçersiz');
  }

  // 4) kullanıcıyı request'e ekle
  req.user = { id: user._id, name: user.name, email: user.email, role: user.role };
  next();
};

// rol kontrolü
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw createError(403, `${req.user.role} rolü bu işlem için yetkili değil`);
    }
    next();
  };
};

module.exports = { protect, authorize };
