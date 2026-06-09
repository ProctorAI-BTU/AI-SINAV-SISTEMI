const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    instructorId: {
      type: String,
      default: null,
    },

    accessCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      unique: true,
      sparse: true,
    },

    allowedStudentIds: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'active', 'completed', 'archived'],
      default: 'draft',
    },

    startTime: {
      type: Date,
      default: null,
    },

    endTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

function generateAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

examSchema.pre('validate', function ensureAccessCode(next) {
  if (!this.accessCode) {
    this.accessCode = generateAccessCode();
  }
  next();
});

module.exports = mongoose.model('Exam', examSchema);
