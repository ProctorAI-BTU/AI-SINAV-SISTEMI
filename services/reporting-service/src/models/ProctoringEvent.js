const mongoose = require('mongoose');

const proctoringEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    examId: { type: String, default: null, index: true },
    examTitle: { type: String, default: '' },
    instructorId: { type: String, default: null, index: true },
    studentId: { type: String, default: null, index: true },
    studentName: { type: String, default: '' },
    eventType: { type: String, required: true, index: true },
    source: { type: String, default: 'system' },
    severity: { type: String, default: 'low' },
    message: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'LOW' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { collection: 'proctoringevents', timestamps: true }
);

module.exports = mongoose.model('ProctoringEvent', proctoringEventSchema);
