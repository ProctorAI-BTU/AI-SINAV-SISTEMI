/**
 * ProctorSDK — Embeddable Proctoring Widget
 * Version: 1.0.0
 *
 * Kullanım:
 *   <script src="https://yourplatform.com/sdk/proctoring-widget.js"></script>
 *   <script>
 *     ProctorSDK.init({
 *       apiKey: 'pk_live_xxxx',
 *       examId: 'EXAM-001',
 *       studentId: 'STU-123',
 *       gatewayUrl: 'https://yourplatform.com',
 *       onReady: () => console.log('Hazır'),
 *       onComplete: (report) => console.log('Bitti', report),
 *       onViolation: (event) => console.log('İhlal', event),
 *       onError: (err) => console.error('Hata', err),
 *       options: {
 *         showOverlay: true,       // Risk skoru overlay'i
 *         allowFullscreen: true,   // Tam ekran zorlaması
 *         primaryColor: '#6366f1', // Tema rengi
 *         logoUrl: null,           // Kurum logosu URL'i
 *         language: 'tr',          // 'tr' | 'en'
 *         containerId: 'proctor-container', // Widget'ın gömüleceği div
 *       }
 *     });
 *   </script>
 */

(function (global) {
  'use strict';

  // ============================================================
  // Sabitler & i18n
  // ============================================================

  const VERSION = '1.0.0';

  const I18N = {
    tr: {
      preparing: 'Sistem hazırlanıyor...',
      cameraAccess: 'Kamera ve Mikrofon İzni',
      cameraDesc: 'Sınav gözetimi için kamera ve mikrofonunuza erişim gereklidir.',
      allowBtn: 'İzin Ver',
      riskScore: 'Risk Skoru',
      examActive: 'Sınav Aktif',
      violation: 'İhlal Tespit Edildi',
      examComplete: 'Sınav Tamamlandı',
      connecting: 'Bağlanıyor...',
      connected: 'Bağlandı ✓',
      faceOk: 'Yüz Algılandı ✓',
      faceWarning: 'Yüz Uyarısı',
      gazeWarning: 'Bakış Uyarısı',
      audioWarning: 'Ses Uyarısı',
      endExam: 'Sınavı Bitir',
      low: 'DÜŞÜK',
      medium: 'ORTA',
      high: 'YÜKSEK',
      critical: 'KRİTİK',
    },
    en: {
      preparing: 'Preparing system...',
      cameraAccess: 'Camera & Microphone Access',
      cameraDesc: 'Camera and microphone access is required for exam proctoring.',
      allowBtn: 'Allow Access',
      riskScore: 'Risk Score',
      examActive: 'Exam Active',
      violation: 'Violation Detected',
      examComplete: 'Exam Completed',
      connecting: 'Connecting...',
      connected: 'Connected ✓',
      faceOk: 'Face Detected ✓',
      faceWarning: 'Face Warning',
      gazeWarning: 'Gaze Warning',
      audioWarning: 'Audio Warning',
      endExam: 'End Exam',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    },
  };

  // ============================================================
  // Yardımcı Fonksiyonlar
  // ============================================================

  function el(tag, attrs = {}, ...children) {
    const elem = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'style' && typeof val === 'object') {
        Object.assign(elem.style, val);
      } else {
        elem.setAttribute(key, val);
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        elem.appendChild(document.createTextNode(child));
      } else if (child) {
        elem.appendChild(child);
      }
    }
    return elem;
  }

  function injectStyles(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ============================================================
  // Widget CSS
  // ============================================================

  function buildCSS(primaryColor) {
    return `
      .proctor-sdk-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
        background: #0f0f1a;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(99, 102, 241, 0.3);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        max-width: 480px;
        min-height: 320px;
        color: #e2e8f0;
      }

      .proctor-sdk-permission {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 32px;
        text-align: center;
        min-height: 320px;
      }

      .proctor-sdk-permission-icon {
        font-size: 48px;
        margin-bottom: 20px;
        animation: proctor-pulse 2s infinite;
      }

      .proctor-sdk-permission h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #f1f5f9;
      }

      .proctor-sdk-permission p {
        font-size: 14px;
        color: #94a3b8;
        margin: 0 0 28px;
        line-height: 1.6;
      }

      .proctor-sdk-btn {
        background: ${primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 28px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        letter-spacing: 0.3px;
      }

      .proctor-sdk-btn:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(99,102,241,0.4);
      }

      .proctor-sdk-btn:active { transform: translateY(0); }

      .proctor-sdk-video-container {
        position: relative;
        background: #000;
      }

      .proctor-sdk-video {
        width: 100%;
        display: block;
        border-radius: 0;
      }

      .proctor-sdk-overlay {
        position: absolute;
        top: 0; left: 0; right: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%);
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .proctor-sdk-status-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #22c55e;
        animation: proctor-blink 1.5s infinite;
        margin-right: 8px;
        flex-shrink: 0;
      }

      .proctor-sdk-status-text {
        font-size: 12px;
        font-weight: 600;
        color: #f8fafc;
        display: flex;
        align-items: center;
      }

      .proctor-sdk-risk-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 20px;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.15);
        letter-spacing: 0.5px;
      }

      .proctor-sdk-risk-low    { color: #4ade80; border-color: #4ade80; }
      .proctor-sdk-risk-medium { color: #facc15; border-color: #facc15; }
      .proctor-sdk-risk-high   { color: #f97316; border-color: #f97316; }
      .proctor-sdk-risk-critical { color: #f43f5e; border-color: #f43f5e; animation: proctor-pulse-red 1s infinite; }

      .proctor-sdk-stats {
        padding: 14px 16px;
        background: rgba(15,15,26,0.9);
        border-top: 1px solid rgba(99,102,241,0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .proctor-sdk-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .proctor-sdk-stat-value {
        font-size: 20px;
        font-weight: 700;
        color: #f1f5f9;
      }

      .proctor-sdk-stat-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #64748b;
      }

      .proctor-sdk-gauge {
        flex: 1;
        max-width: 120px;
      }

      .proctor-sdk-gauge-bar {
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 4px;
      }

      .proctor-sdk-gauge-fill {
        height: 100%;
        border-radius: 2px;
        background: ${primaryColor};
        transition: width 0.5s ease, background 0.3s ease;
      }

      .proctor-sdk-alert-bar {
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: proctor-slidein 0.3s ease;
      }

      .proctor-sdk-alert-face    { background: rgba(239,68,68,0.2); color: #fca5a5; border-left: 3px solid #ef4444; }
      .proctor-sdk-alert-gaze    { background: rgba(249,115,22,0.2); color: #fdba74; border-left: 3px solid #f97316; }
      .proctor-sdk-alert-audio   { background: rgba(234,179,8,0.2); color: #fde047; border-left: 3px solid #eab308; }

      .proctor-sdk-end-btn {
        background: rgba(239,68,68,0.15);
        border: 1px solid rgba(239,68,68,0.4);
        color: #fca5a5;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .proctor-sdk-end-btn:hover {
        background: rgba(239,68,68,0.3);
        border-color: rgba(239,68,68,0.7);
      }

      .proctor-sdk-complete {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 32px;
        text-align: center;
        min-height: 200px;
      }

      .proctor-sdk-complete-icon { font-size: 48px; margin-bottom: 16px; }
      .proctor-sdk-complete h3 { font-size: 20px; font-weight: 700; margin: 0 0 8px; color: #4ade80; }
      .proctor-sdk-complete p { font-size: 14px; color: #94a3b8; margin: 0; }

      @keyframes proctor-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }

      @keyframes proctor-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      @keyframes proctor-pulse-red {
        0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.4); }
        50% { box-shadow: 0 0 0 6px rgba(244,63,94,0); }
      }

      @keyframes proctor-slidein {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
  }

  // ============================================================
  // Ana SDK Sınıfı
  // ============================================================

  class ProctorWidget {
    constructor(config) {
      this.config = {
        apiKey: config.apiKey,
        examId: config.examId,
        studentId: config.studentId,
        studentName: config.studentName || '',
        gatewayUrl: (config.gatewayUrl || '').replace(/\/$/, ''),
        onReady: config.onReady || null,
        onComplete: config.onComplete || null,
        onViolation: config.onViolation || null,
        onError: config.onError || null,
        options: {
          showOverlay: config.options?.showOverlay !== false,
          allowFullscreen: config.options?.allowFullscreen !== false,
          primaryColor: config.options?.primaryColor || '#6366f1',
          logoUrl: config.options?.logoUrl || null,
          language: config.options?.language || 'tr',
          containerId: config.options?.containerId || 'proctor-container',
          frameIntervalMs: config.options?.frameIntervalMs || 3000,
          audioIntervalMs: config.options?.audioIntervalMs || 5000,
        },
      };

      this.t = I18N[this.config.options.language] || I18N.tr;
      this.sessionId = null;
      this.stream = null;
      this.videoEl = null;
      this.socket = null;
      this.frameTimer = null;
      this.audioTimer = null;
      this.riskScore = 0;
      this.riskLevel = 'LOW';
      this.violationCount = 0;
      this.isRunning = false;
      this.container = null;
      this.alertBarEl = null;
      this.riskBadgeEl = null;
      this.riskFillEl = null;
      this.riskValueEl = null;
      this.violationEl = null;
    }

    async init() {
      injectStyles(buildCSS(this.config.options.primaryColor));
      this._buildContainer();
      this._showPermissionScreen();
    }

    _buildContainer() {
      let target = document.getElementById(this.config.options.containerId);
      if (!target) {
        target = document.body;
      }

      this.container = el('div', { class: 'proctor-sdk-widget', id: 'proctor-sdk-root' });
      target.appendChild(this.container);
    }

    _showPermissionScreen() {
      this.container.innerHTML = '';
      const permDiv = el(
        'div',
        { class: 'proctor-sdk-permission' },
        el('div', { class: 'proctor-sdk-permission-icon' }, '📷'),
        el('h3', {}, this.t.cameraAccess),
        el('p', {}, this.t.cameraDesc)
      );

      const btn = el('button', { class: 'proctor-sdk-btn' }, this.t.allowBtn);
      btn.addEventListener('click', () => this._requestPermissions());
      permDiv.appendChild(btn);

      if (this.config.options.logoUrl) {
        const logo = el('img', {
          src: this.config.options.logoUrl,
          style: { maxHeight: '40px', marginBottom: '20px', borderRadius: '6px' },
        });
        permDiv.insertBefore(logo, permDiv.firstChild);
      }

      this.container.appendChild(permDiv);
    }

    async _requestPermissions() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true,
        });
        await this._startSession();
      } catch (err) {
        this._onError(`Kamera/Mikrofon erişim hatası: ${err.message}`);
      }
    }

    async _startSession() {
      try {
        // Proctoring session oluştur
        const resp = await fetch(`${this.config.gatewayUrl}/api/proctoring/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          body: JSON.stringify({
            examId: this.config.examId,
            studentId: this.config.studentId,
            studentName: this.config.studentName,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${resp.status}`);
        }

        const { session } = await resp.json();
        this.sessionId = session.sessionId;
        this.isRunning = true;

        this._buildActiveScreen();
        this._connectSocket();
        this._startFrameCapture();
        this._startAudioCapture();

        if (this.config.onReady) this.config.onReady({ sessionId: this.sessionId });
      } catch (err) {
        this._onError(`Oturum başlatma hatası: ${err.message}`);
      }
    }

    _buildActiveScreen() {
      this.container.innerHTML = '';

      // Video
      const videoContainer = el('div', { class: 'proctor-sdk-video-container' });
      this.videoEl = el('video', {
        class: 'proctor-sdk-video',
        autoplay: '',
        muted: '',
        playsinline: '',
      });
      this.videoEl.srcObject = this.stream;
      videoContainer.appendChild(this.videoEl);

      // Overlay
      if (this.config.options.showOverlay) {
        const overlay = el('div', { class: 'proctor-sdk-overlay' });

        const statusText = el('div', { class: 'proctor-sdk-status-text' });
        const dot = el('div', { class: 'proctor-sdk-status-dot' });
        statusText.appendChild(dot);
        statusText.appendChild(document.createTextNode(this.t.examActive));

        this.riskBadgeEl = el('span', { class: 'proctor-sdk-risk-badge proctor-sdk-risk-low' });
        this.riskBadgeEl.textContent = `${this.t.riskScore}: 0 — ${this.t.low}`;

        overlay.appendChild(statusText);
        overlay.appendChild(this.riskBadgeEl);
        videoContainer.appendChild(overlay);
      }

      this.container.appendChild(videoContainer);

      // Alert bar
      this.alertBarEl = el('div', {});
      this.container.appendChild(this.alertBarEl);

      // Stats bar
      const stats = el('div', { class: 'proctor-sdk-stats' });

      this.riskValueEl = el('div', { class: 'proctor-sdk-stat-value' }, '0');
      const riskStat = el(
        'div',
        { class: 'proctor-sdk-stat' },
        this.riskValueEl,
        el('div', { class: 'proctor-sdk-stat-label' }, this.t.riskScore)
      );

      this.violationEl = el('div', { class: 'proctor-sdk-stat-value' }, '0');
      const violStat = el(
        'div',
        { class: 'proctor-sdk-stat' },
        this.violationEl,
        el('div', { class: 'proctor-sdk-stat-label' }, 'İhlal')
      );

      // Gauge bar
      const gaugeContainer = el('div', { class: 'proctor-sdk-gauge' });
      const gaugeBar = el('div', { class: 'proctor-sdk-gauge-bar' });
      this.riskFillEl = el('div', { class: 'proctor-sdk-gauge-fill', style: { width: '0%' } });
      gaugeBar.appendChild(this.riskFillEl);
      gaugeContainer.appendChild(gaugeBar);

      // Sınavı Bitir butonu
      const endBtn = el('button', { class: 'proctor-sdk-end-btn' }, this.t.endExam);
      endBtn.addEventListener('click', () => this._endExam());

      stats.appendChild(riskStat);
      stats.appendChild(violStat);
      stats.appendChild(gaugeContainer);
      stats.appendChild(endBtn);

      this.container.appendChild(stats);
    }

    _connectSocket() {
      if (!window.io) {
        console.warn('[ProctorSDK] Socket.io bulunamadı. Script olarak ekleyin.');
        return;
      }
      this.socket = window.io(this.config.gatewayUrl, {
        extraHeaders: { 'X-API-Key': this.config.apiKey },
      });

      this.socket.on('connect', () => {
        this.socket.emit('join-session', this.sessionId);
      });

      this.socket.on('proctoring-result', (data) => {
        if (data.risk) {
          this._updateRisk(data.risk.risk_score, data.risk.risk_level);
        }
        if (data.events && data.events.length > 0) {
          data.events.forEach((e) => this._showAlert(e));
          this.violationCount += data.events.length;
          if (this.violationEl) this.violationEl.textContent = String(this.violationCount);
          if (this.config.onViolation) {
            data.events.forEach((e) => this.config.onViolation(e));
          }
        }
      });
    }

    _startFrameCapture() {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');

      const capture = () => {
        if (!this.isRunning || !this.videoEl) return;
        ctx.drawImage(this.videoEl, 0, 0, 320, 240);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

        if (this.socket && this.socket.connected) {
          this.socket.emit('proctoring-frame', {
            sessionId: this.sessionId,
            imageBase64: base64,
            payload: {
              examId: this.config.examId,
              studentId: this.config.studentId,
            },
          });
        }
      };

      this.frameTimer = setInterval(capture, this.config.options.frameIntervalMs);
    }

    _startAudioCapture() {
      if (!this.stream) return;

      const audioTrack = this.stream.getAudioTracks()[0];
      if (!audioTrack) return;

      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudio = () => {
          if (!this.isRunning) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

          if (avg > 30 && this.socket && this.socket.connected) {
            this.socket.emit('proctoring-event', {
              sessionId: this.sessionId,
              eventType: 'AUDIO_DETECTED',
              source: 'audio',
              payload: { amplitude: avg.toFixed(1), examId: this.config.examId },
            });
          }
        };

        this.audioTimer = setInterval(checkAudio, this.config.options.audioIntervalMs);
      } catch (e) {
        console.warn('[ProctorSDK] Audio analiz başlatılamadı:', e.message);
      }
    }

    _updateRisk(score, level) {
      this.riskScore = score;
      this.riskLevel = level;

      const levelKey = (level || 'LOW').toLowerCase();
      const label = this.t[levelKey] || level;

      if (this.riskBadgeEl) {
        this.riskBadgeEl.className = `proctor-sdk-risk-badge proctor-sdk-risk-${levelKey}`;
        this.riskBadgeEl.textContent = `${this.t.riskScore}: ${score} — ${label}`;
      }
      if (this.riskValueEl) this.riskValueEl.textContent = String(score);
      if (this.riskFillEl) {
        this.riskFillEl.style.width = `${Math.min(score, 100)}%`;
        const colors = { low: '#4ade80', medium: '#facc15', high: '#f97316', critical: '#f43f5e' };
        this.riskFillEl.style.background = colors[levelKey] || '#6366f1';
      }
    }

    _showAlert(event) {
      if (!this.alertBarEl) return;

      const typeMap = {
        face: ['proctor-sdk-alert-face', '👤'],
        gaze: ['proctor-sdk-alert-gaze', '👁️'],
        audio: ['proctor-sdk-alert-audio', '🔊'],
      };
      const source = (event.event?.source || event.source || 'face').toLowerCase();
      const [cls, icon] = typeMap[source] || typeMap.face;
      const msg = event.event?.message || event.message || event.eventType || 'İhlal';

      const alert = el('div', { class: `proctor-sdk-alert-bar ${cls}` });
      alert.textContent = `${icon} ${msg}`;

      this.alertBarEl.innerHTML = '';
      this.alertBarEl.appendChild(alert);
      setTimeout(() => { if (this.alertBarEl) this.alertBarEl.innerHTML = ''; }, 5000);
    }

    async _endExam() {
      if (!this.isRunning) return;
      this.isRunning = false;
      clearInterval(this.frameTimer);
      clearInterval(this.audioTimer);

      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
      }

      if (this.socket) this.socket.disconnect();

      let report = null;
      try {
        const resp = await fetch(
          `${this.config.gatewayUrl}/api/proctoring/sessions/${this.sessionId}/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.config.apiKey,
            },
            body: JSON.stringify({ completedBy: 'student' }),
          }
        );
        const data = await resp.json();
        report = data.session;
      } catch (err) {
        console.warn('[ProctorSDK] complete session hatası:', err.message);
      }

      this._showCompleteScreen(report);
      if (this.config.onComplete) this.config.onComplete(report || { sessionId: this.sessionId });
    }

    _showCompleteScreen(report) {
      if (!this.container) return;
      this.container.innerHTML = '';

      const finalRisk = report?.riskScore ?? this.riskScore;
      const finalLevel = (report?.riskLevel || this.riskLevel || 'LOW').toLowerCase();
      const colors = { low: '#4ade80', medium: '#facc15', high: '#f97316', critical: '#f43f5e' };

      const div = el(
        'div',
        { class: 'proctor-sdk-complete' },
        el('div', { class: 'proctor-sdk-complete-icon' }, '✅'),
        el('h3', {}, this.t.examComplete),
        el(
          'p',
          {},
          `${this.t.riskScore}: ${finalRisk} | ${this.violationCount} ihlal`
        )
      );

      div.querySelector('h3').style.color = colors[finalLevel] || '#4ade80';
      this.container.appendChild(div);
    }

    _onError(message) {
      console.error('[ProctorSDK]', message);
      if (this.config.onError) this.config.onError(message);
    }

    destroy() {
      this.isRunning = false;
      clearInterval(this.frameTimer);
      clearInterval(this.audioTimer);
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.socket) this.socket.disconnect();
      if (this.container) this.container.innerHTML = '';
    }
  }

  // ============================================================
  // Global API
  // ============================================================

  let _instance = null;

  const ProctorSDK = {
    version: VERSION,

    /**
     * Widget'ı başlat
     */
    init(config) {
      if (_instance) {
        _instance.destroy();
      }
      _instance = new ProctorWidget(config);
      _instance.init();
      return _instance;
    },

    /**
     * Mevcut widget'ı yok et
     */
    destroy() {
      if (_instance) {
        _instance.destroy();
        _instance = null;
      }
    },

    /**
     * Sınavı programatik olarak bitir
     */
    endExam() {
      if (_instance) {
        _instance._endExam();
      }
    },

    /**
     * Mevcut risk skorunu al
     */
    getRiskScore() {
      return _instance ? { score: _instance.riskScore, level: _instance.riskLevel } : null;
    },
  };

  // Modül sistemi ve global export desteği
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProctorSDK;
  } else {
    global.ProctorSDK = ProctorSDK;
  }
})(typeof window !== 'undefined' ? window : global);
