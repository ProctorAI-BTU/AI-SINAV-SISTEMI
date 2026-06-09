const ProctoringSession = require('../models/ProctoringSession');
const ProctoringEvent = require('../models/ProctoringEvent');

const EVENT_LABELS = {
  FACE_NOT_FOUND: 'Yuz algilanmadi',
  MULTIPLE_FACE_DETECTED: 'Birden fazla yuz algilandi',
  GAZE_WARNING: 'Kisa sureli bakis ekran disinda',
  GAZE_AWAY: 'Bakis ekran disina kaydi',
  AUDIO_DETECTED: '2-3 saniye ses riski',
  SPEECH_DETECTED: '2-3 saniye konusma/ses riski',
  NOISE_DETECTED: '2-3 saniye yuksek ses riski',
  PHONE_DETECTED: 'Telefon algilandi',
  OBJECT_DETECTED: 'Yasakli/ilgili nesne algilandi',
  PROHIBITED_OBJECT_DETECTED: 'Yasakli nesne algilandi',
  TAB_SWITCH: 'Sekme degisimi',
  FULLSCREEN_EXIT: 'Tam ekrandan cikildi',
  SHORTCUT_ATTEMPT: 'Klavye kisayolu denemesi',
  COPY_PASTE_ATTEMPT: 'Kopyala/yapistir denemesi',
  RIGHT_CLICK_ATTEMPT: 'Sag tik denemesi',
  SESSION_COMPLETED: 'Sinav tamamlandi',
  SESSION_TERMINATED: 'Oturum sonlandirildi',
};

function eventLabel(eventType) {
  return EVENT_LABELS[eventType] || eventType;
}

function riskLabel(level) {
  const normalized = String(level || 'LOW').toUpperCase();
  if (normalized === 'CRITICAL') return 'Kritik';
  if (normalized === 'HIGH') return 'Yuksek';
  if (normalized === 'MEDIUM') return 'Orta';
  return 'Dusuk';
}

function buildReport(session, events) {
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const startedAt = session?.startedAt ? new Date(session.startedAt) : null;
  const completedAt = session?.completedAt ? new Date(session.completedAt) : null;

  return {
    sessionId: session.sessionId,
    examId: session.examId,
    examCode: session.examCode,
    examTitle: session.examTitle || 'Sinav',
    instructorId: session.instructorId,
    studentId: session.studentId,
    studentName: session.studentName || 'Ogrenci',
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    durationSeconds: startedAt
      ? Math.max(0, Math.round(((completedAt || new Date()) - startedAt) / 1000))
      : 0,
    riskScore: session.riskScore || 0,
    riskLevel: session.riskLevel || 'LOW',
    riskLabel: riskLabel(session.riskLevel),
    violationCount: session.violationCount || 0,
    eventCounts: session.eventCounts || {},
    summary: {
      face: session.eventCounts?.FACE_NOT_FOUND || 0,
      multipleFace: session.eventCounts?.MULTIPLE_FACE_DETECTED || 0,
      gaze: session.eventCounts?.GAZE_AWAY || 0,
      gazeWarning: session.eventCounts?.GAZE_WARNING || 0,
      audio:
        (session.eventCounts?.SPEECH_DETECTED || 0) +
        (session.eventCounts?.NOISE_DETECTED || 0) +
        (session.eventCounts?.AUDIO_DETECTED || 0),
      objects:
        (session.eventCounts?.PHONE_DETECTED || 0) +
        (session.eventCounts?.OBJECT_DETECTED || 0) +
        (session.eventCounts?.PROHIBITED_OBJECT_DETECTED || 0),
      tab: session.eventCounts?.TAB_SWITCH || 0,
      fullscreen: session.eventCounts?.FULLSCREEN_EXIT || 0,
      shortcuts:
        (session.eventCounts?.SHORTCUT_ATTEMPT || 0) +
        (session.eventCounts?.COPY_PASTE_ATTEMPT || 0) +
        (session.eventCounts?.RIGHT_CLICK_ATTEMPT || 0),
    },
    timeline: sortedEvents.map((event) => ({
      id: event._id,
      eventType: event.eventType,
      label: eventLabel(event.eventType),
      source: event.source,
      severity: event.severity,
      message: event.message,
      payload: event.payload,
      riskScore: event.riskScore,
      riskLevel: event.riskLevel,
      timestamp: event.timestamp,
    })),
  };
}

async function listReports(filters = {}) {
  const query = {};
  if (filters.examId) query.examId = filters.examId;
  if (filters.examCode) query.examCode = filters.examCode;
  if (filters.instructorId) query.instructorId = filters.instructorId;
  if (filters.studentId) query.studentId = filters.studentId;
  if (filters.status) query.status = filters.status;

  const sessions = await ProctoringSession.find(query).sort({ updatedAt: -1 }).limit(200);
  return sessions.map((session) => buildReport(session.toObject(), []));
}

async function getReport(sessionId) {
  const session = await ProctoringSession.findOne({ sessionId });
  if (!session) return null;

  const events = await ProctoringEvent.find({ sessionId }).sort({ timestamp: 1 });
  return buildReport(session.toObject(), events.map((event) => event.toObject()));
}

module.exports = {
  buildReport,
  listReports,
  getReport,
};
