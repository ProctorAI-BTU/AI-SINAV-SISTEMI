const ProctoringEvent = require('../models/ProctoringEvent');
const ProctoringSession = require('../models/ProctoringSession');

const memorySessions = new Map();
const memoryEvents = [];

const EVENT_WEIGHTS = {
  FACE_NOT_FOUND: 18,
  MULTIPLE_FACE_DETECTED: 20,
  GAZE_WARNING: 2,
  GAZE_AWAY: 5,
  SPEECH_DETECTED: 6,
  NOISE_DETECTED: 3,
  AUDIO_DETECTED: 4,
  PHONE_DETECTED: 25,
  OBJECT_DETECTED: 16,
  PROHIBITED_OBJECT_DETECTED: 22,
  TAB_SWITCH: 10,
  FULLSCREEN_EXIT: 15,
  SHORTCUT_ATTEMPT: 10,
  COPY_PASTE_ATTEMPT: 8,
  RIGHT_CLICK_ATTEMPT: 6,
  CONNECTION_LOST: 5,
  SESSION_TERMINATED: 20,
};

const EVENT_CAPS = {
  FACE_NOT_FOUND: 54,
  MULTIPLE_FACE_DETECTED: 40,
  GAZE_WARNING: 10,
  GAZE_AWAY: 25,
  SPEECH_DETECTED: 24,
  NOISE_DETECTED: 12,
  AUDIO_DETECTED: 16,
  PHONE_DETECTED: 50,
  OBJECT_DETECTED: 32,
  PROHIBITED_OBJECT_DETECTED: 44,
  TAB_SWITCH: 30,
  FULLSCREEN_EXIT: 30,
  SHORTCUT_ATTEMPT: 20,
  COPY_PASTE_ATTEMPT: 16,
  RIGHT_CLICK_ATTEMPT: 12,
  CONNECTION_LOST: 15,
  SESSION_TERMINATED: 20,
};

function isMongoConnected() {
  return ProctoringSession.db.readyState === 1;
}

function normalizeEventType(type) {
  if (!type || typeof type !== 'string') return 'UNKNOWN_EVENT';
  return type.trim().toUpperCase();
}

function riskLevel(score) {
  if (score < 50) return 'LOW';
  if (score < 75) return 'MEDIUM';
  if (score < 90) return 'HIGH';
  return 'CRITICAL';
}

function calculateRisk(eventCounts = {}) {
  let score = 0;

  Object.entries(eventCounts).forEach(([eventType, rawCount]) => {
    const weight = EVENT_WEIGHTS[eventType];
    if (!weight) return;

    const count = Math.max(0, Number(rawCount) || 0);
    const cap = EVENT_CAPS[eventType] || weight * 3;
    score += Math.min(count * weight, cap);
  });

  const riskScore = Math.min(100, Math.round(score));
  return {
    riskScore,
    riskLevel: riskLevel(riskScore),
  };
}

function severityFor(eventType, riskScore = 0) {
  if (eventType === 'PHONE_DETECTED' || eventType === 'MULTIPLE_FACE_DETECTED') return 'high';
  if (eventType === 'PROHIBITED_OBJECT_DETECTED' || eventType === 'SESSION_TERMINATED') return 'high';
  if (riskScore >= 90) return 'critical';
  if (riskScore >= 75) return 'high';
  if (riskScore >= 50) return 'medium';
  if (EVENT_WEIGHTS[eventType]) return 'low';
  return 'info';
}

function toSessionResponse(session, events = []) {
  const plain = typeof session.toObject === 'function' ? session.toObject() : session;
  return {
    ...plain,
    events,
    durationSeconds: plain.completedAt
      ? Math.max(0, Math.round((new Date(plain.completedAt) - new Date(plain.startedAt)) / 1000))
      : Math.max(0, Math.round((Date.now() - new Date(plain.startedAt)) / 1000)),
  };
}

async function upsertSession(data = {}) {
  const now = new Date();
  const sessionId = data.sessionId || data.session_id;

  if (!sessionId) {
    const err = new Error('sessionId zorunludur.');
    err.status = 400;
    throw err;
  }

  const sessionData = {
    sessionId,
    examId: data.examId || data.exam_id || null,
    examCode: data.examCode || data.exam_code || '',
    examTitle: data.examTitle || data.exam_title || '',
    instructorId: data.instructorId || data.instructor_id || null,
    studentId: data.studentId || data.student_id || null,
    studentName: data.studentName || data.student_name || '',
    status: data.status || 'active',
    startedAt: data.startedAt || data.started_at || now,
  };

  if (isMongoConnected()) {
    const { status, ...insertData } = sessionData;
    return ProctoringSession.findOneAndUpdate(
      { sessionId },
      { $setOnInsert: insertData, $set: { status } },
      { new: true, upsert: true }
    );
  }

  const existing = memorySessions.get(sessionId);
  const next = {
    ...(existing || {}),
    ...sessionData,
    eventCounts: existing?.eventCounts || {},
    violationCount: existing?.violationCount || 0,
    riskScore: existing?.riskScore || 0,
    riskLevel: existing?.riskLevel || 'LOW',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  memorySessions.set(sessionId, next);
  return next;
}

async function listSessions(filters = {}) {
  const query = {};
  if (filters.examId) query.examId = filters.examId;
  if (filters.examCode) query.examCode = filters.examCode;
  if (filters.instructorId) query.instructorId = filters.instructorId;
  if (filters.studentId) query.studentId = filters.studentId;
  if (filters.status) query.status = filters.status;

  if (isMongoConnected()) {
    return ProctoringSession.find(query).sort({ updatedAt: -1 }).limit(200);
  }

  return [...memorySessions.values()]
    .filter((session) => Object.entries(query).every(([key, value]) => session[key] === value))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 200);
}

