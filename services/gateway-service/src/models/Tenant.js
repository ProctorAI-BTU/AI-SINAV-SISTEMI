const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const TenantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      default: () => `tenant_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
    },
    name: {
      type: String,
      required: [true, 'Kurum adı zorunludur'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: [true, 'İletişim e-postası zorunludur'],
      lowercase: true,
    },
    // API Key (hash olarak saklanır)
    apiKeyHash: {
      type: String,
      select: false, // Varsayılanda sorgulara dahil edilmez
    },
    apiKeyPrefix: {
      type: String, // "pk_live_xxxx" formatının ilk 12 karakteri — gösterim için
    },
    // Webhook Ayarları
    webhookUrl: {
      type: String,
      default: null,
    },
    webhookSecret: {
      type: String,
      select: false, // HMAC imzalama için, gizli tutulur
    },
    webhookEvents: {
      type: [String],
      default: ['exam.completed', 'exam.violation', 'exam.started'],
      enum: ['exam.completed', 'exam.violation', 'exam.started', 'exam.aborted'],
    },
    // Plan ve Kota
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    quota: {
      examLimit: { type: Number, default: 100 },     // Aylık sınav limiti
      concurrentLimit: { type: Number, default: 10 }, // Eş zamanlı sınav
      storageGB: { type: Number, default: 5 },
    },
    usage: {
      currentMonthExams: { type: Number, default: 0 },
      totalExams: { type: Number, default: 0 },
      lastResetAt: { type: Date, default: Date.now },
    },
    // Branding
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: '#6366f1' },
      companyName: { type: String, default: null },
    },
    // Durum
    isActive: {
      type: Boolean,
      default: true,
    },
    allowedOrigins: {
      type: [String],
      default: ['*'],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// API Key üretici
TenantSchema.statics.generateApiKey = function () {
  const raw = `pk_live_${uuidv4().replace(/-/g, '')}`;
  return raw;
};

// Webhook secret üretici
TenantSchema.statics.generateWebhookSecret = function () {
  return crypto.randomBytes(32).toString('hex');
};

// API key kaydetme (hash)
TenantSchema.methods.setApiKey = async function (rawKey) {
  const salt = await bcrypt.genSalt(12);
  this.apiKeyHash = await bcrypt.hash(rawKey, salt);
  this.apiKeyPrefix = rawKey.slice(0, 16) + '...';
};

// API key doğrulama
TenantSchema.methods.verifyApiKey = async function (rawKey) {
  if (!this.apiKeyHash) return false;
  return bcrypt.compare(rawKey, this.apiKeyHash);
};

// Slug üretici
TenantSchema.statics.slugify = function (name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
};

module.exports = mongoose.model('Tenant', TenantSchema);
