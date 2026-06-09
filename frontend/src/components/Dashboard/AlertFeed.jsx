import React from "react";

export default function AlertFeed({ stats = {} }) {
  const activeExams = stats.activeExams ?? 0;
  const activeSessions = stats.activeSessions ?? 0;
  const criticalAlerts = stats.criticalAlerts ?? 0;

  return (
    <div className="stat-cards">
      <div className="stat-card">
        <div className="stat-number">{activeExams}</div>
        <div className="stat-label">Bugünkü Aktif Sınavlar</div>
      </div>
      <div className="stat-card">
        <div className="stat-number">{activeSessions}</div>
        <div className="stat-label">Aktif Oturumlar</div>
      </div>
      <div className="stat-card">
        <div className="stat-number stat-number--danger">{criticalAlerts}</div>
        <div className="stat-label">Kritik Alarm</div>
      </div>
    </div>
  );
}
