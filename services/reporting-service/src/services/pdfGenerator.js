'use strict';

const PDFDocument = require('pdfkit');

const COLOR = {
  primary:   '#1E3A5F',
  secondary: '#2D6EA8',
  danger:    '#C0392B',
  warning:   '#E67E22',
  success:   '#27AE60',
  muted:     '#7F8C8D',
  bg:        '#F4F6F9',
  white:     '#FFFFFF',
  text:      '#2C3E50',
};

function riskColor(level) {
  switch (String(level || 'LOW').toUpperCase()) {
    case 'CRITICAL': return COLOR.danger;
    case 'HIGH':     return COLOR.warning;
    case 'MEDIUM':   return '#F39C12';
    default:         return COLOR.success;
  }
}

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

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 40) {
    doc.addPage();
  }
}

function sectionTitle(doc, L, W, title) {
  ensureSpace(doc, 50);
  doc.moveDown(0.8);
  doc.rect(L, doc.y, W, 22).fill(COLOR.secondary);
  doc.fill(COLOR.white).font('Helvetica-Bold').fontSize(11)
     .text(title, L + 8, doc.y - 18, { width: W - 16 });
  doc.fill(COLOR.text);
  doc.moveDown(0.6);
}

function infoTable(doc, L, W, rows) {
  const colW = W / 2;
  rows.forEach(([label, value], i) => {
    ensureSpace(doc, 20);
    const y = doc.y;
    doc.rect(L, y, W, 18).fill(i % 2 === 0 ? COLOR.bg : COLOR.white);
    doc.fill(COLOR.muted).font('Helvetica-Bold').fontSize(9)
       .text(label, L + 6, y + 4, { width: colW - 12 });
    doc.fill(COLOR.text).font('Helvetica').fontSize(9)
       .text(String(value), L + colW + 6, y + 4, { width: colW - 12 });
    doc.y = y + 18;
  });
  doc.moveDown(0.5);
}

function countTable(doc, L, W, rows) {
  const colW1 = W * 0.6;
  rows.forEach(([label, count], i) => {
    ensureSpace(doc, 18);
    const y = doc.y;
    doc.rect(L, y, W, 16).fill(i % 2 === 0 ? COLOR.bg : COLOR.white);
    doc.fill(COLOR.text).font('Helvetica').fontSize(9)
       .text(label, L + 6, y + 3, { width: colW1 - 12 });
    const cnt = Number(count) || 0;
    const cntColor = cnt === 0 ? COLOR.success : cnt < 3 ? COLOR.warning : COLOR.danger;
    doc.fill(cntColor).font('Helvetica-Bold').fontSize(9)
       .text(String(cnt), L + colW1 + 6, y + 3, { width: W - colW1 - 12, align: 'right' });
    doc.y = y + 16;
  });
  doc.moveDown(0.5);
}

