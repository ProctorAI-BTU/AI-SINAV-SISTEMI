const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'Exam',
      required: true,
    },

    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    examTitle: {
      type: String,
      default: '',
    },

    studentId: {
      type: String,
      default: null,
    },

    studentName: {
      type: String,
      default: '',
    },

    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    score: {
      type: Number,
      default: 0,
    },

    maxScore: {
      type: Number,
      default: 0,
    },

    riskScore: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    riskLevel: {
      type: String,
      default: 'LOW',
    },

    eventCounts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    proctoringSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ['started', 'submitted', 'auto_submitted', 'terminated'],
      default: 'started',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Submission', submissionSchema);
