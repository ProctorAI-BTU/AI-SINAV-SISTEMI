const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, changePassword, updateProfile, refreshToken, forgotPassword, resetPassword, verifyEmail } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  registerLimiter,
  [
    body('name').trim().notEmpty().withMessage('Ad soyad zorunludur'),
    body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz'),
    body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır'),
  ],
  register
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz'),
    body('password').notEmpty().withMessage('Şifre zorunludur'),
  ],
  login
);

// GET /api/auth/me (token gerekli)
router.get('/me', protect, getMe);

// PUT /api/auth/change-password (token gerekli)
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Mevcut şifre zorunludur'),
    body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifre en az 6 karakter olmalıdır'),
  ],
  changePassword
);

// PUT /api/auth/update-profile (token gerekli)
router.put(
  '/update-profile',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Ad en az 2 karakter olmalıdır'),
  ],
  updateProfile
);

// POST /api/auth/refresh-token
router.post('/refresh-token', refreshToken);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Geçerli bir e-posta giriniz')],
  forgotPassword
);

// PUT /api/auth/resetpassword/:resettoken
router.put(
  '/resetpassword/:resettoken',
  [body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır')],
  resetPassword
);

// GET /api/auth/verifyemail/:token
router.get('/verifyemail/:token', verifyEmail);

module.exports = router;