async function getSession(sessionId) {
  if (isMongoConnected()) {
    const session = await ProctoringSession.findOne({ sessionId });
    if (!session) return null;
    const events = await ProctoringEvent.find({ sessionId }).sort({ timestamp: 1 });
    return toSessionResponse(session, events);
  }

  const session = memorySessions.get(sessionId);
  if (!session) return null;
  const events = memoryEvents.filter((event) => event.sessionId === sessionId);
  return toSessionResponse(session, events);
}

async function logEvent(input = {}) {
  const eventType = normalizeEventType(input.eventType || input.event_type);
  const sessionId = input.sessionId || input.session_id;

  if (!sessionId) {
    const err = new Error('sessionId zorunludur.');
    err.status = 400;
    throw err;
  }

  const session = await upsertSession(input);
  const existingCounts = { ...(session.eventCounts || {}) };
  existingCounts[eventType] = (existingCounts[eventType] || 0) + 1;

  const calculated = calculateRisk(existingCounts);
  const riskScore = Number(input.riskScore ?? input.risk_score ?? calculated.riskScore);
  const risk = {
    riskScore,
    riskLevel: input.riskLevel || input.risk_level || calculated.riskLevel,
  };

  const now = new Date(input.timestamp || Date.now());
  const eventData = {
    sessionId,
    examId: input.examId || input.exam_id || session.examId || null,
    examTitle: input.examTitle || input.exam_title || session.examTitle || '',
    instructorId: input.instructorId || input.instructor_id || session.instructorId || null,
    studentId: input.studentId || input.student_id || session.studentId || null,
    studentName: input.studentName || input.student_name || session.studentName || '',
    eventType,
    source: input.source || 'system',
    severity: input.severity || severityFor(eventType, risk.riskScore),
    message: input.message || input.payload?.message || '',
    payload: input.payload || {},
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    timestamp: now,
  };

  if (isMongoConnected()) {
    const event = await ProctoringEvent.create(eventData);
    const updated = await ProctoringSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          eventCounts: existingCounts,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          lastEventAt: now,
          examId: eventData.examId,
          examTitle: eventData.examTitle,
          instructorId: eventData.instructorId,
          studentId: eventData.studentId,
          studentName: eventData.studentName,
        },
        $inc: { violationCount: EVENT_WEIGHTS[eventType] ? 1 : 0 },
      },
      { new: true }
    );

    return { event, session: updated };
  }

  const event = { _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...eventData };
  memoryEvents.push(event);

  const updated = {
    ...session,
    eventCounts: existingCounts,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    lastEventAt: now,
    violationCount: (session.violationCount || 0) + (EVENT_WEIGHTS[eventType] ? 1 : 0),
    updatedAt: now,
  };
  memorySessions.set(sessionId, updated);

  return { event, session: updated };
}

async function completeSession(sessionId, data = {}) {
  const now = new Date();
  const status = data.status || 'submitted';
  const eventCounts = data.eventCounts || data.event_counts;
  const calculated = calculateRisk(eventCounts || {});

  const update = {
    status,
    completedAt: now,
    answers: data.answers || {},
    summary: data.summary || {},
  };

  if (eventCounts) {
    update.eventCounts = eventCounts;
    update.riskScore = data.riskScore ?? data.risk_score ?? calculated.riskScore;
    update.riskLevel = data.riskLevel ?? data.risk_level ?? calculated.riskLevel;
  }

  if (isMongoConnected()) {
    const session = await ProctoringSession.findOneAndUpdate(
      { sessionId },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return getSession(session.sessionId);
  }

  const existing = memorySessions.get(sessionId) || { sessionId, startedAt: now, eventCounts: {} };
  const updated = { ...existing, ...update, updatedAt: now };
  memorySessions.set(sessionId, updated);
  return getSession(sessionId);
}

module.exports = {
  upsertSession,
  listSessions,
  getSession,
  logEvent,
  completeSession,
  calculateRisk,
};
