const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: String, default: '' },
  isCorrect: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
});

const examSessionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },  // auth-service user ID
  studentName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['waiting', 'active', 'submitted', 'terminated'],
    default: 'waiting',
  },
  startedAt: { type: Date },
  submittedAt: { type: Date },
  answers: [answerSchema],
  score: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },           // AI'dan gelen risk skoru
  violations: { type: Number, default: 0 },
  violationLog: [{
    type: { type: String },
    timestamp: { type: Date, default: Date.now },
    detail: { type: String },
  }],
}, { timestamps: true });

module.exports = mongoose.model('ExamSession', examSessionSchema);
