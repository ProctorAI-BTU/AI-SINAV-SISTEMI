import React, { useState, useEffect } from "react";
import Login from "./pages/Login.jsx";
import InstructorDashboard from "./pages/InstructorDashboard.jsx";
import ExamRoom from "./pages/ExamRoom.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import PreExamCheck from "./pages/PreExamCheck.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import authService from "./services/auth.js";

export default function App() {
  const [page, setPage] = useState("login");
  const [pageParams, setPageParams] = useState({});
  const [user, setUser] = useState(null);

  // ─── B2B iframe iletişim köprüsü ──────────────────────
  const isEmbedded = window.self !== window.top;

  // Parent'a mesaj gönder
  const postToParent = (type, data = {}) => {
    if (isEmbedded && window.parent) {
      window.parent.postMessage({ type: 'PROCTOR_EVENT', event: type, data }, '*');
    }
  };

  useEffect(() => {
    if (authService.isAuthenticated()) {
      const savedUser = authService.getCurrentUser();

      if (savedUser) {
        setUser(savedUser);

        const role = savedUser.role;

        if (role === "admin" || role === "instructor") {
          setPage("instructor-dashboard");
        } else {
          // Öğrenci giriş yaptıysa önce sınav kodu girilen home ekranına gider
          setPage("student-home");
        }

        postToParent('user-authenticated', { role, name: savedUser.name });
      }
    }

    // iframe'e gelen mesajları dinle (parent → iframe)
    if (isEmbedded) {
      const handleParentMessage = (event) => {
        if (!event.data || event.data.type !== 'PROCTOR_COMMAND') return;
        
        const { command, data } = event.data;
        switch (command) {
          case 'set-exam-code':
            if (data?.examCode) {
              handleNavigate('student-home', { examCode: data.examCode });
            }
            break;
          case 'navigate':
            if (data?.page) {
              handleNavigate(data.page, data.params || {});
            }
            break;
          case 'logout':
            handleLogout();
            break;
          default:
            console.log('[B2B] Bilinmeyen komut:', command);
        }
      };

      window.addEventListener('message', handleParentMessage);
      window.parent.postMessage({ type: 'PROCTOR_READY', version: '1.0.0' }, '*');

      return () => window.removeEventListener('message', handleParentMessage);
    }
  }, []);

  const handleNavigate = (target, params = {}) => {
    const currentUser = authService.getCurrentUser();

    if (currentUser) {
      setUser(currentUser);

      const role = currentUser.role;

      // Öğrenci admin/eğitmen ekranlarına giremesin
      if (
        role === "student" &&
        (
          target === "instructor-dashboard" ||
          target === "admin-dashboard" ||
          target === "admin-panel"
        )
      ) {
        console.warn("[Güvenlik] Öğrenci admin sayfasına erişemez!");
        target = "student-home";
      }

      // Admin/eğitmen sınav odasına gitmesin
      if ((role === "admin" || role === "instructor") && target === "exam-room") {
        target = "instructor-dashboard";
      }
    }

    setPageParams(params);
    setPage(target);
    postToParent('page-navigate', { page: target });
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setPageParams({});
    setPage("login");
    postToParent('user-logout', {});
  };

  switch (page) {
    case "login":
      return <Login onNavigate={handleNavigate} />;

    case "student-home":
      return (
        <StudentHome
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );

    case "instructor-dashboard":
      return (
        <InstructorDashboard
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );

    case "admin-dashboard":
    case "admin-panel":
      return (
        <AdminPanel
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );

    case "pre-exam-check":
      return (
        <PreExamCheck
          examTitle={pageParams.examTitle || pageParams.exam?.title || "Sınav"}
          onComplete={() =>
            handleNavigate("exam-room", {
              ...pageParams,
              precheckPassed: true,
              autoStart: true,
            })
          }
        />
      );

    case "exam-room":
      return (
        <ExamRoom
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          precheckPassed={pageParams.precheckPassed}
          autoStart={pageParams.autoStart}
          examCode={pageParams.examCode}
          questions={pageParams.questions}
          exam={pageParams.exam}
          session={pageParams.session}
        />
      );

    case "report":
      return (
        <ReportDetail
          onNavigate={handleNavigate}
          sessionId={pageParams.sessionId}
        />
      );

    case "report-detail":
      return (
        <ReportDetail
          onNavigate={handleNavigate}
          sessionId={typeof pageParams === "string" ? pageParams : pageParams.sessionId}
        />
      );

    default:
      return <Login onNavigate={handleNavigate} />;
  }
}