function timelineTable(doc, L, W, events) {
  const cols = [90, 180, 70, W - 90 - 180 - 70];
  ensureSpace(doc, 22);
  let y = doc.y;
  doc.rect(L, y, W, 18).fill(COLOR.primary);
  let x = L;
  ['Zaman', 'Ihlal Turu', 'Siddeti', 'Mesaj'].forEach((h, i) => {
    doc.fill(COLOR.white).font('Helvetica-Bold').fontSize(8)
       .text(h, x + 3, y + 4, { width: cols[i] - 6 });
    x += cols[i];
  });
  doc.y = y + 18;

  events.forEach((ev, i) => {
    ensureSpace(doc, 18);
    y = doc.y;
    doc.rect(L, y, W, 16).fill(i % 2 === 0 ? COLOR.bg : COLOR.white);
    x = L;
    const cells = [
      String(fmtDate(ev.timestamp)).slice(0, 19).replace('T', ' '),
      ev.label || ev.eventType,
      (ev.severity || 'low').toUpperCase(),
      ev.message || '',
    ];
    cells.forEach((cell, ci) => {
      const clr = ci === 2 ? riskColor(ev.riskLevel) : COLOR.text;
      doc.fill(clr).font(ci === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
         .text(String(cell), x + 3, y + 3, { width: cols[ci] - 6, ellipsis: true });
      x += cols[ci];
    });
    doc.y = y + 16;
  });
  doc.moveDown(0.5);
}

function generatePDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title:   `Sinav Gozetim Raporu - ${report.sessionId}`,
        Author:  'AI Mulakat Sistemi',
        Subject: `${report.studentName} - ${report.examTitle}`,
      },
    });

    const chunks = [];
    doc.on('data',  (c) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width  - doc.page.margins.left - doc.page.margins.right;
    const L = doc.page.margins.left;

    // HEADER
    doc.rect(0, 0, doc.page.width, 80).fill(COLOR.primary);
    doc.fill(COLOR.white).fontSize(18).font('Helvetica-Bold')
       .text('AI Destekli Sinav Gozetim Sistemi', L, 18, { width: W });
    doc.fontSize(10).font('Helvetica')
       .text('Ogrenci Gozetim ve Risk Degerlendirme Raporu', L, 42, { width: W });
    doc.fill(COLOR.text);
    doc.moveDown(3);

    // 1. Oturum Bilgileri
    sectionTitle(doc, L, W, '1. Oturum Bilgileri');
    infoTable(doc, L, W, [
      ['Oturum ID',   report.sessionId      || '-'],
      ['Sinav Kodu',  report.examCode        || '-'],
      ['Sinav Adi',   report.examTitle       || '-'],
      ['Ogrenci Adi', report.studentName     || '-'],
      ['Ogrenci ID',  report.studentId       || '-'],
      ['Baslangic',   fmtDate(report.startedAt)],
      ['Bitis',       fmtDate(report.completedAt)],
      ['Sure',        fmtDuration(report.durationSeconds)],
      ['Durum',       report.status          || '-'],
    ]);

    // 2. Risk Degerlendirmesi
    sectionTitle(doc, L, W, '2. Risk Degerlendirmesi');
    const riskClr = riskColor(report.riskLevel);
    doc.roundedRect(L, doc.y, W, 60, 6).fill(COLOR.bg);
    const boxY = doc.y - 60;
    doc.fill(riskClr).font('Helvetica-Bold').fontSize(28)
       .text(`${report.riskScore}`, L + 20, boxY + 8, { width: 80, align: 'center' });
    doc.fill(riskClr).fontSize(10)
       .text('/ 100', L + 20, boxY + 40, { width: 80, align: 'center' });
    doc.fill(COLOR.text).font('Helvetica-Bold').fontSize(14)
       .text(`Risk Seviyesi: ${report.riskLabel}`, L + 120, boxY + 12);
    doc.font('Helvetica').fontSize(10)
       .text(`Toplam Ihlal: ${report.violationCount}`, L + 120, boxY + 34);
    doc.fill(COLOR.text);
    doc.moveDown(0.5);

    const s = report.summary || {};
    countTable(doc, L, W, [
      ['Yuz Algilanmadi',  s.face        || 0],
      ['Birden Fazla Yuz', s.multipleFace || 0],
      ['Bakis Sapma',      s.gaze        || 0],
      ['Ses / Konusma',    s.audio       || 0],
      ['Sekme Degisimi',   s.tab         || 0],
      ['Tam Ekran Cikisi', s.fullscreen  || 0],
      ['Klavye Kisayolu',  s.shortcuts   || 0],
    ]);

    // 3. Sorular ve Cevaplar
    if (report.answers && Object.keys(report.answers).length > 0) {
      sectionTitle(doc, L, W, '3. Sorular ve Cevaplar');
      Object.entries(report.answers).forEach(([qId, ans], idx) => {
        ensureSpace(doc, 30);
        doc.fontSize(9).font('Helvetica-Bold').fill(COLOR.secondary)
           .text(`Soru ${idx + 1} (${qId}):`, L, doc.y);
        doc.font('Helvetica').fill(COLOR.text)
           .text(typeof ans === 'object' ? JSON.stringify(ans) : String(ans),
                 L + 10, doc.y, { width: W - 10, lineGap: 2 });
        doc.moveDown(0.3);
      });
    }

    // 4. Ihlal Zaman Cizelgesi
    const violations = (report.timeline || []).filter(
      (e) => !['SESSION_COMPLETED', 'SESSION_STARTED'].includes(e.eventType)
    );
    if (violations.length > 0) {
      sectionTitle(doc, L, W, '4. Ihlal Zaman Cizelgesi');
      timelineTable(doc, L, W, violations);
    }

    // FOOTER (tüm sayfalar)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - 35;
      doc.rect(0, fy - 5, doc.page.width, 40).fill(COLOR.primary);
      doc.fill(COLOR.white).fontSize(8).font('Helvetica')
         .text(
           `AI Mulakat Sistemi – Gizli & Kurumsal Kullanim  |  Olusturulma: ${fmtDate(new Date())}  |  Sayfa ${i + 1} / ${range.count}`,
           L, fy + 2, { width: W, align: 'center' }
         );
    }

    doc.end();
  });
}

module.exports = { generatePDF };
