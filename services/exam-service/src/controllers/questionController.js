const Question = require('../models/Question');
const { isMongoConnected } = require('../config/db');
const examController = require('./examController');

exports.getQuestions = async (req, res, next) => {
  try {
    const examId = req.params.id;
    if (isMongoConnected()) {
      const questions = await Question.find({ examId }).sort({ orderIndex: 1 });
      return res.status(200).json({
        success: true,
        questions,
        examId,
      });
    }

    const questions = (examController.memoryQuestions || []).filter(
      (q) => String(q.examId) === String(examId)
    ).sort((a, b) => a.orderIndex - b.orderIndex);

    return res.status(200).json({
      success: true,
      questions,
      examId,
    });
  } catch (error) {
    return next(error);
  }
};

exports.addQuestion = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Soru ekleme endpoint iskeleti hazır. Bu görev Koray/ilgili backend göreviyle tamamlanacak.',
  });
};

exports.updateQuestion = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Soru güncelleme endpoint iskeleti hazır.',
  });
};

exports.deleteQuestion = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Soru silme endpoint iskeleti hazır.',
  });
};
