const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ad soyad zorunludur'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'E-posta zorunludur'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Şifre zorunludur'],
      minlength: 6,
      select: false, // sorgularda şifre dönmemesini sağlar
    },
    role: {
      type: String,
      enum: ['student', 'instructor', 'admin'],
      default: 'student',
    },
    isActive: { 
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// kayıt öncesinde şifreyi hashleme
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // şifre değişmediyse atla

  this.password = await bcrypt.hash(this.password, 12); //şifreyi hashle
  next();
  
});

// login şifre doğrulamak için
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Şifre sıfırlama token'ı üret
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  // Token'ı hashleyip veritabanına kaydetmek için ayarla
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  // 10 dakika geçerlilik süresi
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Email doğrulama token'ı üret
userSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  return verificationToken;
};

module.exports = mongoose.model('User', userSchema);
