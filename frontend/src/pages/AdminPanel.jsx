import { QRCodeSVG } from "qrcode.react";
import React, { useEffect, useMemo, useState } from "react";
import authService from "../services/auth.js";
import reportingService from "../services/reporting.js";
import "../styles/admin.css";

function QRPlaceholder({ value, label }) {
  const qrValue = `${window.location.origin}/?instructorCode=${value}`;
  return (
    <div style={{ textAlign: "center", marginTop: 12 }}>
      <div style={{
        display: "inline-block",
        background: "#fff",
        border: "2px solid #4b35f2",
        borderRadius: 8,
        padding: 12,
      }}>
        <QRCodeSVG value={qrValue} size={140} fgColor="#4b35f2" />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>{label || value}</div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af", fontStyle: "italic", maxWidth: 240, margin: "6px auto 0" }}>
        Sistem sunucuya alındığında bu QR kod telefondan okutulabilecektir.
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR");
}

// ─── Özet Kartı ────────────────────────────────────────────
function StatCard({ icon, value, label, color }) {
  return (
    <div className="admin-stat-card" style={{ borderLeftColor: color }}>
      <div className="admin-stat-icon" style={{ background: color + "18", color }}>
        {icon}
      </div>
      <div className="admin-stat-info">
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function AdminPanel({ onNavigate, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [codes, setCodes] = useState([]);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [instrSearch, setInstrSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Eğitmen oluşturma form state'leri
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSuccessMsg, setCreateSuccessMsg] = useState("");
  const [createErrorMsg, setCreateErrorMsg] = useState("");

  const currentUser = authService.getCurrentUser();

  // Sadece admin erişebilir
  useEffect(() => {
    if (currentUser?.role !== "admin") {
      onNavigate("instructor-dashboard");
    }
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const [instrRes, studRes] = await Promise.all([
        authService.getAllUsers("instructor"),
        authService.getAllUsers("student"),
      ]);
      setInstructors(instrRes.data?.users || []);
      setStudents(studRes.data?.users || []);
    } catch (err) {
      setError(err.message || "Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const loadCodes = async () => {
    try {
      const res = await authService.listInstructorCodes();
      setCodes(res.data?.codes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadReports = async () => {
    try {
      const data = await reportingService.getReports({});
      setReports(data || []);
    } catch (err) {
      console.error("Raporlar yüklenemedi:", err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCodes();
    loadReports();
  }, []);

  // ─── Dashboard İstatistikleri ────────────────────────────
  const stats = useMemo(() => {
    const totalInstructors = instructors.length;
    const totalStudents = students.length;
    const totalReports = reports.length;
    const activeCodes = codes.filter(c => !c.isUsed).length;
    const criticalReports = reports.filter(r => (r.riskScore || 0) >= 70).length;
    const activeExams = new Set(reports.map(r => r.examId || r.examTitle).filter(Boolean)).size;
    return { totalInstructors, totalStudents, totalReports, activeCodes, criticalReports, activeExams };
  }, [instructors, students, reports, codes]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authService.generateInstructorCode();
      setGeneratedCode(res.data?.code?.code);
      setCopied(false);
      await loadCodes();
    } catch (err) {
      setError(err.message || "Kod üretilemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateInstructor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setCreateSuccessMsg("");
    setCreateErrorMsg("");
    try {
      const res = await authService.createUser({
        name: createName,
        email: createEmail,
        password: createPassword,
        role: "instructor"
      });
      if (res.success) {
        setCreateSuccessMsg("Eğitmen başarıyla oluşturuldu!");
        setCreateName("");
        setCreateEmail("");
        setCreatePassword("");
        await loadUsers();
      } else {
        setCreateErrorMsg(res.message || "Eğitmen oluşturulamadı.");
      }
    } catch (err) {
      setCreateErrorMsg(err.message || "Eğitmen oluşturulurken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtreleme ──────────────────────────────────────────
  const filteredInstructors = instructors.filter(i =>
    (i.name || "").toLowerCase().includes(instrSearch.toLowerCase()) ||
    (i.email || "").toLowerCase().includes(instrSearch.toLowerCase())
  );

  const filteredReports = reports.filter(r =>
    (r.studentName || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
    (r.examTitle || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
    (r.sessionId || "").toLowerCase().includes(reportSearch.toLowerCase())
  );

  // ─── Navbar Sekme Tanımları ──────────────────────────────
  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "instructors", label: "Eğitmenler", icon: "👨‍🏫" },
    { key: "reports", label: "Rapor Ara", icon: "🔍" },
    { key: "create", label: "Eğitmen Oluştur", icon: "➕" },
  ];

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">AI</div>
          <span className="navbar-logo-text">Admin Panel</span>
        </div>
        <div className="navbar-links">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`navbar-link${tab === t.key ? " navbar-link--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="navbar-actions">
          <button className="navbar-link" onClick={() => onNavigate("instructor-dashboard")}>Eğitmen Paneli</button>
          <button className="btn-logout" onClick={onLogout}>Çıkış</button>
        </div>
      </nav>

      <main className="dashboard-main">
        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ═══════════════════ DASHBOARD SEKMESİ ═══════════════════ */}
        {tab === "dashboard" && (
          <div className="admin-dashboard-section">
            <h2 className="admin-section-title">Sistem Özeti</h2>

            {/* Özet Kartları */}
            <div className="admin-stat-grid">
              <StatCard icon="👨‍🏫" value={stats.totalInstructors} label="Toplam Eğitmen" color="#4b35f2" />
              <StatCard icon="🎓" value={stats.totalStudents} label="Toplam Öğrenci" color="#0ea5e9" />
              <StatCard icon="📝" value={stats.activeExams} label="Aktif Sınav" color="#10b981" />
              <StatCard icon="📄" value={stats.totalReports} label="Toplam Rapor" color="#f59e0b" />
              <StatCard icon="🔑" value={stats.activeCodes} label="Aktif Davet Kodu" color="#8b5cf6" />
              <StatCard icon="⚠️" value={stats.criticalReports} label="Kritik Rapor" color="#ef4444" />
            </div>

            {/* Son Kayıtlı Eğitmenler */}
            <div className="admin-table-wrapper" style={{ marginTop: 24 }}>
              <div className="admin-list-header">
                <span className="admin-list-title">
                  Son Kayıtlı Eğitmenler <span className="admin-count-badge">{instructors.length}</span>
                </span>
                <button className="admin-view-all-btn" onClick={() => setTab("instructors")}>
                  Tümünü Gör →
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>Ad Soyad</th><th>E-posta</th><th>Kayıt Tarihi</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Yükleniyor...</td></tr>
                  ) : instructors.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>Henüz eğitmen yok.</td></tr>
                  ) : instructors.slice(0, 5).map((instr, idx) => (
                    <tr key={instr._id || instr.id} className="admin-row">
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{idx + 1}</td>
                      <td className="td-student">{instr.name}</td>
                      <td style={{ color: "#6b7280" }}>{instr.email}</td>
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{formatDate(instr.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Son Raporlar */}
            <div className="admin-table-wrapper" style={{ marginTop: 24 }}>
              <div className="admin-list-header">
                <span className="admin-list-title">
                  Son Öğrenci Raporları <span className="admin-count-badge">{reports.length}</span>
                </span>
                <button className="admin-view-all-btn" onClick={() => setTab("reports")}>
                  Tümünü Gör →
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>Öğrenci</th><th>Sınav</th><th>Risk</th><th>Durum</th></tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>Henüz rapor yok.</td></tr>
                  ) : reports.slice(0, 5).map((r, idx) => (
                    <tr
                      key={r.sessionId || idx}
                      className={`admin-row ${(r.riskScore || 0) >= 70 ? "admin-row--high" : ""}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => onNavigate("report-detail", r.sessionId)}
                    >
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{idx + 1}</td>
                      <td className="td-student">{r.studentName || "Bilinmiyor"}</td>
                      <td style={{ color: "#6b7280" }}>{r.examTitle || "-"}</td>
                      <td>
                        <span className={`risk-badge ${(r.riskScore || 0) >= 70 ? "risk-badge--critical" : (r.riskScore || 0) >= 40 ? "risk-badge--high" : "risk-badge--normal"}`}>
                          {r.riskScore || 0}
                        </span>
                      </td>
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{r.status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════ EĞİTMENLER SEKMESİ ═══════════════════ */}
        {tab === "instructors" && (
          <div className="admin-table-wrapper">
            <div className="admin-list-header">
              <span className="admin-list-title">Kayıtlı Eğitmenler <span className="admin-count-badge">{filteredInstructors.length}</span></span>
              <input className="admin-search-input" placeholder="Ad veya e-posta ara..." value={instrSearch} onChange={e => setInstrSearch(e.target.value)} />
            </div>
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Ad Soyad</th><th>E-posta</th><th>Kayıt Tarihi</th><th>QR Kod</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>Yükleniyor...</td></tr>
                ) : filteredInstructors.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>Sonuç bulunamadı.</td></tr>
                ) : filteredInstructors.map((instr, idx) => (
                  <tr key={instr._id || instr.id} className="admin-row">
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{idx + 1}</td>
                    <td className="td-student">{instr.name}</td>
                    <td style={{ color: "#6b7280" }}>{instr.email}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{formatDate(instr.createdAt)}</td>
                    <td>
                      <div style={{ display: "inline-block", background: "#fff", border: "1px solid #4b35f2", borderRadius: 4, padding: 4 }}>
                        <QRCodeSVG
                          value={`${window.location.origin}/?instructorId=${instr._id || instr.id}`}
                          size={40}
                          fgColor="#4b35f2"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════════ RAPOR ARA SEKMESİ ═══════════════════ */}
        {tab === "reports" && (
          <div>
            {/* Arama Çubuğu */}
            <div className="admin-report-search-bar">
              <div className="admin-report-search-icon">🔍</div>
              <input
                className="admin-report-search-input"
                placeholder="Öğrenci adı, sınav adı veya oturum ID ile ara..."
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
                autoFocus
              />
              {reportSearch && (
                <button className="admin-report-search-clear" onClick={() => setReportSearch("")}>✕</button>
              )}
            </div>

            <div className="admin-table-wrapper">
              <div className="admin-list-header">
                <span className="admin-list-title">
                  Öğrenci Raporları
                  <span className="admin-count-badge">{filteredReports.length}</span>
                  {reportSearch && <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>({reports.length} toplam)</span>}
                </span>
              </div>
              <table className="admin-table">
                <thead>
                  <tr><th>#</th><th>Öğrenci</th><th>Sınav</th><th>Risk Skoru</th><th>İhlal</th><th>Durum</th><th>İşlem</th></tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                      {reportSearch ? "Aramanızla eşleşen rapor bulunamadı." : "Henüz rapor yok."}
                    </td></tr>
                  ) : filteredReports.map((r, idx) => (
                    <tr key={r.sessionId || idx} className={`admin-row ${(r.riskScore || 0) >= 70 ? "admin-row--high" : ""}`}>
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{idx + 1}</td>
                      <td className="td-student">{r.studentName || "Bilinmiyor"}</td>
                      <td style={{ color: "#6b7280" }}>{r.examTitle || "-"}</td>
                      <td>
                        <span className={`risk-badge ${(r.riskScore || 0) >= 70 ? "risk-badge--critical" : (r.riskScore || 0) >= 40 ? "risk-badge--high" : "risk-badge--normal"}`}>
                          {r.riskScore || 0}
                        </span>
                      </td>
                      <td style={{ color: "#6b7280", textAlign: "center" }}>{r.violationCount || 0}</td>
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{r.status || "-"}</td>
                      <td>
                        <button
                          className="action-btn action-btn--report"
                          onClick={() => onNavigate("report-detail", r.sessionId)}
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════ EĞİTMEN OLUŞTUR SEKMESİ ═══════════════════ */}
        {tab === "create" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* SOL KOLON: Doğrudan Eğitmen Oluştur */}
            <div className="admin-table-wrapper">
              <div style={{ padding: "28px 32px" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>Doğrudan Eğitmen Oluştur</h2>
                <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
                  Eğitmen için yeni bir hesap oluşturun. Kayıt sonrasında hemen giriş yapabilirler.
                </p>

                {createSuccessMsg && (
                  <div style={{ background: "#d1fae5", color: "#065f46", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                    {createSuccessMsg}
                  </div>
                )}
                {createErrorMsg && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
                    {createErrorMsg}
                  </div>
                )}

                <form onSubmit={handleCreateInstructor}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.9rem", color: "#4b5563", fontWeight: 500 }}>Ad Soyad</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet Yılmaz"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      style={{ width: "100%", padding: "0.7rem", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.95rem", backgroundColor: "#fff", color: "#111827" }}
                    />
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.9rem", color: "#4b5563", fontWeight: 500 }}>E-posta</label>
                    <input
                      type="email"
                      required
                      placeholder="Örn: ahmet@egitmen.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      style={{ width: "100%", padding: "0.7rem", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.95rem", backgroundColor: "#fff", color: "#111827" }}
                    />
                  </div>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.9rem", color: "#4b5563", fontWeight: 500 }}>Şifre (En az 6 karakter)</label>
                    <input
                      type="password"
                      required
                      minLength="6"
                      placeholder="••••••••"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      style={{ width: "100%", padding: "0.7rem", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.95rem", backgroundColor: "#fff", color: "#111827" }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="admin-generate-btn"
                    style={{ width: "100%", padding: "0.8rem", cursor: "pointer", fontWeight: "bold" }}
                    disabled={loading}
                  >
                    👤 {loading ? "Oluşturuluyor..." : "Eğitmen Hesabı Oluştur"}
                  </button>
                </form>
              </div>
            </div>

            {/* SAĞ KOLON: Davet Kodu Üret ve Mevcut Kodlar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="admin-table-wrapper">
                <div style={{ padding: "28px 32px" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>Eğitmen Davet Kodu Üret</h2>
                  <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
                    Yeni eğitmenin kendi hesabını oluşturması için tek kullanımlık bir kayıt kodu ve QR kodu üretin.
                  </p>
                  <button className="admin-generate-btn" onClick={handleGenerate} disabled={loading}>
                    🔑 {loading ? "Üretiliyor..." : "Yeni Davet Kodu Üret"}
                  </button>
                  {generatedCode && (
                    <div className="admin-code-box">
                      <div className="admin-code-text">{generatedCode}</div>
                      <button className="admin-copy-btn" onClick={handleCopy}>
                        {copied ? "✓ Kopyalandı" : "Kopyala"}
                      </button>
                      <QRPlaceholder value={generatedCode} />
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-table-wrapper">
                <div className="admin-list-header">
                  <span className="admin-list-title">Davet Kodları <span className="admin-count-badge">{codes.length}</span></span>
                </div>
                <table className="admin-table">
                  <thead>
                    <tr><th>Kod</th><th>Durum</th><th>Kullanan</th><th>QR Kod</th></tr>
                  </thead>
                  <tbody>
                    {codes.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>Henüz davet kodu üretilmedi.</td></tr>
                    ) : codes.map((c) => (
                      <tr key={c._id || c.code} className="admin-row">
                        <td style={{ fontFamily: "Courier New", fontSize: 12, fontWeight: 700, color: "#4b35f2" }}>{c.code}</td>
                        <td>
                          <span className={`risk-badge ${c.isUsed ? "risk-badge--high" : "risk-badge--normal"}`}>
                            {c.isUsed ? "Kullanıldı" : "Aktif"}
                          </span>
                        </td>
                        <td style={{ color: "#6b7280", fontSize: 13 }}>{c.usedBy?.name || "-"}</td>
                        <td>
                          {!c.isUsed ? (
                            <div style={{ display: "inline-block", background: "#fff", border: "1px solid #4b35f2", borderRadius: 4, padding: 4 }}>
                              <QRCodeSVG value={`${window.location.origin}/?instructorCode=${c.code}`} size={40} fgColor="#4b35f2" />
                            </div>
                          ) : (
                            <span style={{ color: "#6b7280" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
