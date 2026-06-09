const express = require('express');
const examController = require('../controllers/examController');

const router = express.Router();

router.get('/status', examController.serviceInfo);

router.get('/', examController.getExams);
router.post('/', examController.createExam);

router.get('/code/:code', examController.getExamByCode);
router.post('/join', examController.joinExamByCode);

router.get('/:id', examController.getExamById);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);

router.post('/:id/start', examController.startExamSkeleton);
router.post('/:id/end', examController.endExamSkeleton);

module.exports = router;
