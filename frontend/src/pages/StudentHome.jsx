import React, { useEffect, useState } from "react";
import authService from "../services/auth.js";
import examService from "../services/exam.js";
import reportingService from "../services/reporting.js";
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
  const storageKey = `studentExamHistory_${user?.id || user?.email || "demo"}`;
  const savedHistory = localStorage.getItem(storageKey);

  if (savedHistory) {
    try {
      const parsedHistory = JSON.parse(savedHistory);
      if (Array.isArray(parsedHistory)) return parsedHistory;
    } catch (error) {
      console.warn("Girilmiş sınav bilgisi okunamadı:", error.message);
    }
  }

  return [
    { id: "exam_hist_1", title: "Demo Sınav", code: "DEMO01", date: "Örnek kayıt", score: "-", status: "Tamamlandı" },
    { id: "exam_hist_2", title: "Matematik Vize", code: "MAT101", date: "Örnek kayıt", score: "-", status: "Tamamlandı" },
  ];
};

export default function StudentHome({ onNavigate, onLogout }) {
  const [examCode, setExamCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const user = authService.getCurrentUser();
  const [profile, setProfile] = useState(() => getStoredProfile(user));
  const [profileForm, setProfileForm] = useState(() => getStoredProfile(user));
  const [examHistory, setExamHistory] = useState(() => getStoredExamHistory(user));

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const formatExamDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("tr-TR") + " " + new Date(d).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
  };

  const loadExamHistory = async () => {
    if (!user?.id) return;
    try {
      const reportsData = await reportingService.getReports({ studentId: user.id });
      if (reportsData && reportsData.length > 0) {
        const history = reportsData.map(session => ({
          id: session.sessionId,
          title: session.examTitle || "Sınav",
          code: session.examCode || "-",
          date: formatExamDate(session.startedAt || session.createdAt),
          score: typeof session.riskScore === 'number' ? `${Math.round(session.riskScore)}/100 (Risk)` : "-",
          status: session.status === "submitted" ? "Tamamlandı" : session.status === "active" ? "Aktif" : "Sonlandırıldı"
        }));
        setExamHistory(history);
      } else {
        setExamHistory(getStoredExamHistory(user));
      }
    } catch (err) {
      console.warn("Dinamik sınav geçmişi alınamadı, yerel geçmiş yükleniyor:", err.message);
      setExamHistory(getStoredExamHistory(user));
    }
  };

  useEffect(() => {
    const nextProfile = getStoredProfile(user);
    setProfile(nextProfile);
    setProfileForm(nextProfile);
    loadExamHistory();
  }, [user?.id, user?.email]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("examCode");
    if (code) {
      setExamCode(code.toUpperCase());
    }
  }, []);

  const profileStorageKey = `studentProfile_${user?.id || user?.email || "demo"}`;

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

    // SİBER GÜVENLİK KONTROLLERİ:
    // 1. Dosya Boyutu Kontrolü (Max 1MB)
    if (file.size > 1024 * 1024) {
      setProfileError("Hata: Dosya boyutu 1MB'dan küçük olmalıdır!");
      return;
    }

    // 2. MIME Tipi Kontrolü (Sadece güvenli resim tipleri)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setProfileError("Hata: Sadece JPG, PNG, WEBP veya GIF resimleri yükleyebilirsiniz!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      // 3. Base64 İçerik Güvenliği Kontrolü (Malicious script inject önleme)
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
      // 1. İsim Güncelleme (Backend API)
      if (profileForm.name?.trim() !== profile.name) {
        await authService.updateProfile({ name: profileForm.name?.trim() });
        // LocalStorage'daki kullanıcı bilgisini güncelle
        const user = authService.getCurrentUser();
        if (user) {
          user.name = profileForm.name?.trim();
          localStorage.setItem("user", JSON.stringify(user));
        }
      }

      // 2. Şifre Değiştirme (Eğer alanlar doldurulduysa)
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
        name: profileForm.name?.trim() || "Öğrenci",
        email: profile.email || "ogrenci@example.com",
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

  const handleOpenHistoryModal = () => {
    loadExamHistory();
    setShowHistoryModal(true);
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
      // Önce arka plana sor: Bu kod geçerli mi? Daha önce bu sınava girdim mi?
      const res = await examService.joinByCode(code, {
        studentId: user?.id,
        studentName: profile?.name || user?.name
      });
      
      onNavigate("pre-exam-check", {
        examCode: code,
        examTitle: res?.exam?.title || res?.examTitle || "Sınav",
        exam: res?.exam,
        session: res?.session,
        questions: res?.questions,
      });
    } catch (err) {
      setError(err.message || "Sınav kodunu kontrol ederken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-page">
      <header className="student-topbar">
        <div className="student-brand">
          <span>AI</span>
          <strong>Öğrenci Ekranı</strong>
        </div>
        <div className="student-topbar-actions">
          <button className="student-history-btn" onClick={handleOpenHistoryModal} type="button">
            Girilmiş Sınavlar
          </button>
          <button className="student-profile-btn" onClick={openProfileModal} type="button">
            <span className="student-profile-avatar">
              {profile.avatar ? <img src={profile.avatar} alt="Profil" /> : (profile.name || "Ö").charAt(0).toUpperCase()}
            </span>
            Profil
          </button>
          <button className="student-logout" onClick={onLogout}>Çıkış Yap</button>
        </div>
      </header>

      <main className="student-main">
        <section className="student-panel">
          <div>
            <h1>Merhaba, {profile?.name || user?.name || "Öğrenci"}</h1>
            <p>Sınav kodunu girdikten sonra kamera, mikrofon, tam ekran ve yüz doğrulaması yapılır.</p>
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
              <button className="student-start-btn" type="submit" disabled={loading}>
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
              <button className="profile-modal-close" onClick={() => setShowHistoryModal(false)} type="button">×</button>
            </div>

            <p className="student-history-desc">
              Öğrencinin daha önce katıldığı sınavlar bu alanda listelenir. Backend bağlantısı hazır olduğunda bu liste gerçek sınav kayıtlarıyla doldurulabilir.
            </p>

            <div className="student-history-list">
              {examHistory.length > 0 ? examHistory.map((exam) => (
                <div className="student-history-card" key={exam.id || exam.code}>
                  <div>
                    <strong>{exam.title || "Sınav"}</strong>
                    <span>Kod: {exam.code || "-"}</span>
                  </div>
                  <div>
                    <span>{exam.date || "-"}</span>
                    <strong>{exam.status || "Tamamlandı"}</strong>
                  </div>
                  <div>
                    <span>Puan</span>
                    <strong>{exam.score || "-"}</strong>
                  </div>
                </div>
              )) : (
                <div className="student-history-empty">Henüz girilmiş sınav kaydı bulunmuyor.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="profile-modal-overlay">
          <div className="profile-modal-box">
            <div className="profile-modal-header">
              <h2>Öğrenci Profili</h2>
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
              {profileForm.avatar ? <img src={profileForm.avatar} alt="Profil" /> : (profileForm.name || "Ö").charAt(0).toUpperCase()}
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
                  disabled={true} // Mail adresi değiştirilemez (güvenlik ve tutarlılık için)
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
    </div>
  );
}
