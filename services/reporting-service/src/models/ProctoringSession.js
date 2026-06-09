const mongoose = require('mongoose');

const proctoringSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    examId: { type: String, default: null, index: true },
    examCode: { type: String, default: '', index: true },
    examTitle: { type: String, default: '' },
    instructorId: { type: String, default: null, index: true },
    studentId: { type: String, default: null, index: true },
    studentName: { type: String, default: '' },
    status: { type: String, default: 'active', index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    lastEventAt: { type: Date, default: null },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'LOW' },
    violationCount: { type: Number, default: 0 },
    eventCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: 'proctoringsessions', timestamps: true }
);

module.exports = mongoose.model('ProctoringSession', proctoringSessionSchema);
