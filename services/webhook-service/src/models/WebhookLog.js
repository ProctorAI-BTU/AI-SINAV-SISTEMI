const mongoose = require('mongoose');

const WebhookLogSchema = new mongoose.Schema(
  {
    // Hangi tenant'a ait
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    // Webhook tipi
    event: {
      type: String,
      required: true,
      enum: ['exam.completed', 'exam.violation', 'exam.started', 'exam.aborted'],
    },
    // Hedef URL
    url: {
      type: String,
      required: true,
    },
    // Gönderilen payload
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // HMAC imzası
    signature: {
      type: String,
    },
    // Teslimat durumu
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'retrying'],
      default: 'pending',
    },
    // HTTP response
    responseStatus: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: String,
      default: null,
    },
    // Deneme sayısı
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    // Hata mesajı (başarısızsa)
    errorMessage: {
      type: String,
      default: null,
    },
    // Teslimat süresi (ms)
    durationMs: {
      type: Number,
      default: null,
    },
    // Bir sonraki deneme zamanı
    nextRetryAt: {
      type: Date,
      default: null,
    },
    // Teslim edildiği zaman
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index'ler
WebhookLogSchema.index({ tenantId: 1, createdAt: -1 });
WebhookLogSchema.index({ status: 1, nextRetryAt: 1 }); // Retry queue için

module.exports = mongoose.model('WebhookLog', WebhookLogSchema);
