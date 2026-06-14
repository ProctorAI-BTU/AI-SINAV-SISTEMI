import React, { useRef, useState } from "react";
import "../styles/preExamCheck.css";
import proctoringService from "../services/proctoring.js";

export default function PreExamCheck({ onComplete, examTitle }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [checks, setChecks] = useState({
    camera: "waiting",
    microphone: "waiting",
    fullscreen: "waiting",
    network: "waiting",
    face: "waiting",
  });

  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");

  const getStatusText = (status) => {
    if (status === "success") return "Başarılı";
    if (status === "failed") return "Başarısız";
    return "Bekleniyor";
  };

  const allChecksPassed = Object.values(checks).every(
    (status) => status === "success"
  );

  const stopPreviewStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;

    if (!video || video.readyState < 2) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  };

  const startChecks = async () => {
    setIsChecking(true);
    setMessage("");

    let cameraStatus = "failed";
    let microphoneStatus = "failed";
    let fullscreenStatus = "failed";
    let networkStatus = navigator.onLine ? "success" : "failed";
    let faceStatus = "failed";

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
        await videoRef.current.play();
      }

      cameraStatus = stream.getVideoTracks().length > 0 ? "success" : "failed";
      microphoneStatus =
        stream.getAudioTracks().length > 0 ? "success" : "failed";

      setChecks((prev) => ({
        ...prev,
        camera: cameraStatus,
        microphone: microphoneStatus,
        network: networkStatus,
      }));

      await new Promise((resolve) => setTimeout(resolve, 700));

      const frame = captureFrame();

      if (!frame) {
        faceStatus = "failed";
        setMessage("Kamera görüntüsü alınamadı. Kameraya bakıp tekrar deneyin.");
      } else {
        const faceResult = await proctoringService.precheckFace(frame);

        console.log("[PreExamCheck] Face result:", faceResult);

        if (faceResult?.face_detected === true || faceResult?.face?.face_detected === true) {
          faceStatus = "success";
          setMessage("Yüz algılandı. Sınava geçebilirsiniz.");
        } else {
          faceStatus = "failed";
          setMessage("Yüz algılanmadı. Lütfen kameraya net görünecek şekilde tekrar deneyin.");
        }
      }
    } catch (error) {
      console.error("[PreExamCheck] Kamera/mikrofon hatası:", error);
      cameraStatus = "failed";
      microphoneStatus = "failed";
      faceStatus = "failed";
      setMessage("Kamera veya mikrofon izni alınamadı.");
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
      face: faceStatus,
    });

    setIsChecking(false);
  };

  const handleComplete = () => {
    stopPreviewStream();
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
      <div className="pre-check-card">
        <h1 className="pre-check-title">Sınav Öncesi Kontroller</h1>

        {examTitle && (
          <p className="pre-check-exam-name">
            Sınav: <strong>{examTitle}</strong>
          </p>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "320px",
            height: "240px",
            objectFit: "cover",
            borderRadius: "12px",
            border: "2px solid rgba(255,255,255,0.25)",
            transform: "scaleX(-1)",
            background: "#000",
            margin: "16px auto",
            display: "block",
          }}
        />

        {message && (
          <p style={{ textAlign: "center", marginBottom: "16px" }}>
            {message}
          </p>
        )}

        <div className="pre-check-list">
          {renderCheckItem("Kamera İzni", checks.camera)}
          {renderCheckItem("Mikrofon İzni", checks.microphone)}
          {renderCheckItem("Tam Ekran Zorunluluğu", checks.fullscreen)}
          {renderCheckItem("Ağ Bağlantısı", checks.network)}
          {renderCheckItem("Yüz Algılama", checks.face)}
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
            onClick={handleComplete}
            disabled={!allChecksPassed}
          >
            Sınava Geç
          </button>
        </div>
      </div>
    </div>
  );
}