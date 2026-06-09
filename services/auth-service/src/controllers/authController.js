const { validationResult } = require('express-validator');
const createError = require('http-errors');
const crypto = require('crypto');
const userService = require('../services/userService');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../services/jwtService');
const sendEmail = require('../services/emailService');
const User = require('../models/User');

// POST /api/auth/register isteği
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(400, errors.array()[0].msg);

  const { name, email, password, role, instructorCode } = req.body;
  const user = await userService.createUser({ name, email, password, role, instructorCode });
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  // E-posta doğrulama token'ı oluştur
  const verificationToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Doğrulama E-postası Gönder (Arka planda çalışır)
  try {
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verifyemail/${verificationToken}`;
    const message = `Lütfen e-posta adresinizi doğrulamak için şu bağlantıya tıklayın: \n\n ${verifyUrl}`;
    await sendEmail({ email: user.email, subject: 'E-posta Doğrulama', message });
  } catch (err) {
    console.log('E-posta doğrulama maili gönderilemedi', err);
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });
  }

  res.status(201).json({
    success: true,
    message: 'Kayıt başarılı. Lütfen e-postanızı doğrulayın.',
    data: {
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
      token,
      refreshToken
    },
  });
};

// POST /api/auth/login isteği
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(400, errors.array()[0].msg);

  const { email, password } = req.body;
  const user = await userService.authenticateUser(email, password);
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(200).json({
    success: true,
    message: 'Giriş başarılı',
    data: {
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
      token,
      refreshToken
    },
  });
};

// GET /api/auth/me isteği (token gerekli)
const getMe = async (req, res) => {
  const user = await userService.getUserById(req.user.id);

  res.status(200).json({
    success: true,
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
};

// PUT /api/auth/change-password (token gerekli)
const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(400, errors.array()[0].msg);

  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(req.user.id, currentPassword, newPassword);

  res.status(200).json({
    success: true,
    message: 'Şifre başarıyla değiştirildi',
  });
};

// PUT /api/auth/update-profile (token gerekli)
const updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(400, errors.array()[0].msg);

  const { name } = req.body;
  const user = await userService.updateProfile(req.user.id, { name });

  res.status(200).json({
    success: true,
    message: 'Profil güncellendi',
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) throw createError(400, 'Refresh token gerekli');

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw createError(401, 'Geçersiz token');

    const newToken = generateToken(user);
    res.status(200).json({ success: true, data: { token: newToken } });
  } catch (err) {
    throw createError(401, 'Geçersiz veya süresi dolmuş refresh token');
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw createError(404, 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı');

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  try {
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;
    const message = `Şifrenizi sıfırlamak için şu bağlantıya tıklayın: \n\n ${resetUrl}`;
    await sendEmail({ email: user.email, subject: 'Şifre Sıfırlama', message });
    res.status(200).json({ success: true, message: 'Şifre sıfırlama e-postası gönderildi' });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    throw createError(500, 'E-posta gönderilemedi');
  }
};

// PUT /api/auth/resetpassword/:resettoken
const resetPassword = async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) throw createError(400, 'Geçersiz veya süresi dolmuş token');

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Şifre başarıyla güncellendi' });
};

// GET /api/auth/verifyemail/:token
const verifyEmail = async (req, res) => {
  const emailVerificationToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({ emailVerificationToken });
  if (!user) throw createError(400, 'Geçersiz token');

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: 'E-posta başarıyla doğrulandı' });
};

module.exports = { register, login, getMe, changePassword, updateProfile, refreshToken, forgotPassword, resetPassword, verifyEmail };
