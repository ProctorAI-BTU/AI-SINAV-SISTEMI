const crypto = require('crypto');
const User = require('../models/User');
const InstructorCode = require('../models/InstructorCode');
const createError = require('http-errors');

// ──────────────────────────────────────────────────────────────
// Mevcut Fonksiyonlar
// ──────────────────────────────────────────────────────────────

exports.getAllUsers = async (role) => {
  const query = {};
  if (role) {
    if (!['student', 'instructor', 'admin'].includes(role)) {
      throw createError(400, 'Geçersiz rol türü');
    }
    query.role = role;
  }
  
  const users = await User.find(query).select('-password').sort({ createdAt: -1 });
  return users;
};

exports.generateInstructorCode = async (adminId) => {
  // Rastgele 8 haneli güvenli kod üretimi (Örn: INST-A1B2C3D4)
  const randomBytes = crypto.randomBytes(4).toString('hex').toUpperCase();
  const codeString = `INST-${randomBytes}`;

  const newCode = await InstructorCode.create({
    code: codeString,
    createdBy: adminId,
  });

  return newCode;
};

exports.listInstructorCodes = async () => {
  const codes = await InstructorCode.find()
    .populate('createdBy', 'name email')
    .populate('usedBy', 'name email')
    .sort({ createdAt: -1 });
  return codes;
};

// ──────────────────────────────────────────────────────────────
// Yeni / Kurtarılan Fonksiyonlar (Eksik Olanlar)
// ──────────────────────────────────────────────────────────────

/**
 * Yeni Kullanıcı Oluşturma (Kayıt)
 */
exports.createUser = async (userData) => {
  const { name, email, password, role, instructorCode } = userData;

  // 1) E-posta çakışma kontrolü
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createError(400, 'Bu e-posta adresi zaten kullanımda.');
  }

  // 2) Eğitmen rolü için kod doğrulaması
  let codeDoc = null;
  if (role === 'instructor') {
    const systemSecret = process.env.INSTRUCTOR_SECRET_CODE || 'EGITMEN-AI-2024';
    
    if (instructorCode !== systemSecret) {
      // Tek kullanımlık kod tablosunda ara
      codeDoc = await InstructorCode.findOne({ code: instructorCode, isUsed: false });
      if (!codeDoc) {
        throw createError(400, 'Geçersiz veya kullanılmış eğitmen kodu.');
      }
    }
  }

  // 3) Kullanıcıyı oluştur
  const user = new User({
    name,
    email,
    password,
    role: role || 'student',
  });

  await user.save();

  // 4) Eğitmen kodu kullanıldıysa işaretle
  if (codeDoc) {
    codeDoc.isUsed = true;
    codeDoc.usedBy = user._id;
    codeDoc.usedAt = new Date();
    await codeDoc.save();
  }

  return user;
};

/**
 * Kullanıcı Kimlik Doğrulama (Giriş)
 */
exports.authenticateUser = async (email, password) => {
  // Şifreyi açıkça seçiyoruz (User modelinde select: false olduğu için)
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    throw createError(401, 'Geçersiz e-posta veya şifre.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw createError(401, 'Geçersiz e-posta veya şifre.');
  }

  return user;
};

/**
 * ID'ye göre Kullanıcı Getirme
 */
exports.getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createError(404, 'Kullanıcı bulunamadı.');
  }
  return user;
};

/**
 * Şifre Değiştirme
 */
exports.changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw createError(404, 'Kullanıcı bulunamadı.');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw createError(400, 'Mevcut şifreniz hatalı.');
  }

  user.password = newPassword;
  await user.save();
};

/**
 * Profil Bilgilerini Güncelleme
 */
exports.updateProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createError(404, 'Kullanıcı bulunamadı.');
  }

  if (updateData.name) {
    user.name = updateData.name;
  }

  await user.save({ validateBeforeSave: false });
  return user;
};
