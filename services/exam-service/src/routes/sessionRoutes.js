const express = require('express');
const examController = require('../controllers/examController');

const router = express.Router();

router.get('/:sessionId', examController.getSession);
router.post('/:sessionId/answer', examController.submitAnswer);
router.get('/:sessionId/results', examController.getSessionResults);

module.exports = router;
