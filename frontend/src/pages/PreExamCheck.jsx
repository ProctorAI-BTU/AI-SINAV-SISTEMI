import React, { useState } from "react";
import "../styles/preExamCheck.css";

export default function PreExamCheck({ onComplete, examTitle }) {
  const [checks, setChecks] = useState({
    camera: "waiting",
    microphone: "waiting",
    fullscreen: "waiting",
    network: "waiting",
  });

  const [isChecking, setIsChecking] = useState(false);

  const getStatusText = (status) => {
    if (status === "success") return "Başarılı";
    if (status === "failed") return "Başarısız";
    return "Bekleniyor";
  };

  const allChecksPassed = Object.values(checks).every(
    (status) => status === "success"
  );

  const startChecks = async () => {
    setIsChecking(true);

    let cameraStatus = "failed";
    let microphoneStatus = "failed";
    let fullscreenStatus = "failed";
    let networkStatus = navigator.onLine ? "success" : "failed";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      cameraStatus = stream.getVideoTracks().length > 0 ? "success" : "failed";
      microphoneStatus =
        stream.getAudioTracks().length > 0 ? "success" : "failed";
    } catch (error) {
      cameraStatus = "failed";
      microphoneStatus = "failed";
    }

    try {
      await document.documentElement.requestFullscreen();
      fullscreenStatus = document.fullscreenElement ? "success" : "failed";
    } catch (error) {
      fullscreenStatus = "failed";
    }

    setChecks({
      camera: cameraStatus,
      microphone: microphoneStatus,
      fullscreen: fullscreenStatus,
      network: networkStatus,
    });

    setIsChecking(false);
  };

  const renderCheckItem = (label, status) => (
    <div className={`pre-check-item pre-check-item--${status}`}>
      <span className="pre-check-icon">
        {status === "success" ? "✓" : status === "failed" ? "!" : "◌"}
      </span>

      <strong>{label}</strong>

      <span className="pre-check-status">
        Durum: {getStatusText(status)}
      </span>
    </div>
  );

  return (
    <div className="pre-check-page">
      <div className="pre-check-card">
        <h1 className="pre-check-title">Sınav Öncesi Kontroller</h1>
        {examTitle && (
          <p className="pre-check-exam-name">
            Sınav: <strong>{examTitle}</strong>
          </p>
        )}

        <div className="pre-check-list">
          {renderCheckItem("Kamera İzni", checks.camera)}
          {renderCheckItem("Mikrofon İzni", checks.microphone)}
          {renderCheckItem("Tam Ekran Zorunluluğu", checks.fullscreen)}
          {renderCheckItem("Ağ Bağlantısı", checks.network)}
        </div>

        <div className="pre-check-actions">
          <button
            type="button"
            className="pre-check-btn pre-check-btn--outline"
            onClick={startChecks}
            disabled={isChecking}
          >
            {isChecking ? "Kontrol Ediliyor..." : "Kontrolleri Başlat"}
          </button>

          <button
            type="button"
            className="pre-check-btn pre-check-btn--primary"
            onClick={onComplete}
            disabled={!allChecksPassed}
          >
            Sınava Geç
          </button>
        </div>
      </div>
    </div>
  );
}
