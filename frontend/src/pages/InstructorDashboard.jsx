import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import AlertFeed from "../components/Dashboard/AlertFeed";
import StudentGrid from "../components/Dashboard/StudentGrid";
import reportingService from "../services/reporting.js";
import authService from "../services/auth.js";
import examService from "../services/exam.js";
import "../styles/dashboard.css";
import "../styles/admin.css";
import "../styles/modal.css";

const getStoredInstructorProfile = (user) => {
  const storageKey = `instructorProfile_${user?.id || user?.email || "demo"}`;
  const savedProfile = localStorage.getItem(storageKey);

  if (savedProfile) {
    try {
      return JSON.parse(savedProfile);
    } catch (error) {
      console.warn("Eğitmen profil bilgisi okunamadı:", error.message);
    }
  }

  return {
    name: user?.name || "Eğitmen",
    email: user?.email || "egitmen@example.com",
    avatar: user?.avatar || "",
  };
};

// ─── Örnek JSON soru şablonu ──────────────────────────
const QUESTION_TEMPLATE = `[
  {
    "question": "Türkiye'nin başkenti neresidir?",
    "type": "multiple_choice",
    "options": ["İstanbul", "Ankara", "İzmir", "Bursa"],
    "correctAnswer": 1,
    "points": 10
  },
  {
    "question": "HTTP protokolü hangi port üzerinden çalışır?",
    "type": "multiple_choice",
    "options": ["21", "22", "80", "443"],
    "correctAnswer": 2,
    "points": 10
  },
  {
    "question": "Python'da liste oluşturmak için hangi sembol kullanılır?",
    "type": "multiple_choice",
    "options": ["{ }", "( )", "[ ]", "< >"],
    "correctAnswer": 2,
    "points": 10
  }
]`;

