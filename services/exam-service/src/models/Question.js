const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },

    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'short_answer'],
      default: 'multiple_choice',
    },

    content: {
      type: String,
      required: true,
    },

    options: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    points: {
      type: Number,
      default: 1,
    },

    orderIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Question', questionSchema);
