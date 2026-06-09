const fetch = require('node-fetch');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://face-detection:8091';
const EYE_SERVICE_URL = process.env.EYE_SERVICE_URL || 'http://eye-tracking:8092';
const AUDIO_SERVICE_URL = process.env.AUDIO_SERVICE_URL || 'http://audio-analysis:8093';
const RISK_SERVICE_URL = process.env.RISK_SERVICE_URL || 'http://risk-scoring:8094';
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 10000);

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

async function postJson(baseUrl, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(data.message || `AI service request failed: ${path}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(baseUrl, path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      method: 'GET',
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(data.message || `AI service request failed: ${path}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRiskResponse(response) {
  if (!response) return null;
  return response.data || response;
}

async function detectFace(sessionId, imageBase64) {
  return postJson(FACE_SERVICE_URL, '/detect', {
    session_id: sessionId,
    image_base64: imageBase64,
  });
}

async function trackGaze(sessionId, imageBase64) {
  return postJson(EYE_SERVICE_URL, '/track', {
    session_id: sessionId,
    image_base64: imageBase64,
  });
}

async function analyzeAudio(sessionId, audioBase64, sampleRate = 16000) {
  return postJson(AUDIO_SERVICE_URL, '/analyze', {
    session_id: sessionId,
    audio_base64: audioBase64,
    sample_rate: sampleRate,
  });
}

async function analyzeRisk(sessionId, eventType, payload = {}) {
  const response = await postJson(RISK_SERVICE_URL, '/analyze', {
    session_id: sessionId,
    event_type: String(eventType || '').toUpperCase(),
    payload,
  });

  return normalizeRiskResponse(response);
}

async function getRiskScore(sessionId) {
  return getJson(RISK_SERVICE_URL, `/score/${encodeURIComponent(sessionId)}`);
}

async function analyzeFrame(sessionId, imageBase64) {
  const [face, gaze] = await Promise.all([
    detectFace(sessionId, imageBase64),
    trackGaze(sessionId, imageBase64),
  ]);

  return { face, gaze };
}

module.exports = {
  analyzeAudio,
  analyzeFrame,
  analyzeRisk,
  detectFace,
  getRiskScore,
  trackGaze,
};