export default function InstructorDashboard({ onNavigate, onLogout }) {
  // ─── Sekme yönetimi ────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard");

  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Sınav oluşturma ──────────────────────────────────
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examDuration, setExamDuration] = useState(60);
  const [createdExamCode, setCreatedExamCode] = useState("");
  const [examQuestions, setExamQuestions] = useState("");
  const [questionInputMode, setQuestionInputMode] = useState("form"); // "form" | "json"
  const [formQuestions, setFormQuestions] = useState([
    { question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 }
  ]);

  // ─── Arama ────────────────────────────────────────────
  const [reportSearch, setReportSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const currentUser = authService.getCurrentUser();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profile, setProfile] = useState(() => getStoredInstructorProfile(currentUser));
  const [profileForm, setProfileForm] = useState(() => getStoredInstructorProfile(currentUser));

  useEffect(() => {
    const nextProfile = getStoredInstructorProfile(currentUser);
    setProfile(nextProfile);
    setProfileForm(nextProfile);
  }, [currentUser?.id, currentUser?.email]);

  const profileStorageKey = `instructorProfile_${currentUser?.id || currentUser?.email || "demo"}`;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const openProfileModal = () => {
    setProfileForm(profile);
    setIsEditingProfile(false);
    setProfileError("");
    setProfileMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setIsEditingProfile(false);
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setProfileError("Hata: Dosya boyutu 1MB'dan küçük olmalıdır!");
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setProfileError("Hata: Sadece JPG, PNG, WEBP veya GIF resimleri yükleyebilirsiniz!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Str = reader.result;
      const signature = base64Str.split(',')[0];
      const expectedSignatures = [
        'data:image/jpeg;base64',
        'data:image/png;base64',
        'data:image/webp;base64',
        'data:image/gif;base64'
      ];

      const isValidSignature = expectedSignatures.some(sig => signature.startsWith(sig));
      if (!isValidSignature) {
        setProfileError("Hata: Geçersiz veya güvenli olmayan resim formatı!");
        return;
      }

      setProfileForm((current) => ({ ...current, avatar: base64Str }));
      setProfileError("");
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setProfileError("");
    setProfileMessage("");

    try {
      if (profileForm.name?.trim() !== profile.name) {
        await authService.updateProfile({ name: profileForm.name?.trim() });
        const user = authService.getCurrentUser();
        if (user) {
          user.name = profileForm.name?.trim();
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
          setProfileError("Şifre değiştirmek için hem mevcut hem de yeni şifreyi girmelisiniz.");
          return;
        }
        if (newPassword.length < 6) {
          setProfileError("Yeni şifre en az 6 karakter olmalıdır.");
          return;
        }
        await authService.changePassword({ currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
      }

      const nextProfile = {
        name: profileForm.name?.trim() || "Eğitmen",
        email: profile.email || "egitmen@example.com",
        avatar: profileForm.avatar || "",
      };

      setProfile(nextProfile);
      localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
      setProfileMessage("Profil başarıyla güncellendi.");
      setIsEditingProfile(false);
    } catch (err) {
      setProfileError(err.message || "Profil güncellenirken hata oluştu.");
    }
  };

  // ─── Veri Yükleme ─────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setLoading(true);
      const filters = currentUser?.role === "instructor" ? { instructorId: currentUser.id } : {};
      const data = await reportingService.getReports(filters);
      if (isMounted) {
        setReports(data);
        setLoading(false);
      }
    }

    loadReports();
    const interval = setInterval(loadReports, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.role]);

  // Öğrenci listesini yükle
  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await authService.getAllUsers("student");
        setStudents(res.data?.users || []);
      } catch (err) {
        console.warn("Öğrenci listesi yüklenemedi:", err.message);
      }
    }
    loadStudents();
  }, []);

  const stats = useMemo(() => {
    const activeSessions = reports.filter((report) => report.status === "active").length;
    const activeExams = new Set(reports.map((report) => report.examId || report.examTitle).filter(Boolean)).size;
    const criticalAlerts = reports.filter((report) => (report.riskScore || 0) >= 70).length;
    return { activeExams, activeSessions, criticalAlerts };
  }, [reports]);

  // ─── Filtreleme ───────────────────────────────────────
  const filteredReports = reports.filter(r =>
    (r.studentName || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
    (r.examTitle || "").toLowerCase().includes(reportSearch.toLowerCase()) ||
    (r.sessionId || "").toLowerCase().includes(reportSearch.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    (s.name || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(studentSearch.toLowerCase())
  );

  // ─── Soru Form Yönetimi ───────────────────────────────
  const addFormQuestion = () => {
    setFormQuestions([...formQuestions, { question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 }]);
  };

  const removeFormQuestion = (idx) => {
    if (formQuestions.length <= 1) return;
    setFormQuestions(formQuestions.filter((_, i) => i !== idx));
  };

  const updateFormQuestion = (idx, field, value) => {
    const updated = [...formQuestions];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormQuestions(updated);
  };

  const updateFormOption = (qIdx, optIdx, value) => {
    const updated = [...formQuestions];
    const opts = [...updated[qIdx].options];
    opts[optIdx] = value;
    updated[qIdx] = { ...updated[qIdx], options: opts };
    setFormQuestions(updated);
  };

  // ─── Sınav Oluştur ───────────────────────────────────
  const handleCreateExam = async (e) => {
    e.preventDefault();
    try {
      let questions = [];

      if (questionInputMode === "json") {
        try {
          questions = JSON.parse(examQuestions);
          if (!Array.isArray(questions)) {
            alert("JSON formatı bir dizi (array) olmalıdır!");
            return;
          }
        } catch (parseErr) {
          alert("Geçersiz JSON formatı! Lütfen kontrol edin.\n" + parseErr.message);
          return;
        }
      } else {
        // Form modundan JSON'a çevir
        const valid = formQuestions.every(q => q.question.trim() && q.options.some(o => o.trim()));
        if (!valid) {
          alert("Her sorunun metni ve en az bir seçeneği olmalıdır!");
          return;
        }
        questions = formQuestions.map((q, i) => ({
          question: q.question.trim(),
          type: "multiple_choice",
          options: q.options.filter(o => o.trim()),
          correctAnswer: q.correctAnswer,
          points: q.points || 10,
        }));
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await examService.createExam({
        title: examTitle,
        duration: Number(examDuration),
        instructorId: currentUser?.id || "instructor-1",
        accessCode: code,
        status: "published",
        questions: questions,
      });
      setCreatedExamCode(code);
    } catch (error) {
      alert("Sınav oluşturulamadı: " + (error.message || "Bilinmeyen hata"));
    }
  };

  const openExamModal = () => {
    setShowExamModal(true);
    setCreatedExamCode("");
    setExamTitle("");
    setExamDuration(60);
    setExamQuestions("");
    setQuestionInputMode("form");
    setFormQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 }]);
  };

  // ─── Navbar Sekme Tanımları ──────────────────────────
  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "students", label: "Öğrenciler", icon: "🎓" },
    { key: "reports", label: "Rapor Ara", icon: "🔍" },
    { key: "exam-create", label: "Sınav Oluştur", icon: "📝" },
  ];

  function formatDate(d) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("tr-TR");
  }

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">AI</div>
          <span className="navbar-logo-text">Eğitmen Paneli</span>
        </div>
        <div className="navbar-links">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`navbar-link${activeTab === t.key ? " navbar-link--active" : ""}`}
              onClick={() => {
                if (t.key === "exam-create") {
                  openExamModal();
                } else {
                  setActiveTab(t.key);
                }
              }}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
            </button>
          ))}
          {currentUser?.role === "admin" && (
            <button className="navbar-link" onClick={() => onNavigate("admin-dashboard")}>
              <span style={{ marginRight: 6 }}>⚙️</span>Admin Panel
            </button>
          )}
        </div>
        <div className="navbar-actions">
          <button className="navbar-profile-btn" onClick={openProfileModal} type="button">
            <span className="navbar-profile-avatar">
              {profile.avatar ? <img src={profile.avatar} alt="Profil" /> : (profile.name || "E").charAt(0).toUpperCase()}
            </span>
            Profil
          </button>
          <button className="btn-logout" onClick={onLogout}>Çıkış</button>
        </div>
      </nav>

      <main className="dashboard-main">
        {/* ═══════════════════ DASHBOARD SEKMESİ ═══════════════════ */}
        {activeTab === "dashboard" && (
          <>
            <AlertFeed stats={stats} />
            {loading ? (
              <div className="admin-table-wrapper" style={{ padding: "1.5rem" }}>Raporlar yükleniyor...</div>
            ) : (
              <StudentGrid sessions={reports} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* ═══════════════════ ÖĞRENCİLER SEKMESİ ═══════════════════ */}
        {activeTab === "students" && (
          <div className="admin-table-wrapper">
            <div className="admin-list-header">
              <span className="admin-list-title">
                Kayıtlı Öğrenciler <span className="admin-count-badge">{filteredStudents.length}</span>
              </span>
              <input
                className="admin-search-input"
                placeholder="Ad veya e-posta ara..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
              />
            </div>
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Ad Soyad</th><th>E-posta</th><th>Kayıt Tarihi</th></tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
                    {studentSearch ? "Aramanızla eşleşen öğrenci bulunamadı." : "Henüz öğrenci kaydı yok."}
                  </td></tr>
                ) : filteredStudents.map((stu, idx) => (
                  <tr key={stu._id || stu.id} className="admin-row">
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{idx + 1}</td>
                    <td className="td-student">{stu.name}</td>
                    <td style={{ color: "#6b7280" }}>{stu.email}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{formatDate(stu.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══════════════════ RAPOR ARA SEKMESİ ═══════════════════ */}
        {activeTab === "reports" && (
          <div>
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

        {/* ═══════════════════ SINAV OLUŞTUR MODALI ═══════════════════ */}
        {showExamModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 9999, overflowY: "auto", padding: "40px 20px" }}>
            <div style={{ backgroundColor: "#1e1e2d", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "700px", color: "white", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h2 style={{ margin: 0 }}>📝 Yeni Sınav Oluştur</h2>
                <button onClick={() => setShowExamModal(false)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 24, cursor: "pointer" }}>×</button>
              </div>

              {createdExamCode ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ backgroundColor: "rgba(0, 200, 83, 0.1)", padding: "1.5rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid #00c853" }}>
                    <p style={{ margin: 0, color: "#00c853", fontWeight: "bold" }}>Sınav başarıyla oluşturuldu!</p>
                    <h3 style={{ margin: "10px 0 15px 0", fontSize: "2.5rem", letterSpacing: "3px", color: "white" }}>{createdExamCode}</h3>

                    <div style={{ display: "inline-block", background: "#fff", border: "2px solid #00c853", borderRadius: 8, padding: 12, marginBottom: 15 }}>
                      <QRCodeSVG value={`${window.location.origin}/?examCode=${createdExamCode}`} size={140} fgColor="#00c853" />
                    </div>

                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#aaa" }}>Öğrenciler bu QR kodu telefonla okutarak doğrudan sınava katılabilirler.</p>
                  </div>
                  <button className="btn" style={{ width: "100%", padding: "0.8rem", backgroundColor: "#3f8cf4", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }} onClick={() => setShowExamModal(false)}>Kapat</button>
                </div>
              ) : (
                <form onSubmit={handleCreateExam}>
                  {/* Sınav bilgileri */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#ccc" }}>Sınav Adı</label>
                      <input type="text" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} required placeholder="Örn: İngilizce Vize Sınavı" style={{ width: "100%", padding: "0.8rem", borderRadius: "6px", border: "1px solid #333", backgroundColor: "#2b2b40", color: "white" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#ccc" }}>Süre (Dakika)</label>
                      <input type="number" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} required min="1" style={{ width: "100%", padding: "0.8rem", borderRadius: "6px", border: "1px solid #333", backgroundColor: "#2b2b40", color: "white" }} />
                    </div>
                  </div>

                  {/* Soru ekleme modu seçimi */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#ccc", fontWeight: 600 }}>📋 Soru Ekleme Yöntemi</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setQuestionInputMode("form")}
                        style={{
                          flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${questionInputMode === "form" ? "#3f8cf4" : "#333"}`,
                          background: questionInputMode === "form" ? "rgba(63,140,244,0.15)" : "#2b2b40",
                          color: questionInputMode === "form" ? "#3f8cf4" : "#aaa",
                          cursor: "pointer", fontWeight: 600, fontSize: 13
                        }}
                      >
                        📝 Form ile Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuestionInputMode("json")}
                        style={{
                          flex: 1, padding: "10px", borderRadius: 8, border: `2px solid ${questionInputMode === "json" ? "#3f8cf4" : "#333"}`,
                          background: questionInputMode === "json" ? "rgba(63,140,244,0.15)" : "#2b2b40",
                          color: questionInputMode === "json" ? "#3f8cf4" : "#aaa",
                          cursor: "pointer", fontWeight: 600, fontSize: 13
                        }}
                      >
                        {"{ }"} JSON ile Ekle
                      </button>
                    </div>
                  </div>

                  {/* ─── FORM MODU ─── */}
                  {questionInputMode === "form" && (
                    <div style={{ marginBottom: "1.5rem" }}>
                      {formQuestions.map((q, qIdx) => (
                        <div key={qIdx} style={{ background: "#252540", border: "1px solid #333", borderRadius: 10, padding: 16, marginBottom: 12, position: "relative" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#3f8cf4" }}>Soru {qIdx + 1}</span>
                            {formQuestions.length > 1 && (
                              <button type="button" onClick={() => removeFormQuestion(qIdx)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                                Sil
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Soru metnini yazın..."
                            value={q.question}
                            onChange={(e) => updateFormQuestion(qIdx, "question", e.target.value)}
                            style={{ width: "100%", padding: "0.7rem", borderRadius: "6px", border: "1px solid #444", backgroundColor: "#1e1e2d", color: "white", marginBottom: 10, fontSize: 14 }}
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="radio"
                                  name={`correct-${qIdx}`}
                                  checked={q.correctAnswer === optIdx}
                                  onChange={() => updateFormQuestion(qIdx, "correctAnswer", optIdx)}
                                  style={{ accentColor: "#00c853" }}
                                />
                                <input
                                  type="text"
                                  placeholder={`Seçenek ${String.fromCharCode(65 + optIdx)}`}
                                  value={opt}
                                  onChange={(e) => updateFormOption(qIdx, optIdx, e.target.value)}
                                  style={{ flex: 1, padding: "0.5rem", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#1e1e2d", color: "white", fontSize: 13 }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <label style={{ fontSize: 12, color: "#888" }}>Puan:</label>
                            <input
                              type="number"
                              min="1"
                              value={q.points}
                              onChange={(e) => updateFormQuestion(qIdx, "points", Number(e.target.value))}
                              style={{ width: 60, padding: "0.4rem", borderRadius: "5px", border: "1px solid #444", backgroundColor: "#1e1e2d", color: "white", fontSize: 13, textAlign: "center" }}
                            />
                            <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>🟢 Yeşil = doğru cevap</span>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addFormQuestion}
                        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "2px dashed #444", background: "transparent", color: "#3f8cf4", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}
                      >
                        + Yeni Soru Ekle
                      </button>
                    </div>
                  )}

                  {/* ─── JSON MODU ─── */}
                  {questionInputMode === "json" && (
                    <div style={{ marginBottom: "1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <label style={{ fontSize: "0.85rem", color: "#ccc" }}>JSON Soru Dizisi</label>
                        <button
                          type="button"
                          onClick={() => setExamQuestions(QUESTION_TEMPLATE)}
                          style={{ background: "rgba(63,140,244,0.15)", border: "1px solid rgba(63,140,244,0.4)", color: "#3f8cf4", padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                        >
                          📄 Örnek Şablon Yükle
                        </button>
                      </div>
                      <textarea
                        value={examQuestions}
                        onChange={(e) => setExamQuestions(e.target.value)}
                        placeholder={`[\n  {\n    "question": "Soru metni...",\n    "type": "multiple_choice",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": 0,\n    "points": 10\n  }\n]`}
                        rows={12}
                        style={{
                          width: "100%", padding: "1rem", borderRadius: "8px", border: "1px solid #333",
                          backgroundColor: "#0a0a14", color: "#86efac", fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                          fontSize: 13, lineHeight: 1.6, resize: "vertical"
                        }}
                      />
                      <p style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
                        💡 Her soru: question, type, options (dizi), correctAnswer (index), points alanlarını içermelidir.
                      </p>
                    </div>
                  )}

                  {/* Butonlar */}
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button type="button" onClick={() => setShowExamModal(false)} style={{ flex: 1, padding: "0.8rem", backgroundColor: "transparent", color: "#ccc", border: "1px solid #555", borderRadius: "6px", cursor: "pointer" }}>İptal</button>
                    <button type="submit" style={{ flex: 1, padding: "0.8rem", backgroundColor: "#3f8cf4", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                      🚀 Sınavı Oluştur ({questionInputMode === "form" ? `${formQuestions.length} soru` : "JSON"})
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ PROFİL MODALI ═══════════════════ */}
        {showProfileModal && (
          <div className="profile-modal-overlay">
            <div className="profile-modal-box">
              <div className="profile-modal-header">
                <h2>Eğitmen Profili</h2>
                <button className="profile-modal-close" onClick={closeProfileModal} type="button">×</button>
              </div>

              {profileMessage && (
                <div style={{ background: "#d1fae5", color: "#065f46", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                  {profileMessage}
                </div>
              )}
              {profileError && (
                <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
                  {profileError}
                </div>
              )}

              <div className="profile-avatar-large">
                {profileForm.avatar ? <img src={profileForm.avatar} alt="Profil" /> : (profileForm.name || "E").charAt(0).toUpperCase()}
              </div>

              {isEditingProfile && (
                <label className="profile-file-label">
                  Profil resmi seç
                  <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                </label>
              )}

              <div className="profile-form">
                <label>
                  İsim
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!isEditingProfile}
                  />
                </label>
                <label>
                  Mail
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={true}
                  />
                </label>
                {isEditingProfile && (
                  <>
                    <label>
                      Mevcut Şifre
                      <input
                        type="password"
                        placeholder="Mevcut şifreniz"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </label>
                    <label>
                      Yeni Şifre
                      <input
                        type="password"
                        placeholder="Yeni şifreniz (En az 6 karakter)"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="profile-modal-actions">
                {isEditingProfile ? (
                  <>
                    <button className="profile-secondary-btn" onClick={() => { setProfileForm(profile); setIsEditingProfile(false); setProfileError(""); setProfileMessage(""); setCurrentPassword(""); setNewPassword(""); }} type="button">Vazgeç</button>
                    <button className="profile-primary-btn" onClick={saveProfile} type="button">Kaydet</button>
                  </>
                ) : (
                  <button className="profile-primary-btn" onClick={() => { setIsEditingProfile(true); setProfileError(""); setProfileMessage(""); }} type="button">Düzenle</button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
