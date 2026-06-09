import React from "react";

export default function StatusIndicator({ type, status, detail }) {
  const isActive = status === "active";
  const dotColor = isActive ? "dot--green" : "dot--red";

  const labels = {
    camera: isActive ? "Kamera: Aktif" : "Kamera: Kapalı",
    mic: isActive ? "Mikrofon: Aktif" : "Mikrofon: Kapalı",
    fullscreen: isActive ? "Tam ekran: Açık" : "Tam ekran: Kapalı",
    face: isActive ? "Yüz: Algılandı" : "Yüz: Algılanmadı",
    gaze: detail || (isActive ? "Bakış: Ekranda" : "Bakış: Ekran dışı"),
  };

  const label = labels[type] || detail || type;

  return (
    <div className="status-indicator">
      <div className={`dot ${dotColor}`}></div> {label}
    </div>
  );
}
