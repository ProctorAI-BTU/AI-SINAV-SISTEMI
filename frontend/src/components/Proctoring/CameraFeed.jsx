import React from 'react';

export default function CameraFeed({ videoRef, isProctoringStarted }) {
  return (
    <video
      ref={videoRef}
      style={{
        display: isProctoringStarted ? "block" : "none",
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "240px",
        height: "180px",
        borderRadius: "12px",
        border: "3px solid rgba(255, 255, 255, 0.2)",
        zIndex: 1000,
        transform: "scaleX(-1)", // ayna efekti
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        objectFit: "cover"
      }}
      autoPlay
      muted
      playsInline
    />
  );
}
