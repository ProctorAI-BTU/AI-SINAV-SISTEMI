const mongoose = require('mongoose');

const proctoringEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    examId: {
      type: String,
      default: null,
      index: true,
    },
    examTitle: {
      type: String,
      default: '',
    },
    instructorId: {
      type: String,
      default: null,
      index: true,
    },
    studentId: {
      type: String,
      default: null,
      index: true,
    },
    studentName: {
      type: String,
      default: '',
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['face', 'gaze', 'audio', 'object', 'browser', 'exam', 'risk', 'system'],
      default: 'system',
    },
    severity: {
      type: String,
      enum: ['info', 'low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    message: {
      type: String,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    riskScore: {
      type: Number,
      default: 0,
    },
    riskLevel: {
      type: String,
      default: 'LOW',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

proctoringEventSchema.index({ sessionId: 1, timestamp: -1 });

module.exports = mongoose.model('ProctoringEvent', proctoringEventSchema);
