const mongoose = require('mongoose');

const instructorCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InstructorCode', instructorCodeSchema);
