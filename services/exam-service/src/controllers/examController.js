const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const timerService = require('../services/timerService');
const { isMongoConnected } = require('../config/db');

const memoryExams = [];
const memorySubmissions = [];
const memoryQuestions = [];

exports.memoryQuestions = memoryQuestions;

function createMemoryId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generateAccessCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function isExamOpen(exam) {
  const now = Date.now();
  const startTime = exam.startTime ? new Date(exam.startTime).getTime() : null;
  const endTime = exam.endTime ? new Date(exam.endTime).getTime() : null;

  if (!['published', 'active'].includes(exam.status || 'draft')) return false;
  if (startTime && now < startTime) return false;
  if (endTime && now > endTime) return false;
  return true;
}

function createSessionPayload(exam, student = {}) {
  const sessionId = `${exam._id}-${student.studentId || 'anonymous'}-${Date.now()}`;
  const startedAt = new Date();
  const duration = Number(exam.duration || 30);
  const expiresAt = new Date(startedAt.getTime() + duration * 60 * 1000);

  return {
    sessionId,
    examId: String(exam._id),
    examTitle: exam.title,
    examCode: exam.accessCode || '',
    instructorId: exam.instructorId || null,
    studentId: student.studentId || null,
    studentName: student.studentName || '',
    startedAt,
    expiresAt,
    remainingSeconds: duration * 60,
  };
}

function serializeSubmission(submission) {
  if (!submission) return null;
  return typeof submission.toObject === 'function' ? submission.toObject() : submission;
}

function getSubmissionExpiresAt(submission, exam) {
  const plain = serializeSubmission(submission);
  if (!plain) return null;
  if (plain.expiresAt) return new Date(plain.expiresAt);
  const startedAt = plain.startedAt ? new Date(plain.startedAt) : new Date();
  const duration = Number(exam?.duration || 30);
  return new Date(startedAt.getTime() + duration * 60 * 1000);
}

