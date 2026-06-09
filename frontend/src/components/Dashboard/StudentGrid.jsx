import React from "react";
import RiskBadge from "./RiskBadge";

function normalizeRiskLevel(level, score = 0) {
  const upper = String(level || '').toUpperCase();
  if (upper === 'CRITICAL' || score >= 90) return 'critical';
  if (upper === 'HIGH' || score >= 70) return 'high';
  return 'normal';
}

function statusLabel(session) {
  if (session.status === 'terminated') return 'Sonlandırıldı';
  if (session.status === 'submitted') return 'Tamamlandı';
  if ((session.riskScore || 0) >= 70) return 'Yüksek Risk';
  return 'Normal';
}

export default function StudentGrid({ sessions = [], onNavigate }) {
  const rows = sessions.length ? sessions : [];

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ÖĞRENCİ</th>
            <th>SINAV</th>
            <th>RİSK</th>
            <th>DURUM</th>
            <th>İŞLEM</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="admin-row admin-row--normal">
              <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem" }}>
                Henüz raporlanmış oturum yok.
              </td>
            </tr>
          ) : rows.map((session) => {
            const score = Math.round(session.riskScore || 0);
            const level = normalizeRiskLevel(session.riskLevel, score);
            return (
              <tr
                key={session.sessionId}
                className={level === 'normal' ? 'admin-row admin-row--normal' : 'admin-row admin-row--high'}
              >
                <td className="td-student">{session.studentName || session.studentId || 'Bilinmeyen Öğrenci'}</td>
                <td>{session.examTitle || session.examId || 'Sınav'}</td>
                <td><RiskBadge score={score} level={level} /></td>
                <td>{statusLabel(session)}</td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn action-btn--report" onClick={() => onNavigate("report", { sessionId: session.sessionId })}>
                      Rapor
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
