import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ExamTimer from "../components/Exam/ExamTimer";
import QuestionCard from "../components/Exam/QuestionCard";
import SubmitButton from "../components/Exam/SubmitButton";
import StatusIndicator from "../components/Proctoring/StatusIndicator";
import CameraFeed from "../components/Proctoring/CameraFeed";
import MicMonitor from "../components/Proctoring/MicMonitor";
import useProctoring from "../hooks/useProctoring.js";
import examService from "../services/exam.js";
import proctoringService from "../services/proctoring.js";
import authService from "../services/auth.js";
import { MAX_BROWSER_VIOLATIONS, buildViolationAlert } from "../services/alert.js";
import "../styles/exam.css";
import "../styles/modal.css";

const FALLBACK_EXAM = {
  _id: "demo-exam",
  title: "Demo Sınav",
  duration: 45,
  accessCode: "DEMO01",
};

const FALLBACK_QUESTIONS = [
  {
    _id: "q_mock1",
    text: "(Demo) Aşağıdaki integrali çözünüz: ∫x² dx",
    options: ["A) x³/3 + C", "B) x³ + C", "C) 2x + C", "D) x²/2 + C"],
  },
  {
    _id: "q_mock2",
    text: "(Demo) Hangi dilde 'print' komutu ekrana yazı yazdırmak için kullanılır?",
    options: ["A) Python", "B) HTML", "C) CSS", "D) SQL"],
  },
];

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function questionIdFor(question, index) {
  return question?._id || question?.id || `question_${index}`;
}

/**
 * Sınav geçmişini localStorage'a kaydeder.
 * Her kullanıcı için ayrı bir key kullanılır.
 */
function saveStudentExamHistory(user, exam, sessionId, status, riskScore = "-") {
  const userKey = user?.id || user?.email || "student-1";
  const storageKey = `studentExamHistory_${userKey}`;

  let currentHistory = [];

  try {
    const savedHistory = localStorage.getItem(storageKey);
    currentHistory = savedHistory ? JSON.parse(savedHistory) : [];

    if (!Array.isArray(currentHistory)) {
      currentHistory = [];
    }
  } catch (error) {
    console.warn("Sınav geçmişi okunamadı:", error.message);
    currentHistory = [];
  }

  const newRecord = {
    id: sessionId || `session_${Date.now()}`,
    title: exam?.title || exam?.name || "Sınav",
    code: exam?.accessCode || exam?.code || "-",
    date: new Date().toISOString(),
    score: riskScore ?? "-",
    status:
      status === "terminated"
        ? "Sonlandırıldı"
        : status === "auto_submitted"
          ? "Süre Doldu"
          : "Tamamlandı",
  };

  const filteredHistory = currentHistory.filter(
    (item) => item.id !== newRecord.id
  );

  const nextHistory = [newRecord, ...filteredHistory].slice(0, 50);

  localStorage.setItem(storageKey, JSON.stringify(nextHistory));

  console.log("[ExamRoom] Sınav geçmişe kaydedildi:", {
    storageKey,
    newRecord,
    nextHistory,
  });
}

