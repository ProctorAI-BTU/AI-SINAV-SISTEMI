'use strict';

const express          = require('express');
const reportController = require('../controllers/reportController');

const router = express.Router();

// Tüm raporları listele (filtreli)
// GET /api/reports?examId=...&studentId=...&status=...
router.get('/', reportController.getReports);

// Belirli oturumun JSON raporunu görüntüle
router.get('/:sessionId', reportController.getReportBySession);

// Export: JSON
router.get('/:sessionId/export.json', reportController.exportReportJson);

// Export: PDF
router.get('/:sessionId/export.pdf', reportController.exportReportPdf);

// Export: Excel (xlsx)
router.get('/:sessionId/export.xlsx', reportController.exportReportExcel);

module.exports = router;
