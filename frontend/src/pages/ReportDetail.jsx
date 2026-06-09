import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import reportingService from "../services/reporting.js";
import "../styles/report.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function riskClass(level, score = 0) {
  const upper = String(level || '').toUpperCase();
  if (upper === 'CRITICAL' || score >= 90) return 'risk--high';
  if (upper === 'HIGH' || score >= 70) return 'risk--medium';
  return 'risk--low';
}

export default function ReportPage({ onNavigate, sessionId }) {
  const [reports, setReports] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(sessionId || "");
  const [report, setReport] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [exportLoading, setExportLoading] = useState("");

  useEffect(() => {
    let isMounted = true;
    reportingService.getReports().then((data) => {
      if (!isMounted) return;
      setReports(data);
      if (!selectedSessionId && data[0]?.sessionId) {
        setSelectedSessionId(data[0].sessionId);
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    let isMounted = true;
    reportingService.getReport(selectedSessionId).then((data) => {
      if (isMounted) setReport(data);
    });
    return () => { isMounted = false; };
  }, [selectedSessionId]);

  const handleSearch = () => {
    if (!searchText.trim()) return;
    const q = searchText.toLowerCase();
    const found = reports.filter((r) =>
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.examTitle || "").toLowerCase().includes(q)
    );
    setSearchResults(found);
    setShowResults(true);
  };

  const handleSelect = (sid) => {
    setSelectedSessionId(sid);
    setShowResults(false);
    setSearchText("");
  };

  // JSON olarak dışa aktarma (backend veya client-side)
  const handleExportJson = async () => {
    if (!selectedSessionId || !report) return;
    setExportLoading("json");
    try {
      // Önce backend endpoint'i dene
      const url = `/api/reports/${selectedSessionId}/export.json`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedSessionId}-report.json`;
        link.click();
      } else {
        throw new Error("Backend yanıt vermedi");
      }
    } catch {
      // Fallback: client-side JSON export
      const blob = new Blob([JSON.stringify({ report, eventCounts }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedSessionId}-report.json`;
      link.click();
    } finally {
      setExportLoading("");
    }
  };

  // PDF olarak dışa aktarma (backend endpoint)
  const handleExportPdf = async () => {
    if (!selectedSessionId) return;
    setExportLoading("pdf");
    try {
      const url = `/api/reports/${selectedSessionId}/export.pdf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("PDF oluşturulamadı");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedSessionId}-report.pdf`;
      link.click();
    } catch (err) {
      alert("PDF indirilemedi: " + err.message);
    } finally {
      setExportLoading("");
    }
  };

  // Excel olarak dışa aktarma (backend endpoint)
  const handleExportExcel = async () => {
    if (!selectedSessionId) return;
    setExportLoading("excel");
    try {
      const url = `/api/reports/${selectedSessionId}/export.xlsx`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Excel oluşturulamadı");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedSessionId}-report.xlsx`;
      link.click();
    } catch (err) {
      alert("Excel indirilemedi: " + err.message);
    } finally {
      setExportLoading("");
    }
  };

  const chartData = useMemo(() => {
    const timeline = report?.timeline?.length
      ? report.timeline
      : [{ timestamp: report?.startedAt, riskScore: report?.riskScore || 0 }];
    return {
      labels: timeline.map((item) => formatTime(item.timestamp)),
      datasets: [{
        label: 'Risk Skoru',
        data: timeline.map((item) => item.riskScore || report?.riskScore || 0),
        borderColor: '#4c3cdb',
        backgroundColor: 'rgba(76, 60, 219, 0.2)',
        fill: true,
        tension: 0.4,
      }],
    };
  }, [report]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Zaman Çizelgesi Risk Analizi' }
    },
    scales: { y: { min: 0, max: 100 } }
  };

  const summary = report?.summary || {};
  const eventCounts = report?.eventCounts || {};

  return (
    <div className="report-layout">
      <nav className="report-navbar">
        <div className="report-nav-title">
          <span style={{ background: '#4c3cdb', color: '#fff', padding: '4px 8px', borderRadius: '50%', marginRight: '10px', fontSize: '0.8rem' }}>AI</span>
          Risk Raporu
        </div>
        <button className="report-btn report-btn--view" onClick={() => onNavigate("admin-dashboard")}>
          Geri Dön
        </button>
      </nav>

      <main className="report-main">
        <div className="report-card">
          <div className="report-header-section">
            <h1 className="report-title">Risk Raporu - Oturum #{report?.sessionId || selectedSessionId || "Yok"}</h1>
            <div className="report-meta-row">
              <span>Öğrenci: <span className="report-meta-value">{report?.studentName || "Bilinmeyen"}</span></span>
              <span>Sınav: <span className="report-meta-value">{report?.examTitle || "Sınav"}</span></span>
            </div>
            <div className="report-risk-row">
              Genel Risk Skoru:
              <span className={`report-risk-badge ${riskClass(report?.riskLevel, report?.riskScore)}`}>
                {Math.round(report?.riskScore || 0)}
              </span>
              <span className="report-risk-label">({report?.riskLabel || report?.riskLevel || "Düşük"} Risk)</span>
            </div>
          </div>

          {reports.length > 1 && (
            <div className="report-section">
              <div className="report-search-row">
                <input
                  className="report-search-input"
                  type="text"
                  placeholder="Öğrenci adı veya sınav adı ara..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button className="report-search-btn" onClick={handleSearch}>Ara</button>
              </div>
              {showResults && (
                <div className="report-search-results">
                  {searchResults.length === 0 ? (
                    <div className="report-search-empty">Sonuç bulunamadı.</div>
                  ) : (
                    searchResults.map((item) => (
                      <div
                        key={item.sessionId}
                        className="report-search-item"
                        onClick={() => handleSelect(item.sessionId)}
                      >
                        <span className="report-search-name">{item.studentName || "Öğrenci"}</span>
                        <span className="report-search-exam">{item.examTitle || "Sınav"}</span>
                        <span className={`report-risk-badge ${riskClass(item.riskLevel, item.riskScore)}`} style={{ fontSize: 12, padding: '2px 8px' }}>
                          {Math.round(item.riskScore || 0)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <hr className="report-divider" />

          <div className="report-section">
            <h3 className="report-section-title">İhlal Özeti</h3>
            <div className="violation-list" style={{ background: '#fafafa', padding: '1rem', borderRadius: '8px' }}>
              <div className="violation-row"><span>Yüz algılanmadı:</span><span className="violation-count">{summary.face || 0}</span></div>
              <div className="violation-row"><span>Birden fazla yüz:</span><span className="violation-count">{summary.multipleFace || 0}</span></div>
              <div className="violation-row"><span>Bakış kaybı:</span><span className="violation-count">{summary.gaze || 0}</span></div>
              <div className="violation-row"><span>Şüpheli ses:</span><span className="violation-count">{summary.audio || 0}</span></div>
              <div className="violation-row"><span>Telefon / nesne:</span><span className="violation-count">{summary.objects || 0}</span></div>
              <div className="violation-row"><span>Sekme değişimi:</span><span className="violation-count">{summary.tab || 0}</span></div>
              <div className="violation-row"><span>Tam ekran ihlali:</span><span className="violation-count">{summary.fullscreen || 0}</span></div>
            </div>
          </div>

          <hr className="report-divider" />

          <div className="report-section">
            <h3 className="report-section-title">Risk Skoru Grafiği</h3>
            <div style={{ height: '300px', width: '100%', marginBottom: '2rem' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          <hr className="report-divider" />

          <div className="report-section">
            <h3 className="report-section-title">Zaman Çizelgesi</h3>
            <div className="timeline-list">
              {report?.timeline?.length ? report.timeline.map((event) => (
                <div key={event.id || `${event.eventType}-${event.timestamp}`} className="timeline-item timeline-item--tab">
                  <span className="timeline-time">{formatTime(event.timestamp)}</span>
                  <span className="timeline-event">{event.label || event.eventType}{event.message ? ` - ${event.message}` : ""}</span>
                </div>
              )) : (
                <div className="timeline-item timeline-item--gaze">
                  <span className="timeline-time">-</span>
                  <span className="timeline-event">Bu oturumda event kaydı yok.</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Dışa Aktarma Butonları (PDF, Excel, JSON) ─── */}
          <div className="report-actions">
            <button
              className="report-btn report-btn--json"
              onClick={handleExportJson}
              disabled={!!exportLoading || !report}
              title="JSON olarak indir"
            >
              {exportLoading === "json" ? "İndiriliyor..." : "📄 JSON"}
            </button>

            <button
              className="report-btn report-btn--pdf"
              onClick={handleExportPdf}
              disabled={!!exportLoading || !selectedSessionId}
              title="PDF olarak indir (backend gerekli)"
              style={{ backgroundColor: "#c0392b", color: "white" }}
            >
              {exportLoading === "pdf" ? "İndiriliyor..." : "📑 PDF"}
            </button>

            <button
              className="report-btn report-btn--excel"
              onClick={handleExportExcel}
              disabled={!!exportLoading || !selectedSessionId}
              title="Excel (.xlsx) olarak indir (backend gerekli)"
              style={{ backgroundColor: "#27ae60", color: "white" }}
            >
              {exportLoading === "excel" ? "İndiriliyor..." : "📊 Excel"}
            </button>

            <button
              className="report-btn report-btn--view"
              onClick={() => onNavigate("admin-dashboard")}
            >
              Oturumları Göster
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
