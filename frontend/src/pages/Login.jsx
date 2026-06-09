import React, { useState, useEffect } from "react";
import authService from "../services/auth";
import "../styles/auth.css";

export default function Login({ onNavigate }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [instructorCode, setInstructorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("instructorCode");
    if (code) {
      setIsLoginView(false);
      setRole("instructor");
      setInstructorCode(code.trim());
    }
  }, []);

  const routeByRole = () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role === "admin" || currentUser?.role === "instructor") {
      onNavigate("instructor-dashboard");
      return;
    }
    onNavigate("student-home");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLoginView) {
        await authService.login({ email, password });
      } else {
        if (role === "instructor" && !instructorCode.trim()) {
          setError("Eğitmen kaydı için lütfen sistem kodunu giriniz.");
          return;
        }
        await authService.register({ name, email, password, role, instructorCode });
      }

      routeByRole();
    } catch (err) {
      setError(err.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const toggleView = () => {
    setIsLoginView((value) => !value);
    setError("");
  };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <span>AI</span>
        </div>

        <h1 className="auth-title">
          {isLoginView ? "AI Destekli Online Sınav Sistemi" : "Kayıt Oluştur"}
        </h1>

        {error && (
          <div className="auth-error" style={{ color: "red", marginBottom: "15px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLoginView && (
            <div className="form-group">
              <label htmlFor="auth-name">Ad Soyad</label>
              <input
                id="auth-name"
                type="text"
                className="form-input"
                placeholder="Ad Soyad"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required={!isLoginView}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">E-posta</label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="ornek@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Şifre</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {!isLoginView && (
            <div className="form-group">
              <label htmlFor="auth-role">Rol</label>
              <select
                id="auth-role"
                className="form-input"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="student">Öğrenci</option>
                <option value="instructor">Eğitmen</option>
              </select>
            </div>
          )}

          {!isLoginView && role === "instructor" && (
            <div className="form-group">
              <label htmlFor="auth-instructor-code">Eğitmen Kayıt Kodu</label>
              <input
                id="auth-instructor-code"
                type="text"
                className="form-input"
                placeholder="Admin tarafından verilen kod"
                value={instructorCode}
                onChange={(event) => setInstructorCode(event.target.value)}
                required={role === "instructor"}
              />
            </div>
          )}

          <div className="auth-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Bekleyiniz..." : isLoginView ? "Giriş Yap" : "Hesap Oluştur"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={toggleView}>
              {isLoginView ? "Kayıt Ol" : "Vazgeç"}
            </button>
          </div>

          {isLoginView && (
            <button type="button" className="auth-forgot">
              Yardım / Şifremi Unuttum
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
