'use strict';

const { listReports, getReport } = require('../services/reportBuilder');
const { generatePDF }            = require('../services/pdfGenerator');
const { generateExcel }          = require('../services/excelGenerator');

async function getReports(req, res) {
  const reports = await listReports(req.query);
  res.json({ success: true, count: reports.length, reports });
}

async function getReportBySession(req, res) {
  const report = await getReport(req.params.sessionId);
  if (!report) {
    return res.status(404).json({ success: false, message: 'Rapor bulunamadi.' });
  }
  return res.json({ success: true, report });
}

async function exportReportJson(req, res) {
  const report = await getReport(req.params.sessionId);
  if (!report) {
    return res.status(404).json({ success: false, message: 'Rapor bulunamadi.' });
  }
  const filename = `${req.params.sessionId}-report.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(report);
}

async function exportReportPdf(req, res) {
  const report = await getReport(req.params.sessionId);
  if (!report) {
    return res.status(404).json({ success: false, message: 'Rapor bulunamadi.' });
  }
  const pdfBuffer = await generatePDF(report);
  const filename  = `${req.params.sessionId}-report.pdf`;
  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      pdfBuffer.length);
  res.end(pdfBuffer);
}

async function exportReportExcel(req, res) {
  const report = await getReport(req.params.sessionId);
  if (!report) {
    return res.status(404).json({ success: false, message: 'Rapor bulunamadi.' });
  }
  const excelBuffer = await generateExcel(report);
  const filename     = `${req.params.sessionId}-report.xlsx`;
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length',      excelBuffer.byteLength);
  res.end(Buffer.from(excelBuffer));
}

module.exports = {
  getReports,
  getReportBySession,
  exportReportJson,
  exportReportPdf,
  exportReportExcel,
};
