require('dotenv').config();
require('express-async-errors');

const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const morgan = require('morgan');
const { Server } = require('socket.io');
const aiClient = require('./services/aiClient');

// ============================================================
// Webhook Servisi İstemcisi
// ============================================================
const WEBHOOK_SERVICE_URL =
  process.env.WEBHOOK_SERVICE_URL || 'http://webhook-service:3005';

/**
 * Sınav tamamlandığında webhook servisini tetikler.
 * Tenant bilgisi gateway tarafından header olarak iletilir.
 */
async function triggerWebhook(tenantId, webhookSecret, webhookUrl, event, data) {
  if (!tenantId || !webhookUrl || !webhookSecret) return;

  try {
    const payload = JSON.stringify({
      tenantId,
      event,
      url: webhookUrl,
      webhookSecret,
      data,
    });

    const urlObj = new URL(`${WEBHOOK_SERVICE_URL}/api/webhooks/send`);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const reqOpts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const webhookReq = lib.request(reqOpts, (res) => {
      console.log(`[Proctoring] Webhook tetiklendi (${event}) → HTTP ${res.statusCode}`);
    });
    webhookReq.on('error', (err) =>
      console.warn('[Proctoring] Webhook service ulaşılamadı:', err.message)
    );
    webhookReq.write(payload);
    webhookReq.end();
  } catch (err) {
    console.warn('[Proctoring] triggerWebhook hatası:', err.message);
  }
}

const {
  upsertSession,
  listSessions,
  getSession,
  logEvent,
  completeSession,
} = require('./services/eventLogger');

const PORT = process.env.PORT || 3004;
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/ai_sinav_db';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'proctoring-service',
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'mongodb' : 'memory-fallback',
  });
});

app.get('/api/proctoring/health', (req, res) => {
  res.json({
    success: true,
    service: 'proctoring-service',
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'mongodb' : 'memory-fallback',
  });
});

async function createSessionHandler(req, res) {
  const session = await upsertSession(req.body);
  io.to(session.sessionId).emit('session-updated', session);
  res.status(201).json({ success: true, session });
}

async function listSessionsHandler(req, res) {
  const sessions = await listSessions(req.query);
  res.json({ success: true, count: sessions.length, sessions });
}

async function getSessionHandler(req, res) {
  const session = await getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Oturum bulunamadi.' });
  }
  return res.json({ success: true, session });
}

async function logEventHandler(req, res) {
  const result = await logEvent(req.body);
  io.to(result.session.sessionId).emit('proctoring-event', result);
  io.emit('proctoring-dashboard-event', result);
  res.status(201).json({ success: true, ...result });
}

function getSessionId(body = {}) {
  return body.sessionId || body.session_id;
}

function normalizeEventType(eventType) {
  return String(eventType || '').trim().toUpperCase();
}

function buildEventInput(sessionId, eventType, source, result = {}, meta = {}) {
  return {
    ...meta,
    sessionId,
    eventType: normalizeEventType(eventType),
    source,
    message: result.message || meta.message || '',
    payload: {
      ...meta,
      source,
      result,
      message: result.message || meta.message || '',
    },
  };
}

function shouldRecordFace(faceResult) {
  return Boolean(faceResult?.event_type && faceResult.event_type !== 'FACE_OK');
}

function shouldRecordGaze(gazeResult) {
  return gazeResult?.event_type === 'GAZE_AWAY' || gazeResult?.event_type === 'GAZE_WARNING';
}

function shouldRecordAudio(audioResult) {
  return Boolean(audioResult?.event_type && audioResult.event_type !== 'AUDIO_OK');
}

async function recordAnalyzedEvent(sessionId, eventType, source, result, meta = {}) {
  const normalizedEvent = normalizeEventType(eventType);
  const riskData = await aiClient.analyzeRisk(sessionId, normalizedEvent, {
    ...meta,
    source,
    result,
  });

  const logged = await logEvent({
    ...buildEventInput(sessionId, normalizedEvent, source, result, meta),
    riskScore: riskData?.risk_score,
    riskLevel: riskData?.risk_level,
  });

  io.to(logged.session.sessionId).emit('proctoring-event', logged);
  io.emit('proctoring-dashboard-event', logged);

  return { ...logged, risk: riskData };
}

async function analyzeFrameHandler(req, res) {
  const sessionId = getSessionId(req.body);
  const imageBase64 = req.body.imageBase64 || req.body.image_base64;
  const meta = req.body.payload || req.body.meta || {};

  if (!sessionId || !imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'sessionId ve imageBase64 zorunludur.',
    });
  }

  const analysis = await aiClient.analyzeFrame(sessionId, imageBase64);
  const events = [];

  if (shouldRecordFace(analysis.face)) {
    events.push(await recordAnalyzedEvent(sessionId, analysis.face.event_type, 'face', analysis.face, meta));
  }

  if (shouldRecordGaze(analysis.gaze)) {
    events.push(await recordAnalyzedEvent(sessionId, analysis.gaze.event_type, 'gaze', analysis.gaze, meta));
  }

  const risk = await aiClient.getRiskScore(sessionId).catch(() => events.at(-1)?.risk || null);

  return res.json({
    success: true,
    ...analysis,
    events,
    risk,
  });
}

