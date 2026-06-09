import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_PROCTORING_SOCKET_URL || "http://localhost:3004";

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[Proctoring Socket] Baglandi:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[Proctoring Socket] Baglanti koptu");
    });

    socket.on("proctoring-error", (error) => {
      console.warn("[Proctoring Socket] Hata:", error);
    });
  }

  return socket;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = new Error(`Request failed: ${url}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

const proctoringService = {
  async startSession(session) {
    try {
      return await postJson('/api/proctoring/sessions', session);
    } catch (err) {
      console.warn('[Proctoring] Session kaydi yapilamadi:', err.message);
      return null;
    }
  },

  async completeSession(sessionId, data = {}) {
    try {
      return await postJson(`/api/proctoring/sessions/${sessionId}/complete`, data);
    } catch (err) {
      console.warn('[Proctoring] Session tamamlama kaydi yapilamadi:', err.message);
      return null;
    }
  },

  async logEvent(sessionId, eventType, payload = {}) {
    try {
      return await postJson('/api/proctoring/events', {
        sessionId,
        eventType,
        source: payload.source || 'system',
        message: payload.message || '',
        payload,
        riskScore: payload.riskScore,
        riskLevel: payload.riskLevel,
        examId: payload.examId,
        examTitle: payload.examTitle,
        examCode: payload.examCode,
        instructorId: payload.instructorId,
        studentId: payload.studentId,
        studentName: payload.studentName,
      });
    } catch (err) {
      console.warn('[Proctoring] Event kaydi yapilamadi:', err.message);
      return null;
    }
  },

  async detectFace(sessionId, imageBase64) {
    try {
      const response = await this.analyzeFrame(sessionId, imageBase64);
      return response?.face || null;
    } catch (err) {
      console.warn('[Proctoring] Face detection erisilemedi:', err.message);
      return null;
    }
  },

  async trackGaze(sessionId, imageBase64) {
    try {
      const response = await this.analyzeFrame(sessionId, imageBase64);
      return response?.gaze || null;
    } catch (err) {
      console.warn('[Proctoring] Eye tracking erisilemedi:', err.message);
      return null;
    }
  },

  async analyzeFrame(sessionId, imageBase64, payload = {}) {
    try {
      return await postJson('/api/proctoring/analyze/frame', {
        sessionId,
        imageBase64,
        payload,
      });
    } catch (err) {
      console.warn('[Proctoring] Frame analizi erisilemedi:', err.message);
      return null;
    }
  },

  async precheckFace(imageBase64, sessionId = `precheck_${Date.now()}`) {
    try {
      return await postJson('/api/proctoring/precheck/face', {
        sessionId,
        imageBase64,
      });
    } catch (err) {
      console.warn('[Proctoring] On kontrol yuz analizi erisilemedi:', err.message);
      return null;
    }
  },

  async analyzeAudio(sessionId, audioBase64, sampleRate = 16000, payload = {}) {
    try {
      return await postJson('/api/proctoring/analyze/audio', {
        sessionId,
        audioBase64,
        sampleRate,
        payload,
      });
    } catch (err) {
      console.warn('[Proctoring] Audio analysis erisilemedi:', err.message);
      return null;
    }
  },

  async sendEvent(sessionId, eventType, payload = {}) {
    const normalizedEvent = String(eventType || '').toUpperCase();

    try {
      const response = await postJson('/api/proctoring/analyze/event', {
        sessionId,
        eventType: normalizedEvent,
        source: payload.source || 'system',
        message: payload.message || '',
        payload,
      });
      return response?.risk || null;
    } catch (err) {
      console.warn('[Proctoring] Event analizi kaydedilemedi:', err.message);
      return null;
    }
  },

  async getRiskScore(sessionId) {
    try {
      const res = await fetch(`/api/proctoring/risk/${sessionId}`);
      if (!res.ok) throw new Error('Risk score getirme hatasi');
      const data = await res.json();
      return data.risk || data;
    } catch (err) {
      console.warn('[Proctoring] Risk score erisilemedi:', err.message);
      return { risk_score: 0, risk_level: 'LOW', reasons: [], event_counts: {} };
    }
  },

  async checkHealth() {
    const services = [
      { name: 'proctoring', url: '/api/proctoring/health' },
    ];

    const results = await Promise.allSettled(
      services.map(async (svc) => {
        const res = await fetch(svc.url);
        const data = await res.json();
        return { ...svc, status: data.status, online: true };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return { ...services[index], status: 'offline', online: false };
    });
  },

    connectSocket(sessionId) {
    const activeSocket = getSocket();

    if (sessionId) {
      activeSocket.emit("join-session", sessionId);
    }

    return activeSocket;
  },

  disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  analyzeFrameSocket(sessionId, imageBase64, payload = {}) {
    const activeSocket = getSocket();

    return new Promise((resolve, reject) => {
      activeSocket.emit(
        "proctoring-frame",
        {
          sessionId,
          imageBase64,
          payload,
        },
        (response) => {
          if (!response?.success) {
            reject(new Error(response?.message || "Socket frame analizi basarisiz."));
            return;
          }

          resolve(response);
        }
      );
    });
  },

  sendEventSocket(sessionId, eventType, payload = {}) {
    const activeSocket = getSocket();

    return new Promise((resolve, reject) => {
      activeSocket.emit(
        "proctoring-event",
        {
          sessionId,
          eventType,
          source: payload.source || "system",
          message: payload.message || "",
          payload,
        },
        (response) => {
          if (!response?.success) {
            reject(new Error(response?.message || "Socket event analizi basarisiz."));
            return;
          }

          resolve(response);
        }
      );
    });
  },
};

export default proctoringService;
