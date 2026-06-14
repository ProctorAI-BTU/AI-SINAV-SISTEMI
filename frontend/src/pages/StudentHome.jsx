import React, { useEffect, useState } from "react";
import authService from "../services/auth.js";
import examService from "../services/exam.js";
import "../styles/student.css";
import "../styles/modal.css";

const getStoredProfile = (user) => {
  const storageKey = `studentProfile_${user?.id || user?.email || "demo"}`;
  const savedProfile = localStorage.getItem(storageKey);

  if (savedProfile) {
    try {
      return JSON.parse(savedProfile);
    } catch (error) {
      console.warn("Profil bilgisi okunamadı:", error.message);
    }
  }

  return {
    name: user?.name || "Öğrenci",
    email: user?.email || "ogrenci@example.com",
    avatar: user?.avatar || "",
  };
};

const getStoredExamHistory = (user) => {
  const possibleKeys = [
    user?.id ? `studentExamHistory_${user.id}` : null,
    user?.email ? `studentExamHistory_${user.email}` : null,
    "studentExamHistory_student-1",
    "studentExamHistory_demo",
  ].filter(Boolean);

  for (const key of possibleKeys) {
    const savedHistory = localStorage.getItem(key);

    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) return parsedHistory;
      } catch (error) {
        console.warn("Girilmiş sınav bilgisi okunamadı:", error.message);
      }
    }
  }

  const allHistoryKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith("studentExamHistory_")
  );

  for (const key of allHistoryKeys) {
    const savedHistory = localStorage.getItem(key);

    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) return parsedHistory;
      } catch (error) {
        console.warn("Girilmiş sınav bilgisi okunamadı:", error.message);
      }
    }
  }

  return [];
};

const normalizeExamHistory = (response, fallbackHistory = []) => {
  const rawList =
    response?.items ||
    response?.sessions ||
    response?.history ||
    response?.data?.items ||
    response?.data?.sessions ||
    response?.data?.history ||
    response?.data ||
    response;

  const list = Array.isArray(rawList) ? rawList : fallbackHistory;

  return list.map((item, index) => {
    const exam = item.exam || item.examInfo || {};

    return {
      id: item.id || item._id || item.sessionId || `history_${index}`,
      title: item.title || exam.title || item.examTitle || "Sınav",
      code: item.code || exam.accessCode || item.examCode || "-",
      date:
        item.date ||
        item.finishedAt ||
        item.completedAt ||
        item.createdAt ||
        item.startedAt ||
        "-",
      score:
        item.score ??
        item.result?.score ??
        item.totalScore ??
        item.riskScore ??
        "-",
      status:
        item.status === "terminated"
          ? "Sonlandırıldı"
          : item.status === "auto_submitted"
            ? "Süre Doldu"
            : item.status === "submitted" || item.status === "completed"
              ? "Tamamlandı"
              : item.status || "Tamamlandı",
    };
  });
};

const formatHistoryDate = (value) => {
  if (!value || value === "-") return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR");
};