async function precheckFaceHandler(req, res) {
  const sessionId = getSessionId(req.body) || `precheck-${Date.now()}`;
  const imageBase64 = req.body.imageBase64 || req.body.image_base64;

  if (!imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'imageBase64 zorunludur.',
    });
  }

  const face = await aiClient.detectFace(sessionId, imageBase64);

  return res.json({
    success: true,
    face,
    canStart: Boolean(face?.face_detected && !face?.multiple_faces),
  });
}

async function analyzeAudioHandler(req, res) {
  const sessionId = getSessionId(req.body);
  const audioBase64 = req.body.audioBase64 || req.body.audio_base64;
  const sampleRate = req.body.sampleRate || req.body.sample_rate || 16000;
  const meta = req.body.payload || req.body.meta || {};

  if (!sessionId || !audioBase64) {
    return res.status(400).json({
      success: false,
      message: 'sessionId ve audioBase64 zorunludur.',
    });
  }

  const audio = await aiClient.analyzeAudio(sessionId, audioBase64, sampleRate);
  const events = [];

  if (shouldRecordAudio(audio)) {
    events.push(await recordAnalyzedEvent(sessionId, audio.event_type, 'audio', audio, meta));
  }

  const risk = await aiClient.getRiskScore(sessionId).catch(() => events.at(-1)?.risk || null);

  return res.json({
    success: true,
    audio,
    events,
    risk,
  });
}

async function analyzeEventHandler(req, res) {
  const sessionId = getSessionId(req.body);
  const eventType = normalizeEventType(req.body.eventType || req.body.event_type);
  const source = req.body.source || req.body.payload?.source || 'system';
  const meta = req.body.payload || {};

  if (!sessionId || !eventType) {
    return res.status(400).json({
      success: false,
      message: 'sessionId ve eventType zorunludur.',
    });
  }

  const result = {
    event_type: eventType,
    message: req.body.message || meta.message || '',
    ...(req.body.result || meta.result || {}),
  };
  const logged = await recordAnalyzedEvent(sessionId, eventType, source, result, meta);

  return res.status(201).json({ success: true, ...logged });
}

async function riskScoreHandler(req, res) {
  const risk = await aiClient.getRiskScore(req.params.sessionId);
  return res.json({ success: true, risk });
}

async function completeSessionHandler(req, res) {
  const session = await completeSession(req.params.sessionId, req.body);
  io.to(req.params.sessionId).emit('session-completed', session);
  io.emit('proctoring-dashboard-event', { session, event: { eventType: 'SESSION_COMPLETED' } });
  res.json({ success: true, session });

  // B2B: Webhook tetikle (tenant header'ları Gateway tarafından iletilir)
  const tenantId = req.headers['x-tenant-id'];
  const webhookUrl = req.headers['x-webhook-url'];
  const webhookSecret = req.headers['x-webhook-secret'];

  triggerWebhook(tenantId, webhookSecret, webhookUrl, 'exam.completed', {
    sessionId: req.params.sessionId,
    examId: session.examId,
    studentId: session.studentId,
    riskScore: session.riskScore,
    riskLevel: session.riskLevel,
    totalEvents: session.totalEvents,
    duration: session.duration,
    completedAt: new Date().toISOString(),
  });
}

app.post('/api/proctoring/sessions', createSessionHandler);
app.get('/api/proctoring/sessions', listSessionsHandler);
app.get('/api/proctoring/sessions/:sessionId', getSessionHandler);
app.post('/api/proctoring/events', logEventHandler);
app.post('/api/proctoring/precheck/face', precheckFaceHandler);
app.post('/api/proctoring/analyze/frame', analyzeFrameHandler);
app.post('/api/proctoring/analyze/audio', analyzeAudioHandler);
app.post('/api/proctoring/analyze/event', analyzeEventHandler);
app.get('/api/proctoring/risk/:sessionId', riskScoreHandler);
app.post('/api/proctoring/sessions/:sessionId/complete', completeSessionHandler);

app.post('/sessions', createSessionHandler);
app.get('/sessions', listSessionsHandler);
app.get('/sessions/:sessionId', getSessionHandler);
app.post('/events', logEventHandler);
app.post('/precheck/face', precheckFaceHandler);
app.post('/analyze/frame', analyzeFrameHandler);
app.post('/analyze/audio', analyzeAudioHandler);
app.post('/analyze/event', analyzeEventHandler);
app.get('/risk/:sessionId', riskScoreHandler);
app.post('/sessions/:sessionId/complete', completeSessionHandler);

