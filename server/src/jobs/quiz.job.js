const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Quiz = require("../models/Quiz");
const quizService = require("../services/quiz.service");
const parentNotification = require("../services/parentNotification.service");
const emit = require("../utils/emitter.util");
const { getNow } = require("../utils/date.util");

// TEST (QUIZ) scheduleri — docs/API_CONTRACT_quiz.md §7. 15 soniyalik tick +
// Redis qulf (`lessonReminder.job.js` naqshi, cluster'da bir marta bajarilsin).
const TICK_SEC = 15;

const acquireLock = async (tick) => {
  const key = keyConfig.schedulerLock("quiz", tick);
  const res = await redis.set(key, "1", "EX", 120, "NX");
  return res === "OK";
};

// scheduled → active: `startAt` yetganda.
const activateScheduled = async (now) => {
  const due = await Quiz.find({ status: "scheduled", isDeleted: false, startAt: { $lte: now } });
  for (const quiz of due) {
    try {
      quiz.status = "active";
      await quiz.save();
      emit.toCenter(quiz.client, quiz.center, "quiz:started", {
        groupId: String(quiz.group),
        quizId: String(quiz._id),
        startAt: quiz.startAt,
        totalTimeSec: quiz.totalTimeSec,
      });
    } catch (error) {
      console.error("quiz.job activate:", quiz._id, error?.message || error);
    }
  }
};

// active → finished: `startAt + totalTimeSec` yetgan YOKI barcha attempt
// finished bo'lgan testlar. Tugashda javobsiz qolgan urinishlar avto-yopiladi.
const finishActive = async (now) => {
  const active = await Quiz.find({ status: "active", isDeleted: false });
  for (const quiz of active) {
    try {
      const deadline = quiz.startAt + quiz.totalTimeSec;
      const allFinished = quiz.attempts.length > 0 && quiz.attempts.every((a) => a.finishedAt);
      if (now < deadline && !allFinished) continue;

      const closed = [];
      for (const attempt of quiz.attempts) {
        if (attempt.finishedAt) continue;
        quizService.finishAttempt(quiz, attempt); // javobsiz → correctCount/score hisoblanadi
        closed.push(attempt);
      }
      quiz.status = "finished";
      await quiz.save();
      // Vaqt tugaganda yopilgan (lekin qatnashgan) urinishlar bahosi jurnalga.
      for (const attempt of closed) await quizService.writeGrade(quiz, attempt);

      emit.toCenter(quiz.client, quiz.center, "quiz:finished", {
        groupId: String(quiz.group),
        quizId: String(quiz._id),
      });
    } catch (error) {
      console.error("quiz.job finish:", quiz._id, error?.message || error);
    }
  }
};

// Natija xabarlari — "finished" testlar, har attempt uchun `notifiedAt`
// bo'lmaganlar (idempotent). Alohida bosqich (ushbu yoki keyingi tick) —
// yopish amalidan mustaqil, xato bo'lsa ham test holati to'g'ri qolaveradi.
const notifyResults = async () => {
  const pending = await Quiz.find({
    status: "finished",
    isDeleted: false,
    attempts: { $elemMatch: { finishedAt: { $ne: null }, notifiedAt: null } },
  });
  for (const quiz of pending) {
    for (const attempt of quiz.attempts) {
      if (!attempt.finishedAt || attempt.notifiedAt) continue;
      try {
        attempt.notifiedAt = getNow();
        await quiz.save();
        void parentNotification
          .onQuizResult({
            groupId: quiz.group,
            quizId: quiz._id,
            studentId: attempt.student,
            correctCount: attempt.correctCount,
            total: quiz.questions.length,
            score: attempt.score,
          })
          .catch(() => {});
      } catch (error) {
        console.error("quiz.job notify:", quiz._id, attempt.student, error?.message || error);
      }
    }
  }
};

const run = async () => {
  const now = getNow();
  const tick = Math.floor(now / TICK_SEC);
  if (!(await acquireLock(tick))) return;

  await activateScheduled(now).catch((error) => console.error("quiz.job activateScheduled:", error?.message || error));
  await finishActive(now).catch((error) => console.error("quiz.job finishActive:", error?.message || error));
  await notifyResults().catch((error) => console.error("quiz.job notifyResults:", error?.message || error));
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("quiz.job:", error?.message || error));
  }, TICK_SEC * 1000);
  timer.unref?.();
  console.log("Quiz scheduler started");
};

module.exports = { start, run };