function getRemainingSecondsFromSubmission(submission, exam) {
  const expiresAt = getSubmissionExpiresAt(submission, exam);
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

function buildSessionFromSubmission(submission, exam) {
  const plain = serializeSubmission(submission);
  const expiresAt = getSubmissionExpiresAt(plain, exam);

  return {
    sessionId: plain.sessionId,
    examId: String(plain.examId || exam?._id || ''),
    examTitle: plain.examTitle || exam?.title || '',
    examCode: exam?.accessCode || '',
    instructorId: exam?.instructorId || null,
    studentId: plain.studentId || null,
    studentName: plain.studentName || '',
    startedAt: plain.startedAt,
    expiresAt,
    remainingSeconds: getRemainingSecondsFromSubmission(plain, exam),
    answers: plain.answers || {},
    resumed: true,
  };
}

function isFinalSubmissionStatus(status) {
  return ['submitted', 'auto_submitted', 'terminated'].includes(status);
}

async function findLatestSubmission(exam, student = {}) {
  const examId = String(exam._id);
  const studentId = student.studentId || null;
  const studentName = student.studentName || '';

  if (isMongoConnected()) {
    const query = { 
      examId: { $in: [exam._id, examId] } 
    };
    if (studentId) query.studentId = studentId;
    else query.studentName = studentName;

    return Submission.findOne(query).sort({ createdAt: -1 });
  }

  return [...memorySubmissions]
    .filter((item) => String(item.examId) === examId)
    .filter((item) => (studentId ? item.studentId === studentId : item.studentName === studentName))
    .sort((a, b) => new Date(b.createdAt || b.startedAt || 0) - new Date(a.createdAt || a.startedAt || 0))[0] || null;
}

async function markSubmissionExpired(submission) {
  const plain = serializeSubmission(submission);
  if (!plain?.sessionId) return;

  timerService.clearTimer(plain.sessionId);

  if (isMongoConnected()) {
    await Submission.findOneAndUpdate(
      { sessionId: plain.sessionId, status: 'started' },
      { $set: { status: 'auto_submitted', submittedAt: new Date() } }
    );
    return;
  }

  const index = memorySubmissions.findIndex((item) => item.sessionId === plain.sessionId);
  if (index >= 0 && memorySubmissions[index].status === 'started') {
    memorySubmissions[index] = {
      ...memorySubmissions[index],
      status: 'auto_submitted',
      submittedAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

async function autoExpireStartedSubmissions() {
  try {
    const now = new Date();
    if (isMongoConnected()) {
      const result = await Submission.updateMany(
        { status: 'started', expiresAt: { $lt: now } },
        { $set: { status: 'auto_submitted', submittedAt: now } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Auto-Expire] ${result.modifiedCount} adet suresi dolmus sinav oturumu otomatik olarak sonlandirildi.`);
      }
    } else {
      let expiredCount = 0;
      memorySubmissions.forEach((sub, index) => {
        if (sub.status === 'started' && sub.expiresAt && new Date(sub.expiresAt) < now) {
          memorySubmissions[index] = {
            ...sub,
            status: 'auto_submitted',
            submittedAt: now,
            updatedAt: now,
          };
          expiredCount++;
        }
      });
      if (expiredCount > 0) {
        console.log(`[Auto-Expire Memory] ${expiredCount} adet suresi dolmus sinav oturumu otomatik olarak sonlandirildi.`);
      }
    }
  } catch (err) {
    console.error('[Auto-Expire Error] Suresi dolmus sinavlar kapatilirken hata olustu:', err.message);
  }
}

setInterval(autoExpireStartedSubmissions, 15000);

async function loadQuestionsForExam(examId) {
  if (isMongoConnected()) {
    return Question.find({ examId }).sort({ orderIndex: 1 });
  }
  return memoryQuestions
    .filter((q) => String(q.examId) === String(examId))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function normalizeAnswers(answers = {}) {
  if (!answers || typeof answers !== 'object') return {};
  return answers;
}

exports.serviceInfo = async (req, res) => {
  return res.json({
    success: true,
    service: 'exam-service',
    status: 'ok',
    database: isMongoConnected() ? 'mongodb' : 'memory-fallback',
    message: 'Exam Service iskeleti çalışıyor.',
  });
};

exports.createExam = async (req, res, next) => {
  try {
    const {
      title,
      description,
      duration,
      instructorId,
      status,
      startTime,
      endTime,
      accessCode,
      allowedStudentIds,
      questions,
    } = req.body;

    if (!title || !duration) {
      return res.status(400).json({
        success: false,
        message: 'title ve duration alanları zorunludur.',
      });
    }

    if (isMongoConnected()) {
      const exam = await Exam.create({
        title,
        description,
        duration,
        instructorId,
        status: status || 'draft',
        startTime,
        endTime,
        accessCode: accessCode ? normalizeCode(accessCode) : undefined,
        allowedStudentIds: Array.isArray(allowedStudentIds) ? allowedStudentIds : [],
      });

      if (Array.isArray(questions) && questions.length > 0) {
        const questionDocs = questions.map((q, idx) => ({
          examId: exam._id,
          type: q.type || 'multiple_choice',
          content: q.content || q.question || q.text || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : null,
          points: q.points || 10,
          orderIndex: idx,
        }));
        await Question.insertMany(questionDocs);
      }

      return res.status(201).json({
        success: true,
        message: 'Sınav oluşturuldu.',
        exam,
      });
    }

    const exam = {
      _id: createMemoryId(),
      title,
      description: description || '',
      duration,
      instructorId: instructorId || null,
      status: status || 'draft',
      startTime: startTime || null,
      endTime: endTime || null,
      accessCode: accessCode ? normalizeCode(accessCode) : generateAccessCode(),
      allowedStudentIds: Array.isArray(allowedStudentIds) ? allowedStudentIds : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryExams.push(exam);

    if (Array.isArray(questions) && questions.length > 0) {
      questions.forEach((q, idx) => {
        memoryQuestions.push({
          _id: createMemoryId(),
          examId: exam._id,
          type: q.type || 'multiple_choice',
          content: q.content || q.question || q.text || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : null,
          points: q.points || 10,
          orderIndex: idx,
        });
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sınav memory modda oluşturuldu.',
      exam,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getExams = async (req, res, next) => {
  try {
    if (isMongoConnected()) {
      const exams = await Exam.find().sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: exams.length,
        exams,
      });
    }

    return res.json({
      success: true,
      count: memoryExams.length,
      exams: memoryExams,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getExamByCode = async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code);

    if (isMongoConnected()) {
      const exam = await Exam.findOne({ accessCode: code });

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Kod ile eslesen sinav bulunamadi.',
        });
      }

      const questions = await Question.find({ examId: exam._id }).sort({ orderIndex: 1 });

      return res.json({
        success: true,
        exam,
        questions,
        isOpen: isExamOpen(exam),
      });
    }

    const exam = memoryExams.find((item) => item.accessCode === code);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Kod ile eslesen sinav bulunamadi.',
      });
    }

    return res.json({
      success: true,
      exam,
      questions: [],
      isOpen: isExamOpen(exam),
    });
  } catch (error) {
    return next(error);
  }
};

exports.joinExamByCode = async (req, res, next) => {
  try {
    const code = normalizeCode(req.body.code);
    const { studentId, studentName } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Sinav kodu zorunludur.',
      });
    }

    const exam = isMongoConnected()
      ? await Exam.findOne({ accessCode: code })
      : memoryExams.find((item) => item.accessCode === code);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Sinav kodu gecersiz.',
      });
    }

    if (!isExamOpen(exam)) {
      return res.status(403).json({
        success: false,
        message: 'Sinav su anda aktif degil veya zaman araligi uygun degil.',
      });
    }

    if (
      Array.isArray(exam.allowedStudentIds) &&
      exam.allowedStudentIds.length > 0 &&
      studentId &&
      !exam.allowedStudentIds.includes(studentId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bu ogrenci bu sinava atanmis degil.',
      });
    }

    const existingSubmission = await findLatestSubmission(exam, { studentId, studentName });
    const questions = await loadQuestionsForExam(exam._id);

    if (existingSubmission) {
      const plainExisting = serializeSubmission(existingSubmission);

      if (isFinalSubmissionStatus(plainExisting.status)) {
        return res.status(409).json({
          success: false,
          message: 'Bu sinav bu ogrenci icin tamamlanmis veya sonlandirilmis. Ayni kodla tekrar giris yapilamaz.',
          status: plainExisting.status,
        });
      }

      if (plainExisting.status === 'started') {
        const remainingSeconds = getRemainingSecondsFromSubmission(plainExisting, exam);

        if (remainingSeconds <= 0) {
          await markSubmissionExpired(plainExisting);
          return res.status(409).json({
            success: false,
            message: 'Bu sinav oturumunun suresi dolmus. Ayni kodla tekrar giris yapilamaz.',
            status: 'auto_submitted',
          });
        }

        timerService.startTimerUntil(plainExisting.sessionId, getSubmissionExpiresAt(plainExisting, exam));

        timerService.startTimerUntil(plainExisting.sessionId, getSubmissionExpiresAt(plainExisting, exam));

        return res.status(200).json({
          success: true,
          message: 'Aktif sinav oturumu bulundu. Kaldiginiz yerden devam edebilirsiniz.',
          session: buildSessionFromSubmission(plainExisting, exam),
          exam,
          questions,
          resumed: true,
        });
      }
    }

    const session = createSessionPayload(exam, { studentId, studentName });
    timerService.startTimer(session.sessionId, exam.duration);

    if (isMongoConnected()) {
      await Submission.create({
        examId: exam._id,
        sessionId: session.sessionId,
        examTitle: exam.title,
        studentId: studentId || null,
        studentName: studentName || '',
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        status: 'started',
      });
    } else {
      memorySubmissions.push({
        _id: createMemoryId(),
        ...session,
        answers: {},
        status: 'started',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sinav oturumu baslatildi.',
      session,
      exam,
      questions,
      resumed: false,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      const exam = await Exam.findById(id);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Sınav bulunamadı.',
        });
      }

      const questions = await Question.find({ examId: id }).sort({ orderIndex: 1 });

      return res.json({
        success: true,
        exam,
        questions,
      });
    }

    const exam = memoryExams.find((item) => item._id === id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Sınav bulunamadı.',
      });
    }

    return res.json({
      success: true,
      exam,
      questions: [],
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateExam = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      const exam = await Exam.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Sınav bulunamadı.',
        });
      }

      return res.json({
        success: true,
        message: 'Sınav güncellendi.',
        exam,
      });
    }

    const examIndex = memoryExams.findIndex((item) => item._id === id);

    if (examIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sınav bulunamadı.',
      });
    }

    memoryExams[examIndex] = {
      ...memoryExams[examIndex],
      ...req.body,
      updatedAt: new Date(),
    };

    return res.json({
      success: true,
      message: 'Sınav memory modda güncellendi.',
      exam: memoryExams[examIndex],
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteExam = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      const exam = await Exam.findByIdAndDelete(id);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Sınav bulunamadı.',
        });
      }

      return res.json({
        success: true,
        message: 'Sınav silindi.',
      });
    }

    const examIndex = memoryExams.findIndex((item) => item._id === id);

    if (examIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sınav bulunamadı.',
      });
    }

    memoryExams.splice(examIndex, 1);

    return res.json({
      success: true,
      message: 'Sınav memory moddan silindi.',
    });
  } catch (error) {
    return next(error);
  }
};

exports.startExamSkeleton = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId, studentName } = req.body;

    let duration = 30;
    let exam = null;

    if (isMongoConnected()) {
      exam = await Exam.findById(id);

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Sınav bulunamadı.',
        });
      }

      duration = exam.duration;
    } else {
      exam = memoryExams.find((item) => item._id === id);
      duration = exam?.duration || 30;
    }

    if (!exam) {
      exam = {
        _id: id,
        title: 'Demo Sinav',
        duration,
        instructorId: null,
        accessCode: 'DEMO01',
      };
    }

    const existingSubmission = await findLatestSubmission(exam, { studentId, studentName });
    if (existingSubmission) {
      const plainExisting = serializeSubmission(existingSubmission);

      if (isFinalSubmissionStatus(plainExisting.status)) {
        return res.status(409).json({
          success: false,
          message: 'Bu sinav bu ogrenci icin tamamlanmis veya sonlandirilmis. Ayni oturum tekrar baslatilamaz.',
          status: plainExisting.status,
        });
      }

      if (plainExisting.status === 'started') {
        const remainingSeconds = getRemainingSecondsFromSubmission(plainExisting, exam);
        if (remainingSeconds <= 0) {
          await markSubmissionExpired(plainExisting);
          return res.status(409).json({
            success: false,
            message: 'Bu sinav oturumunun suresi dolmus.',
            status: 'auto_submitted',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Aktif sinav oturumu bulundu. Kaldiginiz yerden devam edebilirsiniz.',
          session: buildSessionFromSubmission(plainExisting, exam),
          exam,
          questions: await loadQuestionsForExam(exam._id),
          resumed: true,
        });
      }
    }

    const session = createSessionPayload(exam, { studentId, studentName });
    const timer = timerService.startTimer(session.sessionId, duration);

    if (isMongoConnected()) {
      await Submission.findOneAndUpdate(
        { sessionId: session.sessionId },
        {
          $setOnInsert: {
            examId: exam._id,
            sessionId: session.sessionId,
            examTitle: exam.title,
            studentId: studentId || null,
            studentName: studentName || '',
            startedAt: timer.startedAt,
            expiresAt: timer.expiresAt,
            status: 'started',
          },
        },
        { upsert: true, new: true }
      );
    } else {
      memorySubmissions.push({
        _id: createMemoryId(),
        ...session,
        answers: {},
        status: 'started',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sınav başlatma iskeleti çalıştı. Detay endpoint Mehmet/Koray görevinde geliştirilecek.',
      session: {
        ...session,
        startedAt: timer.startedAt,
        expiresAt: timer.expiresAt,
        remainingSeconds: timerService.getRemainingSeconds(session.sessionId),
      },
      questions: await loadQuestionsForExam(exam._id),
      resumed: false,
    });
  } catch (error) {
    return next(error);
  }
};

exports.endExamSkeleton = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      sessionId,
      answers,
      status,
      riskScore,
      riskLevel,
      eventCounts,
      proctoringSummary,
    } = req.body;

    if (sessionId) {
      timerService.clearTimer(sessionId);
    }

    let submission = null;
    const submittedAt = new Date();

    if (sessionId && isMongoConnected()) {
      const mongoose = require('mongoose');
      submission = await Submission.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            examId: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
            sessionId,
            answers: answers || {},
            riskScore: Number(riskScore || 0),
            riskLevel: riskLevel || 'LOW',
            eventCounts: eventCounts || {},
            proctoringSummary: proctoringSummary || {},
            submittedAt,
            status: status || 'submitted',
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else if (sessionId) {
      const existingIndex = memorySubmissions.findIndex((item) => item.sessionId === sessionId);
      const nextSubmission = {
        ...(memorySubmissions[existingIndex] || { _id: createMemoryId(), examId: id, sessionId }),
        answers: answers || {},
        riskScore: Number(riskScore || 0),
        riskLevel: riskLevel || 'LOW',
        eventCounts: eventCounts || {},
        proctoringSummary: proctoringSummary || {},
        submittedAt,
        status: status || 'submitted',
      };

      if (existingIndex >= 0) {
        memorySubmissions[existingIndex] = nextSubmission;
      } else {
        memorySubmissions.push(nextSubmission);
      }
      submission = nextSubmission;
    }

    return res.json({
      success: true,
      message: 'Sınav bitirme iskeleti çalıştı. Cevap kaydetme ve puanlama diğer görevlerde tamamlanacak.',
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const submission = isMongoConnected()
      ? await Submission.findOne({ sessionId })
      : memorySubmissions.find((item) => item.sessionId === sessionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sinav oturumu bulunamadi.',
      });
    }

    const plain = serializeSubmission(submission);
    const exam = isMongoConnected()
      ? await Exam.findById(plain.examId).catch(() => null)
      : memoryExams.find((item) => String(item._id) === String(plain.examId));

    return res.json({
      success: true,
      session: {
        ...plain,
        remainingSeconds: getRemainingSecondsFromSubmission(plain, exam),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.submitAnswer = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { questionId, answer } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'questionId zorunludur.',
      });
    }

    const submission = isMongoConnected()
      ? await Submission.findOne({ sessionId })
      : memorySubmissions.find((item) => item.sessionId === sessionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sinav oturumu bulunamadi.',
      });
    }

    const plain = serializeSubmission(submission);
    if (isFinalSubmissionStatus(plain.status)) {
      return res.status(409).json({
        success: false,
        message: 'Tamamlanmis veya sonlandirilmis oturuma cevap kaydedilemez.',
        status: plain.status,
      });
    }

    const exam = isMongoConnected()
      ? await Exam.findById(plain.examId).catch(() => null)
      : memoryExams.find((item) => String(item._id) === String(plain.examId));

    if (getRemainingSecondsFromSubmission(plain, exam) <= 0) {
      await markSubmissionExpired(plain);
      return res.status(409).json({
        success: false,
        message: 'Sinav suresi doldu. Cevap kaydedilemedi.',
        status: 'auto_submitted',
      });
    }

    const answers = {
      ...normalizeAnswers(plain.answers),
      [questionId]: answer,
    };

    let updated = null;
    if (isMongoConnected()) {
      updated = await Submission.findOneAndUpdate(
        { sessionId },
        { $set: { answers, status: 'started' } },
        { new: true }
      );
    } else {
      const index = memorySubmissions.findIndex((item) => item.sessionId === sessionId);
      memorySubmissions[index] = {
        ...memorySubmissions[index],
        answers,
        status: 'started',
        updatedAt: new Date(),
      };
      updated = memorySubmissions[index];
    }

    return res.json({
      success: true,
      message: 'Cevap kaydedildi.',
      session: {
        ...serializeSubmission(updated),
        remainingSeconds: getRemainingSecondsFromSubmission(updated, exam),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSessionResults = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const submission = isMongoConnected()
      ? await Submission.findOne({ sessionId })
      : memorySubmissions.find((item) => item.sessionId === sessionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Sinav sonucu bulunamadi.',
      });
    }

    return res.json({
      success: true,
      results: serializeSubmission(submission),
    });
  } catch (error) {
    return next(error);
  }
};
