'use strict';

const ExcelJS = require('exceljs');

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

function fmtDuration(secs) {
  if (!secs) return '0 sn';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h} sa ${m} dk ${s} sn`;
  if (m > 0) return `${m} dk ${s} sn`;
  return `${s} sn`;
}

// Renk yardımcıları (ARGB)
const C = {
  header:    'FF1E3A5F',
  secondary: 'FF2D6EA8',
  danger:    'FFC0392B',
  warning:   'FFE67E22',
  success:   'FF27AE60',
  yellow:    'FFF39C12',
  bg:        'FFF4F6F9',
  white:     'FFFFFFFF',
  text:      'FF2C3E50',
  muted:     'FF7F8C8D',
  rowAlt:    'FFEAF2FB',
};

function riskArgb(level) {
  switch (String(level || 'LOW').toUpperCase()) {
    case 'CRITICAL': return C.danger;
    case 'HIGH':     return C.warning;
    case 'MEDIUM':   return C.yellow;
    default:         return C.success;
  }
}

function headerStyle(fgArgb = C.header) {
  return {
    font:      { bold: true, color: { argb: C.white }, size: 11 },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: fgArgb } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border:    allBorder(),
  };
}

function cellStyle(bgArgb = C.white, bold = false, align = 'left') {
  return {
    font:      { bold, size: 10 },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } },
    alignment: { vertical: 'middle', horizontal: align, wrapText: true },
    border:    allBorder(),
  };
}

function allBorder() {
  const side = { style: 'thin', color: { argb: 'FFBDC3C7' } };
  return { top: side, left: side, bottom: side, right: side };
}

/**
 * Raporu Excel Buffer olarak oluşturur.
 * @param {object} report  reportBuilder.buildReport() çıktısı
 * @returns {Promise<Buffer>}
 */
async function generateExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI Mulakat Sistemi';
  wb.created = new Date();
  wb.subject  = `${report.studentName} – ${report.examTitle}`;

  // ── SAYFA 1: Özet ──────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Ozet', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws1.columns = [
    { header: 'Alan',  key: 'field', width: 28 },
    { header: 'Deger', key: 'value', width: 42 },
  ];
  ws1.getRow(1).eachCell((cell) => { cell.style = headerStyle(); });
  ws1.getRow(1).height = 22;

  const infoRows = [
    ['Oturum ID',          report.sessionId       || '-'],
    ['Sinav Kodu',         report.examCode         || '-'],
    ['Sinav Adi',          report.examTitle        || '-'],
    ['Ogrenci Adi',        report.studentName      || '-'],
    ['Ogrenci ID',         report.studentId        || '-'],
    ['Egitmen ID',         report.instructorId     || '-'],
    ['Durum',              report.status           || '-'],
    ['Baslangic',          fmtDate(report.startedAt)],
    ['Bitis',              fmtDate(report.completedAt)],
    ['Sure',               fmtDuration(report.durationSeconds)],
    ['Risk Skoru',         `${report.riskScore} / 100`],
    ['Risk Seviyesi',      report.riskLabel        || '-'],
    ['Toplam Ihlal',       report.violationCount   || 0],
    ['Yuz Algilanmadi',    (report.summary || {}).face        || 0],
    ['Birden Fazla Yuz',   (report.summary || {}).multipleFace || 0],
    ['Bakis Sapma',        (report.summary || {}).gaze        || 0],
    ['Ses / Konusma',      (report.summary || {}).audio       || 0],
    ['Sekme Degisimi',     (report.summary || {}).tab         || 0],
    ['Tam Ekran Cikisi',   (report.summary || {}).fullscreen  || 0],
    ['Klavye Kisayolu',    (report.summary || {}).shortcuts   || 0],
  ];

  infoRows.forEach(([field, value], i) => {
    const bg = i % 2 === 0 ? C.bg : C.white;
    const row = ws1.addRow({ field, value });
    row.height = 20;
    row.getCell('field').style = cellStyle(bg, true);
    row.getCell('value').style = cellStyle(bg, false);

    // Risk skoru ve seviyesi için özel renk
    if (field === 'Risk Skoru' || field === 'Risk Seviyesi') {
      const clrArgb = riskArgb(report.riskLevel);
      row.getCell('value').style = {
        ...cellStyle(bg, true),
        font: { bold: true, size: 11, color: { argb: clrArgb } },
      };
    }
  });

  // ── SAYFA 2: İhlaller ──────────────────────────────────────────────────────
  const violations = (report.timeline || []).filter(
    (e) => !['SESSION_COMPLETED', 'SESSION_STARTED'].includes(e.eventType)
  );

  const ws2 = wb.addWorksheet('Ihlaller', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws2.columns = [
    { header: '#',          key: 'no',        width: 6  },
    { header: 'Zaman',      key: 'ts',        width: 22 },
    { header: 'Ihlal Turu', key: 'label',     width: 32 },
    { header: 'Kaynak',     key: 'source',    width: 18 },
    { header: 'Siddet',     key: 'severity',  width: 12 },
    { header: 'Risk Skoru', key: 'riskScore', width: 14 },
    { header: 'Risk Sev.',  key: 'riskLevel', width: 12 },
    { header: 'Mesaj',      key: 'message',   width: 40 },
  ];
  ws2.getRow(1).eachCell((cell) => { cell.style = headerStyle(C.secondary); });
  ws2.getRow(1).height = 22;

  violations.forEach((ev, i) => {
    const bg = i % 2 === 0 ? C.bg : C.white;
    const row = ws2.addRow({
      no:        i + 1,
      ts:        fmtDate(ev.timestamp),
      label:     ev.label || ev.eventType,
      source:    ev.source || '-',
      severity:  (ev.severity || 'low').toUpperCase(),
      riskScore: ev.riskScore || 0,
      riskLevel: ev.riskLevel || 'LOW',
      message:   ev.message || '',
    });
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.style = cellStyle(bg);
      // Siddet & Risk seviyesi sütunları renkli
      if (colNum === 5 || colNum === 7) {
        const clrArgb = riskArgb(ev.riskLevel);
        cell.style = { ...cellStyle(bg, true), font: { bold: true, color: { argb: clrArgb }, size: 10 } };
      }
    });
  });

  if (violations.length === 0) {
    ws2.addRow({ label: 'Kayitli ihlal bulunamadi.' });
  }

  // ── SAYFA 3: Sorular & Cevaplar ────────────────────────────────────────────
  if (report.answers && Object.keys(report.answers).length > 0) {
    const ws3 = wb.addWorksheet('Sorular', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws3.columns = [
      { header: '#',        key: 'no',     width: 6  },
      { header: 'Soru ID', key: 'qid',    width: 30 },
      { header: 'Cevap',   key: 'answer', width: 60 },
    ];
    ws3.getRow(1).eachCell((cell) => { cell.style = headerStyle(C.secondary); });
    ws3.getRow(1).height = 22;

    Object.entries(report.answers).forEach(([qId, ans], i) => {
      const bg = i % 2 === 0 ? C.bg : C.white;
      const row = ws3.addRow({
        no:     i + 1,
        qid:    qId,
        answer: typeof ans === 'object' ? JSON.stringify(ans) : String(ans),
      });
      row.height = 20;
      row.eachCell((cell) => { cell.style = cellStyle(bg); });
    });
  }

  // ── SAYFA 4: Ham Zaman Çizelgesi ───────────────────────────────────────────
  if ((report.timeline || []).length > 0) {
    const ws4 = wb.addWorksheet('Tum Olaylar', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws4.columns = [
      { header: '#',          key: 'no',        width: 6  },
      { header: 'Zaman',      key: 'ts',        width: 22 },
      { header: 'Olay Turu',  key: 'eventType', width: 32 },
      { header: 'Etiketi',    key: 'label',     width: 32 },
      { header: 'Kaynak',     key: 'source',    width: 18 },
      { header: 'Siddet',     key: 'severity',  width: 12 },
      { header: 'Risk Skoru', key: 'riskScore', width: 14 },
      { header: 'Risk Sev.',  key: 'riskLevel', width: 12 },
      { header: 'Mesaj',      key: 'message',   width: 40 },
    ];
    ws4.getRow(1).eachCell((cell) => { cell.style = headerStyle(C.header); });
    ws4.getRow(1).height = 22;

    report.timeline.forEach((ev, i) => {
      const bg = i % 2 === 0 ? C.bg : C.white;
      const row = ws4.addRow({
        no:        i + 1,
        ts:        fmtDate(ev.timestamp),
        eventType: ev.eventType,
        label:     ev.label || ev.eventType,
        source:    ev.source || '-',
        severity:  (ev.severity || 'low').toUpperCase(),
        riskScore: ev.riskScore || 0,
        riskLevel: ev.riskLevel || 'LOW',
        message:   ev.message || '',
      });
      row.height = 20;
      row.eachCell((cell) => { cell.style = cellStyle(bg); });
    });
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { generateExcel };
