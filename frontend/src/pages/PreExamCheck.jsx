import React, { useState, useRef } from "react";
import proctoringService from "../services/proctoring";
import "../styles/preExamCheck.css";

export default function PreExamCheck({ onComplete, examTitle }) {
  const [checks, setChecks] = useState({
    camera: "waiting",
    microphone: "waiting",
    fullscreen: "waiting",
    network: "waiting",
  });

  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    setMessage("");

    let cameraStatus = "failed";
    let microphoneStatus = "failed";
    let fullscreenStatus = "failed";
    let networkStatus = navigator.onLine ? "success" : "failed";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Capture frame from video
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video?.videoWidth || 640;
      canvas.height = video?.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (video) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL("image/jpeg");
      const base64 = dataUrl.split(",")[1];

      // Perform face detection via B2B API
      const res = await proctoringService.precheckFace(base64);
      const faceDetected = Boolean(res && (res.face_detected === true || res.face?.face_detected === true));

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      cameraStatus = (hasVideo && faceDetected) ? "success" : "failed";
      microphoneStatus = hasAudio ? "success" : "failed";

      if (faceDetected) {
        setMessage("Yüz algılandı. Sınava geçebilirsiniz.");
      } else {
        setMessage("Yüz algılanmadı. Lütfen kameraya net görünecek şekilde tekrar deneyin.");
      }
    } catch (error) {
      cameraStatus = "failed";
      microphoneStatus = "failed";
      setMessage("Kamera veya mikrofon izni alınamadı.");
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
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

  const handleComplete = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    onComplete();
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
      <div className="pre-check-shell">
        <div className="pre-check-header">
          <div>
            <h1>Sınav Öncesi Kontroller</h1>
            {examTitle && (
              <p>
                Sınav: <strong>{examTitle}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="pre-check-content">
          <video
            ref={videoRef}
            className="pre-check-video"
            autoPlay
            playsInline
            muted
          />

          <div className="pre-check-panel">
            <div className="pre-check-list">
              {renderCheckItem("Kamera İzni", checks.camera)}
              {renderCheckItem("Mikrofon İzni", checks.microphone)}
              {renderCheckItem("Tam Ekran Zorunluluğu", checks.fullscreen)}
              {renderCheckItem("Ağ Bağlantısı", checks.network)}
            </div>

            {message && <div className="pre-check-message">{message}</div>}

            <div className="pre-check-actions" style={{ marginTop: 20 }}>
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
                onClick={handleComplete}
                disabled={!allChecksPassed}
              >
                Sınava Geç
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