io.on('connection', (socket) => {
  console.log('[Socket] Client baglandi:', socket.id);

  socket.on('join-session', (sessionId) => {
    if (sessionId) {
      socket.join(sessionId);
      console.log(`[Socket] ${socket.id} session odasina katildi: ${sessionId}`);
    }
  });

  socket.on('join-dashboard', (payload = {}) => {
    const instructorId = payload.instructorId || payload;

    socket.join('dashboard');

    if (instructorId) {
      socket.join(`instructor:${instructorId}`);
      console.log(`[Socket] ${socket.id} instructor odasina katildi: ${instructorId}`);
    }
  });

  socket.on('proctoring-frame', async (data = {}, callback) => {
    try {
      const sessionId = data.sessionId || data.session_id;
      const imageBase64 = data.imageBase64 || data.image_base64;
      const meta = data.payload || data.meta || {};

            console.log('[Socket] Frame geldi:', {
        sessionId,
        hasImage: Boolean(imageBase64),
        studentId: meta.studentId,
        examId: meta.examId,
      });

      if (!sessionId || !imageBase64) {
        const errorResponse = {
          success: false,
          message: 'sessionId ve imageBase64 zorunludur.',
        };

        if (callback) callback(errorResponse);
        socket.emit('proctoring-error', errorResponse);
        return;
      }

      const analysis = await aiClient.analyzeFrame(sessionId, imageBase64);
      const events = [];

      if (shouldRecordFace(analysis.face)) {
        events.push(
          await recordAnalyzedEvent(
            sessionId,
            analysis.face.event_type,
            'face',
            analysis.face,
            meta
          )
        );
      }

      if (shouldRecordGaze(analysis.gaze)) {
        events.push(
          await recordAnalyzedEvent(
            sessionId,
            analysis.gaze.event_type,
            'gaze',
            analysis.gaze,
            meta
          )
        );
      }

      const risk = await aiClient
        .getRiskScore(sessionId)
        .catch(() => events.at(-1)?.risk || null);

      const result = {
        success: true,
        sessionId,
        face: analysis.face,
        gaze: analysis.gaze,
        events,
        risk,
        timestamp: new Date().toISOString(),
      };

      socket.emit('proctoring-result', result);
      io.to(sessionId).emit('proctoring-result', result);

      if (events.length > 0) {
        const liveViolation = {
          sessionId,
          examId: meta.examId,
          examTitle: meta.examTitle,
          examCode: meta.examCode,
          instructorId: meta.instructorId,
          studentId: meta.studentId,
          studentName: meta.studentName,
          events,
          risk,
          face: analysis.face,
          gaze: analysis.gaze,
          timestamp: result.timestamp,
        };

        io.emit('proctoring-dashboard-event', liveViolation);
        io.to('dashboard').emit('proctoring-live-violation', liveViolation);

        if (meta.instructorId) {
          io.to(`instructor:${meta.instructorId}`).emit(
            'proctoring-live-violation',
            liveViolation
          );
        }
      }

      if (callback) callback(result);
    } catch (err) {
      console.error('[Socket] Frame analiz hatasi:', err.message);

      const errorResponse = {
        success: false,
        message: err.message || 'Frame analiz hatasi.',
      };

      if (callback) callback(errorResponse);
      socket.emit('proctoring-error', errorResponse);
    }
  });

  socket.on('proctoring-event', async (data = {}, callback) => {
    try {
      const sessionId = data.sessionId || data.session_id;
      const eventType = normalizeEventType(data.eventType || data.event_type);
      const source = data.source || data.payload?.source || 'system';
      const meta = data.payload || {};

      if (!sessionId || !eventType) {
        const errorResponse = {
          success: false,
          message: 'sessionId ve eventType zorunludur.',
        };

        if (callback) callback(errorResponse);
        socket.emit('proctoring-error', errorResponse);
        return;
      }

      const result = {
        event_type: eventType,
        message: data.message || meta.message || '',
        ...(data.result || meta.result || {}),
      };

      const logged = await recordAnalyzedEvent(
        sessionId,
        eventType,
        source,
        result,
        meta
      );

      socket.emit('proctoring-event-result', logged);
      io.to(sessionId).emit('proctoring-event-result', logged);
      io.emit('proctoring-dashboard-event', logged);
      io.to('dashboard').emit('proctoring-live-violation', logged);

      if (meta.instructorId) {
        io.to(`instructor:${meta.instructorId}`).emit(
          'proctoring-live-violation',
          logged
        );
      }

      if (callback) callback({ success: true, ...logged });
    } catch (err) {
      console.error('[Socket] Event analiz hatasi:', err.message);

      const errorResponse = {
        success: false,
        message: err.message || 'Event analiz hatasi.',
      };

      if (callback) callback(errorResponse);
      socket.emit('proctoring-error', errorResponse);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client ayrildi:', socket.id);
  });
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Proctoring service hatasi.',
  });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Proctoring Service MongoDB baglantisi basarili.');
  })
  .catch((error) => {
    console.warn('Proctoring Service MongoDB baglantisi basarisiz:', error.message);
    console.warn('Servis memory fallback ile calismaya devam edecek.');
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`Proctoring Service running on port ${PORT}`);
    });
  });

module.exports = { app, server };
