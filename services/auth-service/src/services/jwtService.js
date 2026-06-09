const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'default-secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

// token üret
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    SECRET,
    { expiresIn: EXPIRES }
  );
  //return payload, imza key ve geçerlilik süresi içerir
};

// token doğrula
const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
  //token içeriğini çözümler ve doğrular
};

// token çözümler
const decodeToken = (token) => {
  return jwt.decode(token);
  //token içeriğini sadece çözümler
};

// refresh token üret 
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );
};

// refresh token doğrula
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh-secret-key');
};

module.exports = { generateToken, verifyToken, decodeToken, generateRefreshToken, verifyRefreshToken };
