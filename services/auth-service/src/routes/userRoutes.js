const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

const router = express.Router();

router.use(protect);

// === Sadece adminlere özel ===
router.use(authorize('admin'));

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.post('/instructor-codes', userController.generateInstructorCode);
router.get('/instructor-codes', userController.listInstructorCodes);

module.exports = router;
