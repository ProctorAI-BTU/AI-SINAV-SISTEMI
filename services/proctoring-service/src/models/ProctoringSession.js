const mongoose = require('mongoose');

const proctoringSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    examId: {
      type: String,
      default: null,
      index: true,
    },
    examCode: {
      type: String,
      default: '',
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
    status: {
      type: String,
      enum: ['waiting', 'active', 'submitted', 'auto_submitted', 'terminated'],
      default: 'active',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastEventAt: {
      type: Date,
      default: null,
    },
    riskScore: {
      type: Number,
      default: 0,
    },
    riskLevel: {
      type: String,
      default: 'LOW',
    },
    violationCount: {
      type: Number,
      default: 0,
    },
    eventCounts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

proctoringSessionSchema.index({ instructorId: 1, status: 1, updatedAt: -1 });
proctoringSessionSchema.index({ examId: 1, updatedAt: -1 });

module.exports = mongoose.model('ProctoringSession', proctoringSessionSchema);
