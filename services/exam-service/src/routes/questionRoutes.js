const express = require('express');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.get('/exams/:id/questions', questionController.getQuestions);
router.post('/exams/:id/questions', questionController.addQuestion);
router.put('/exams/:id/questions/:questionId', questionController.updateQuestion);
router.delete('/exams/:id/questions/:questionId', questionController.deleteQuestion);

module.exports = router;