export default function ExamRoom({
  onNavigate,
  onLogout,
  examCode: initialExamCode = "",
  autoStart = false,
  precheckPassed = false,
  questions: initialQuestions = [],
  exam: initialExam = null,
  session: initialSession = null,
}) {
  const [warning, setWarning] = useState(null);
  const [examCode, setExamCode] = useState(initialExamCode);
  const [activeExam, setActiveExam] = useState(initialExam || FALLBACK_EXAM);
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(initialSession?.answers || {});
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(initialSession?.remainingSeconds || 0);
  const [proctoringStarted, setProctoringStarted] = useState(false);
  const [finishState, setFinishState] = useState({
    finishing: false,
    finished: false,
  });
  const [sessionId, setSessionId] = useState(
    () => initialSession?.sessionId || `session_${Date.now()}`
  );

  const autoStartedRef = useRef(false);
  const lastWarningCountRef = useRef(0);
  const terminationTriggeredRef = useRef(false);
  const currentUser = authService.getCurrentUser();

  const sessionMeta = useMemo(
    () => ({
      sessionId,
      examId: activeExam?._id || FALLBACK_EXAM._id,
      examTitle: activeExam?.title || FALLBACK_EXAM.title,
      examCode: activeExam?.accessCode || examCode || "",
      instructorId: activeExam?.instructorId || null,
      studentId: currentUser?.id || "student-1",
      studentName: currentUser?.name || "Demo Öğrenci",
    }),
    [activeExam, currentUser?.id, currentUser?.name, examCode, sessionId]
  );

  const proctoring = useProctoring(sessionId, sessionMeta);

  const handleFinishExam = useCallback(
    async (status = "submitted") => {
      if (finishState.finishing || finishState.finished) return;

      // Sınav geçmişini localStorage'a kaydet
      saveStudentExamHistory(
        currentUser,
        activeExam || FALLBACK_EXAM,
        sessionId,
        status,
        "-"
      );

      setFinishState({ finishing: true, finished: false });
      setWarning(null);
      proctoring.stopProctoring();

      const finishEventType =
        status === "terminated" ? "SESSION_TERMINATED" : "SESSION_COMPLETED";

      const finishMessage =
        status === "terminated"
          ? "Oturum ihlal nedeniyle sonlandırıldı."
          : "Öğrenci sınavı bitirdi.";

      const eventRisk = await proctoringService.sendEvent(sessionId, finishEventType, {
        ...sessionMeta,
        source: "exam",
        message: finishMessage,
      });

      const riskScore =
        eventRisk?.risk_score ?? proctoring.riskData?.risk_score ?? 0;

      const riskLevel =
        eventRisk?.risk_level ?? proctoring.riskData?.risk_level ?? "LOW";

      const eventCounts =
        eventRisk?.event_counts ?? proctoring.riskData?.event_counts ?? {};

      const proctoringSummary = {
        face: proctoring.faceResult,
        gaze: proctoring.gazeResult,
        violations: proctoring.violations,
      };

      try {
        await examService.finishSession(
          activeExam?._id || FALLBACK_EXAM._id,
          sessionId,
          {
            answers,
            riskScore,
            riskLevel,
            eventCounts,
            proctoringSummary,
            status,
          }
        );
      } catch (err) {
        console.warn("Sınav bitirme API hatası:", err.message);
      }

      await proctoringService.completeSession(sessionId, {
        answers,
        status,
        riskScore,
        riskLevel,
        eventCounts,
        summary: proctoringSummary,
      });

      setFinishState({ finishing: false, finished: true });
      // Yönlendirme artık return () ekranındaki butona bırakıldı.
    },
    [
      activeExam,
      answers,
      currentUser,
      finishState.finished,
      finishState.finishing,
      proctoring,
      sessionId,
      sessionMeta,
    ]
  );

  const handleStartProctoring = useCallback(async () => {
    if (loading || proctoringStarted) return;

    setLoading(true);
    setStartError("");

    try {
      const canRequestFullscreen =
        typeof document.documentElement.requestFullscreen === "function";

      if (!document.fullscreenElement && canRequestFullscreen) {
        await proctoring.requestFullscreen();
      }

      if (!document.fullscreenElement && canRequestFullscreen) {
        throw new Error("Tam ekran onayı alınmadan sınav başlatılamaz.");
      }

      const student = {
        studentId: currentUser?.id || "student-1",
        studentName: currentUser?.name || "Demo Öğrenci",
      };

      let startResponse = null;
      const code = examCode.trim().toUpperCase();

      if (code) {
        startResponse = await examService.joinByCode(code, student);
      } else {
        startResponse = await examService.startSession(FALLBACK_EXAM._id, student);
      }

      const exam = startResponse?.exam || FALLBACK_EXAM;

      const session = startResponse?.session || {
        sessionId: `session_${Date.now()}`,
        remainingSeconds: (exam.duration || FALLBACK_EXAM.duration) * 60,
        answers: {},
      };

      const nextSessionId = session.sessionId;

      const nextMeta = {
        sessionId: nextSessionId,
        examId: exam._id,
        examTitle: exam.title,
        examCode: exam.accessCode || code,
        instructorId: exam.instructorId || null,
        studentId: student.studentId,
        studentName: student.studentName,
      };

      setActiveExam(exam);
      setSessionId(nextSessionId);
      setRemainingSeconds(
        session.remainingSeconds || (exam.duration || FALLBACK_EXAM.duration) * 60
      );
      setAnswers(session.answers || {});

      let fetchedQuestions = startResponse?.questions || [];

      if (!fetchedQuestions.length && exam?._id && exam._id !== FALLBACK_EXAM._id) {
        try {
          const questionsRes = await fetch(`/api/exams/${exam._id}/questions`).then(
            (r) => r.json()
          );
          fetchedQuestions = questionsRes.questions || [];
        } catch (err) {
          console.warn("Sorular çekilemedi:", err.message);
        }
      }

      setQuestions(
        fetchedQuestions.length
          ? fetchedQuestions
          : (initialQuestions && initialQuestions.length ? initialQuestions : FALLBACK_QUESTIONS)
      );

      await proctoringService.startSession({
        ...nextMeta,
        status: "active",
      });

      await proctoring.startProctoring(nextSessionId, nextMeta);
      setProctoringStarted(true);
    } catch (err) {
      setStartError(err.message || "Sınav başlatılamadı.");
    } finally {
      setLoading(false);
    }
  }, [
    currentUser?.id,
    currentUser?.name,
    examCode,
    loading,
    proctoring,
    proctoringStarted,
    initialQuestions,
    initialExam,
    initialSession,
  ]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || proctoringStarted || loading) {
      return;
    }

    autoStartedRef.current = true;
    handleStartProctoring();
  }, [autoStart, handleStartProctoring, loading, proctoringStarted]);

  useEffect(() => {
    if (!proctoringStarted || finishState.finished) return undefined;

    const timer = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          handleFinishExam("auto_submitted");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finishState.finished, handleFinishExam, proctoringStarted]);

  useEffect(() => {
    if (!proctoringStarted || finishState.finished || finishState.finishing) {
      return undefined;
    }

    const reportBrowserEvent = (eventType, event) => {
      event.preventDefault();

      proctoringService.sendEvent(sessionId, eventType, {
        ...sessionMeta,
        source: "browser",
        message: eventType,
      });
    };

    const handleContextMenu = (event) =>
      reportBrowserEvent("RIGHT_CLICK_ATTEMPT", event);

    const handleCopyPaste = (event) =>
      reportBrowserEvent("COPY_PASTE_ATTEMPT", event);

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      const blocked =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && ["u", "s", "p"].includes(key));

      if (blocked) {
        reportBrowserEvent("SHORTCUT_ATTEMPT", event);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    finishState.finished,
    finishState.finishing,
    proctoringStarted,
    sessionId,
    sessionMeta,
  ]);

  const maxViolations = MAX_BROWSER_VIOLATIONS;
  const totalViolations = Math.min(proctoring.violationCount, maxViolations);

  useEffect(() => {
    if (!proctoringStarted || finishState.finished || finishState.finishing) {
      return;
    }

    if (proctoring.violationCount <= lastWarningCountRef.current) {
      return;
    }

    const count = Math.min(proctoring.violationCount, maxViolations);
    lastWarningCountRef.current = proctoring.violationCount;

    setWarning(
      buildViolationAlert({
        count,
        isFullscreen: proctoring.isFullscreen,
        isTabVisible: proctoring.isTabVisible,
      })
    );

    if (count >= maxViolations && !terminationTriggeredRef.current) {
      terminationTriggeredRef.current = true;
      window.setTimeout(() => handleFinishExam("terminated"), 900);
    }
  }, [
    finishState.finished,
    finishState.finishing,
    handleFinishExam,
    maxViolations,
    proctoring.isFullscreen,
    proctoring.isTabVisible,
    proctoring.violationCount,
    proctoringStarted,
  ]);

  // Tam ekrandan çıkıldığında anında uyarı ver
  useEffect(() => {
    if (!proctoringStarted || finishState.finished || finishState.finishing) {
      return;
    }

    if (!proctoring.isFullscreen) {
      setWarning((currentWarning) => {
        if (currentWarning) return currentWarning;

        return buildViolationAlert({
          count: Math.min(proctoring.violationCount || 1, maxViolations),
          isFullscreen: false,
          isTabVisible: proctoring.isTabVisible,
        });
      });
    }
  }, [
    finishState.finished,
    finishState.finishing,
    maxViolations,
    proctoring.isFullscreen,
    proctoring.isTabVisible,
    proctoring.violationCount,
    proctoringStarted,
  ]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionId = questionIdFor(currentQuestion, currentQuestionIndex);
  const faceDetected = proctoring.faceResult?.face_detected === true;

  // Fullscreen da zorunlu kontrol olarak eklendi
  const examBlocked =
    proctoringStarted &&
    (!proctoring.cameraActive || !faceDetected || !proctoring.isFullscreen);

  const blockMessage = !proctoring.isFullscreen
    ? "Tam ekran modundan çıkıldı. Sınava devam etmek için tam ekrana dönmelisiniz."
    : !proctoring.cameraActive
      ? "Kamera bağlantısı bekleniyor. Sınava devam etmek için kamera açık kalmalı."
      : proctoring.faceResult
        ? "Yüz algılanmadı. Devam etmek için yüzünüzü kameraya gösterin."
        : "Yüz onayı bekleniyor. Lütfen kameraya bakın.";

  const handleOptionSelect = useCallback(
    (optIndex) => {
      if (!currentQuestionId || examBlocked || finishState.finishing) return;

      setAnswers((prev) => ({
        ...prev,
        [currentQuestionId]: optIndex,
      }));

      examService.submitAnswer(sessionId, currentQuestionId, optIndex).catch((err) => {
        console.warn("Cevap kaydedilemedi:", err.message);
      });
    },
    [currentQuestionId, examBlocked, finishState.finishing, sessionId]
  );

  const goPrevious = () => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1));
  };

  // autoStart veya precheckPassed ise başlangıç ekranını gizle (ama hata varsa göster ki kilitlenmesin)
  const shouldHideStartScreen = (autoStart || precheckPassed || loading) && !startError;

  if (finishState.finished) {
    const role = authService.getUserRole();

    const handleReturn = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => console.log(err));
      }

      onNavigate(
        role === "admin" || role === "instructor"
          ? "instructor-dashboard"
          : "student-home"
      );
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#111116",
          color: "white",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0, 200, 83, 0.1)",
            border: "1px solid #00c853",
            borderRadius: "10px",
            padding: "3rem",
            maxWidth: "600px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <h1
            style={{
              color: "#00c853",
              marginBottom: "1rem",
              fontSize: "2.5rem",
            }}
          >
            Sınav Bitti
          </h1>

          <p
            style={{
              fontSize: "1.1rem",
              marginBottom: "2.5rem",
              color: "#ccc",
              lineHeight: "1.6",
            }}
          >
            Cevaplarınız ve değerlendirme raporlarınız başarıyla sistemimize
            kaydedildi. Katılımınız için teşekkür ederiz.
          </p>

          <button
            onClick={handleReturn}
            style={{
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              backgroundColor: "#3f8cf4",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "bold",
              width: "100%",
            }}
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CameraFeed
        videoRef={proctoring.videoRef}
        isProctoringStarted={proctoringStarted}
      />

      <MicMonitor
        stream={proctoring.stream}
        sessionId={sessionId}
        isProctoringStarted={proctoringStarted}
        eventPayload={sessionMeta}
      />

      {!proctoringStarted ? (
        shouldHideStartScreen ? (
          <div
            style={{
              width: "100vw",
              height: "100vh",
              backgroundColor: "#111116",
            }}
          />
        ) : (
          <div className="exam-layout">
            <header className="exam-header exam-header--with-nav">
              <div className="exam-header-left">
                <div className="exam-logo">AI</div>
                <div>
                  <div className="exam-title-text">Sınav Öncesi Hazırlık</div>
                  <div className="exam-user-text">
                    {currentUser?.name || "Öğrenci"}
                  </div>
                </div>
              </div>

              <nav className="exam-navbar">
                <button
                  className="exam-navbar-link exam-navbar-link--active"
                  type="button"
                >
                  Sınav
                </button>

                <button
                  className="exam-navbar-link"
                  type="button"
                  onClick={() => onNavigate?.("student-home")}
                >
                  Öğrenci Paneli
                </button>

                {onLogout && (
                  <button
                    className="exam-navbar-link"
                    type="button"
                    onClick={onLogout}
                  >
                    Çıkış
                  </button>
                )}
              </nav>
            </header>

            <div className="exam-start-screen">
              <div className="exam-logo exam-logo--large">AI</div>

              <h2>Sınava Başlamadan Önce</h2>

              <p className="exam-start-copy">
                Kamera, mikrofon, tam ekran ve yüz doğrulaması tamamlandıktan
                sonra sınav başlar.
              </p>

              {!precheckPassed && (
                <p className="exam-start-note">
                  Gerçek sınav için önce sınav öncesi kontrol ekranından geçmeniz
                  gerekir.
                </p>
              )}

              <div className="form-group exam-code-group">
                <label>Sınav Kodu</label>
                <input
                  className="form-input"
                  value={examCode}
                  onChange={(event) =>
                    setExamCode(event.target.value.toUpperCase())
                  }
                  placeholder="Örn: DEMO01"
                />
              </div>

              {startError && <div className="exam-start-error">{startError}</div>}

              <button
                className="btn-primary"
                onClick={handleStartProctoring}
                disabled={loading}
              >
                {loading ? "Başlatılıyor..." : "Sınavı Başlat"}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="exam-layout">
          <header className="exam-header exam-header--with-nav">
            <div className="exam-header-left">
              <div className="exam-logo">AI</div>
              <div>
                <div className="exam-title-text">
                  Sınav: {activeExam?.title || FALLBACK_EXAM.title}
                </div>
                <div className="exam-user-text">
                  {currentUser?.name || "Öğrenci"}
                </div>
              </div>
            </div>

            <nav className="exam-navbar">
              <button
                className="exam-navbar-link exam-navbar-link--active"
                type="button"
              >
                Sınav Ekranı
              </button>

              <button
                className="exam-navbar-link"
                type="button"
                disabled
                title="Sınav devam ederken panel kapalıdır"
              >
                Öğrenci Paneli
              </button>
            </nav>

            <div className="exam-header-right">
              <ExamTimer time={formatDuration(remainingSeconds)} />
            </div>
          </header>

          <div className="exam-status-bar">
            <StatusIndicator
              type="camera"
              status={proctoring.cameraActive ? "active" : "inactive"}
            />

            <StatusIndicator
              type="face"
              status={faceDetected ? "active" : "inactive"}
            />

            <StatusIndicator
              type="gaze"
              status={
                proctoring.gazeResult?.gaze === "screen" ? "active" : "inactive"
              }
              detail={
                proctoring.gazeResult
                  ? `Bakış: ${
                      proctoring.gazeResult.gaze === "screen"
                        ? "Ekranda"
                        : "Ekran dışı"
                    }`
                  : undefined
              }
            />

            <StatusIndicator
              type="fullscreen"
              status={proctoring.isFullscreen ? "active" : "inactive"}
            />

            <span className="violation-pill">
              İhlal: {totalViolations} / {maxViolations}
            </span>
          </div>

          <main className={`exam-main ${examBlocked ? "exam-main--blocked" : ""}`}>
            {questions.length > 0 ? (
              <>
                <div className="question-counter">
                  Soru {currentQuestionIndex + 1} / {questions.length}
                </div>

                <QuestionCard
                  question={currentQuestion}
                  selectedOption={answers[currentQuestionId]}
                  onOptionSelect={handleOptionSelect}
                  disabled={examBlocked || finishState.finishing}
                />

                <div className="exam-nav">
                  <button
                    className="btn-exam btn-exam--prev"
                    disabled={currentQuestionIndex === 0 || examBlocked}
                    onClick={goPrevious}
                  >
                    Önceki
                  </button>

                  <div className="exam-nav-right">
                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        className="btn-exam btn-exam--next"
                        disabled={examBlocked}
                        onClick={goNext}
                      >
                        Sonraki
                      </button>
                    ) : (
                      <SubmitButton
                        onSubmit={() => handleFinishExam("submitted")}
                        disabled={finishState.finishing || examBlocked}
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="question-card question-card--empty">
                Yükleniyor...
              </div>
            )}
          </main>

          {examBlocked && (
            <div className="exam-blocker">
              <div className="exam-blocker-box">
                <strong>Sınav duraklatıldı</strong>
                <p>{blockMessage}</p>
              </div>
            </div>
          )}

          {warning && (
            <div className="modal-overlay">
              <div className="modal-box">
                <div className="modal-header">
                  <span className="modal-warn-icon">!</span>
                  <h3 className="modal-title">
                    {warning.terminating
                      ? "Sınav Sonlandırılıyor"
                      : "Kural İhlali"}
                  </h3>
                </div>

                <div className="modal-body">
                  {warning.messages.map((message) => (
                    <p className="modal-line" key={message}>
                      {message}
                    </p>
                  ))}

                  <p className="modal-violation">
                    İhlal sayısı: {warning.count} / {maxViolations}
                  </p>

                  {warning.terminating && (
                    <p className="modal-line">
                      Maksimum ihlal sayısına ulaşıldığı için oturum kapatılıyor.
                    </p>
                  )}
                </div>

                {!warning.terminating && (
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      if (!proctoring.isFullscreen) {
                        const fullscreenOpened =
                          await proctoring.requestFullscreen();

                        if (!fullscreenOpened) {
                          return;
                        }
                      }

                      setWarning(null);
                    }}
                  >
                    {proctoring.isFullscreen ? "Devam Et" : "Tam Ekrana Dön"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
