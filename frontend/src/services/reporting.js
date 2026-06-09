const fallbackReports = [
  {
    sessionId: 'demo-session',
    studentName: 'Demo Ogrenci',
    examTitle: 'Demo Sinav',
    status: 'submitted',
    riskScore: 0,
    riskLevel: 'LOW',
    riskLabel: 'Dusuk',
    violationCount: 0,
    eventCounts: {},
    summary: {
      face: 0,
      multipleFace: 0,
      gaze: 0,
      audio: 0,
      objects: 0,
      tab: 0,
      fullscreen: 0,
      shortcuts: 0,
    },
    timeline: [],
  },
];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Request failed: ${url}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

const reportingService = {
  async getReports(filters = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });

    try {
      const path = `/api/reports${query.toString() ? `?${query.toString()}` : ''}`;
      const data = await getJson(path);
      return data.reports || [];
    } catch (err) {
      console.warn('[Reporting] Rapor listesi alinamadi:', err.message);
      return fallbackReports;
    }
  },

  async getReport(sessionId) {
    if (!sessionId) return fallbackReports[0];

    try {
      const data = await getJson(`/api/reports/${sessionId}`);
      return data.report;
    } catch (err) {
      console.warn('[Reporting] Rapor detayi alinamadi:', err.message);
      return fallbackReports.find((report) => report.sessionId === sessionId) || fallbackReports[0];
    }
  },
};

export default reportingService;