export default function StudentHome({ onNavigate, onLogout }) {
  const [examCode, setExamCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const user = authService.getCurrentUser();

  const [profile, setProfile] = useState(() => getStoredProfile(user));
  const [profileForm, setProfileForm] = useState(() => getStoredProfile(user));

  const [examHistory, setExamHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const historyPageSize = 5;
  const profileStorageKey = `studentProfile_${user?.id || user?.email || "demo"}`;

  useEffect(() => {
    const nextProfile = getStoredProfile(user);
    setProfile(nextProfile);
    setProfileForm(nextProfile);
  }, [user?.id, user?.email]);

  const loadExamHistory = async (page = historyPage) => {
    const studentId = user?.id || user?.email || "student-1";
    const fallbackHistory = getStoredExamHistory(user);

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await examService.getStudentExamHistory(
        studentId,
        page,
        historyPageSize
      );

      const normalizedHistory = normalizeExamHistory(response, []);

      const finalHistory =
        normalizedHistory.length > 0 ? normalizedHistory : fallbackHistory;

      const pagedHistory = finalHistory.slice(
        (page - 1) * historyPageSize,
        page * historyPageSize
      );

      setExamHistory(pagedHistory);
      setHistoryTotalPages(
        Math.max(1, Math.ceil(finalHistory.length / historyPageSize))
      );
    } catch (error) {
      console.warn("Sınav geçmişi backend'den alınamadı:", error.message);

      const fallbackPaged = fallbackHistory.slice(
        (page - 1) * historyPageSize,
        page * historyPageSize
      );

      setExamHistory(fallbackPaged);
      setHistoryTotalPages(
        Math.max(1, Math.ceil(fallbackHistory.length / historyPageSize))
      );

      setHistoryError("");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadExamHistory(historyPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, historyPage]);

  const openHistoryModal = () => {
    setHistoryPage(1);
    setShowHistoryModal(true);
    loadExamHistory(1);
  };

  const openProfileModal = () => {
    setProfileForm(profile);
    setIsEditingProfile(false);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setIsEditingProfile(false);
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setProfileForm((current) => ({
        ...current,
        avatar: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    const nextProfile = {
      name: profileForm.name?.trim() || "Öğrenci",
      email: profileForm.email?.trim() || "ogrenci@example.com",
      avatar: profileForm.avatar || "",
    };

    setProfile(nextProfile);
    localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
    setIsEditingProfile(false);
  };

  const startFlow = async (event) => {
    event.preventDefault();

    const code = examCode.trim().toUpperCase();

    if (!code) {
      setError("Sınava devam etmek için sınav kodunu girin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await examService.getExamByCode(code);

      const exam =
        response?.exam ||
        response?.data?.exam ||
        response?.data ||
        response;

      const examTitle = exam?.title || exam?.name || "Sınav";

      onNavigate("pre-exam-check", {
        examCode: code,
        examTitle,
        exam,
      });
    } catch (err) {
      setError(err.message || "Sınav kodunu kontrol ederken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const filteredExamHistory = examHistory.filter((exam) => {
    const searchText = historySearch.trim().toLowerCase();

    const title = String(exam.title || "").toLowerCase();
    const code = String(exam.code || "").toLowerCase();
    const status = String(exam.status || "").toLowerCase();

    const matchesSearch =
      !searchText || title.includes(searchText) || code.includes(searchText);

    const matchesStatus =
      historyStatusFilter === "all" ||
      status === historyStatusFilter.toLowerCase();

    let matchesStartDate = true;
    let matchesEndDate = true;

    if (exam.date && exam.date !== "-") {
      const examDate = new Date(exam.date);

      if (historyStartDate) {
        const startDate = new Date(historyStartDate);
        matchesStartDate = examDate >= startDate;
      }

      if (historyEndDate) {
        const endDate = new Date(historyEndDate);
        endDate.setHours(23, 59, 59, 999);
        matchesEndDate = examDate <= endDate;
      }
    }

    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="student-page">
      <header className="student-topbar">
        <div className="student-brand">
          <span>AI</span>
          <strong>Öğrenci Ekranı</strong>
        </div>

        <div className="student-topbar-actions">
          <button
            className="student-history-btn"
            onClick={openHistoryModal}
            type="button"
          >
            Girilmiş Sınavlar
          </button>

          <button
            className="student-profile-btn"
            onClick={openProfileModal}
            type="button"
          >
            <span className="student-profile-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Profil" />
              ) : (
                (profile.name || "Ö").charAt(0).toUpperCase()
              )}
            </span>
            Profil
          </button>

          <button className="student-logout" onClick={onLogout}>
            Çıkış Yap
          </button>
        </div>
      </header>

      <main className="student-main">
        <section className="student-panel">
          <div>
            <h1>Merhaba, {profile?.name || user?.name || "Öğrenci"}</h1>
            <p>
              Sınav kodunu girdikten sonra kamera, mikrofon, tam ekran ve yüz
              doğrulaması yapılır.
            </p>
          </div>

          <form className="student-code-form" onSubmit={startFlow}>
            <label htmlFor="student-exam-code">Sınav Kodu</label>

            <div className="student-code-row">
              <input
                id="student-exam-code"
                className="form-input"
                value={examCode}
                onChange={(event) => {
                  setError("");
                  setExamCode(event.target.value.toUpperCase());
                }}
                disabled={loading}
                placeholder="Örn: ABC123"
              />

              <button
                className="student-start-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? "Kontrol Ediliyor..." : "Kontrole Geç"}
              </button>
            </div>

            {error && <div className="student-error">{error}</div>}
          </form>
        </section>
      </main>

      {showHistoryModal && (
        <div className="profile-modal-overlay">
          <div className="profile-modal-box profile-modal-box--wide">
            <div className="profile-modal-header">
              <h2>Girilmiş Sınavlar</h2>

              <button
                className="profile-modal-close"
                onClick={() => setShowHistoryModal(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                gap: "10px",
                marginBottom: "18px",
                alignItems: "end",
              }}
            >
              <label
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <span>Sınav adı / kod ara</span>
                <input
                  className="form-input"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Örn: Matematik, DEMO01"
                />
              </label>

              <label
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <span>Başlangıç</span>
                <input
                  className="form-input"
                  type="date"
                  value={historyStartDate}
                  onChange={(event) => setHistoryStartDate(event.target.value)}
                />
              </label>

              <label
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <span>Bitiş</span>
                <input
                  className="form-input"
                  type="date"
                  value={historyEndDate}
                  onChange={(event) => setHistoryEndDate(event.target.value)}
                />
              </label>

              <label
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <span>Durum</span>
                <select
                  className="form-input"
                  value={historyStatusFilter}
                  onChange={(event) =>
                    setHistoryStatusFilter(event.target.value)
                  }
                >
                  <option value="all">Tümü</option>
                  <option value="tamamlandı">Tamamlandı</option>
                  <option value="süre doldu">Süre Doldu</option>
                  <option value="sonlandırıldı">Sonlandırıldı</option>
                </select>
              </label>

              <button
                className="profile-secondary-btn"
                type="button"
                onClick={() => {
                  setHistorySearch("");
                  setHistoryStartDate("");
                  setHistoryEndDate("");
                  setHistoryStatusFilter("all");
                }}
              >
                Temizle
              </button>
            </div>

            <div className="student-history-list">
              {historyLoading ? (
                <div className="student-history-empty">
                  Sınav geçmişi yükleniyor...
                </div>
              ) : filteredExamHistory.length > 0 ? (
                filteredExamHistory.map((exam) => (
                  <div
                    className="student-history-card"
                    key={exam.id || exam.code}
                  >
                    <div>
                      <strong>{exam.title || "Sınav"}</strong>
                      <span>Kod: {exam.code || "-"}</span>
                    </div>

                    <div>
                      <span>{formatHistoryDate(exam.date)}</span>
                      <strong>{exam.status || "Tamamlandı"}</strong>
                    </div>

                    <div>
                      <span>Puan</span>
                      <strong>{exam.score || "-"}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="student-history-empty">
                  Filtrelere uygun sınav kaydı bulunmuyor.
                </div>
              )}
            </div>

            {historyError && (
              <p className="student-history-desc" style={{ color: "#f59e0b" }}>
                {historyError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                marginTop: "18px",
              }}
            >
              <button
                className="profile-secondary-btn"
                type="button"
                disabled={historyPage <= 1}
                onClick={() =>
                  setHistoryPage((page) => Math.max(1, page - 1))
                }
              >
                Önceki
              </button>

              <span>
                Sayfa {historyPage} / {historyTotalPages}
              </span>

              <button
                className="profile-secondary-btn"
                type="button"
                disabled={historyPage >= historyTotalPages}
                onClick={() =>
                  setHistoryPage((page) =>
                    Math.min(historyTotalPages, page + 1)
                  )
                }
              >
                Sonraki
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="profile-modal-overlay">
          <div className="profile-modal-box">
            <div className="profile-modal-header">
              <h2>Öğrenci Profili</h2>

              <button
                className="profile-modal-close"
                onClick={closeProfileModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="profile-avatar-large">
              {profileForm.avatar ? (
                <img src={profileForm.avatar} alt="Profil" />
              ) : (
                (profileForm.name || "Ö").charAt(0).toUpperCase()
              )}
            </div>

            {isEditingProfile && (
              <label className="profile-file-label">
                Profil resmi seç
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
              </label>
            )}

            <div className="profile-form">
              <label>
                İsim
                <input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  disabled={!isEditingProfile}
                />
              </label>

              <label>
                Mail
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  disabled={!isEditingProfile}
                />
              </label>
            </div>

            <div className="profile-modal-actions">
              {isEditingProfile ? (
                <>
                  <button
                    className="profile-secondary-btn"
                    onClick={() => {
                      setProfileForm(profile);
                      setIsEditingProfile(false);
                    }}
                    type="button"
                  >
                    Vazgeç
                  </button>

                  <button
                    className="profile-primary-btn"
                    onClick={saveProfile}
                    type="button"
                  >
                    Kaydet
                  </button>
                </>
              ) : (
                <button
                  className="profile-primary-btn"
                  onClick={() => setIsEditingProfile(true)}
                  type="button"
                >
                  Düzenle
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}