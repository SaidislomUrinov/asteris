// Test (Quiz) moduli (docs/API_CONTRACT_quiz.md) — asosiy oqim: yaratish,
// o'quvchi javob berib tugatishi, avto-baholash, qo'lda baho ustunlik qiladi.
// `past-cycle-price.test.js` naqshi: servisga TO'G'RIDAN-TO'G'RI (route'siz).
require("./helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("./helpers/db");
const { seedClient, seedCenter, seedGroup, seedStudent } = require("./helpers/seed");
const quizService = require("../src/services/quiz.service");
const Quiz = require("../src/models/Quiz");
const redis = require("../src/configs/redis.config");

const ctx = {};

before(async () => {
  await db.connect();
  ctx.A = await seedClient({ phone: "+998900000301" });
  ctx.A1 = await seedCenter(ctx.A.client, "A1");
  ctx.group = await seedGroup(ctx.A.client, ctx.A1);
});

after(async () => {
  await db.disconnect();
  await redis.quit().catch(() => redis.disconnect());
});

const QUESTIONS = [
  {
    text: "2+2=?",
    options: [{ id: "a", text: "3" }, { id: "b", text: "4" }],
    correctOptionId: "b",
  },
  {
    text: "Poytaxt?",
    options: [{ id: "a", text: "Toshkent" }, { id: "b", text: "Samarqand" }],
    correctOptionId: "a",
  },
];

describe("Quiz — create + attempt stub", () => {
  test("test yaratilganda guruhdagi faol o'quvchilarga attempt stub yaratiladi", async () => {
    const s1 = await seedStudent(ctx.A.client, ctx.group, "Ali");
    const s2 = await seedStudent(ctx.A.client, ctx.group, "Vali");

    const startAt = require("moment-timezone").tz("Asia/Tashkent").add(1, "minute").format("HH:mm");
    const quiz = await quizService.create(
      ctx.A.client._id,
      ctx.group._id,
      { title: "1-test", startAt, durationMin: 5, questions: QUESTIONS },
      { id: null, kind: "client" },
      {},
    );

    assert.equal(quiz.status, "scheduled");
    assert.equal(quiz.questions.length, 2);
    assert.equal(quiz.attempts.length, 2);
    const studentIds = quiz.attempts.map((a) => a.student._id).sort();
    assert.deepEqual(studentIds, [String(s1._id), String(s2._id)].sort());
  });
});

describe("Quiz — o'quvchi javob berib tugatishi (avto-baholash)", () => {
  test("correctCount va score = round(correct/total*10) to'g'ri hisoblanadi", async () => {
    const s = await seedStudent(ctx.A.client, ctx.group, "Dilshod");
    const quiz = await Quiz.create({
      client: ctx.A.client._id,
      center: ctx.A1.center._id,
      group: ctx.group._id,
      title: "2-test",
      questions: QUESTIONS,
      startAt: Math.floor(Date.now() / 1000) - 10,
      totalTimeSec: 60,
      status: "active",
      attempts: [{ student: s._id }],
    });

    const attempt = quizService.attemptOf(quiz, s._id);
    attempt.startedAt = Math.floor(Date.now() / 1000);
    // Savol 1 — to'g'ri, savol 2 — noto'g'ri.
    const q1 = quiz.questions[0];
    const q2 = quiz.questions[1];
    attempt.answers.push({ questionId: q1._id, optionId: q1.correctOptionId, correct: true, answeredAt: Date.now() / 1000 });
    attempt.answers.push({ questionId: q2._id, optionId: "b", correct: false, answeredAt: Date.now() / 1000 });

    quizService.finishAttempt(quiz, attempt);
    await quiz.save();

    assert.equal(attempt.correctCount, 1);
    assert.equal(attempt.score, Math.round((1 / 2) * 10)); // 5
    assert.equal(attempt.scoreSource, "auto");
  });
});

describe("Quiz — qo'lda baho (manual) avto-hisoblashga tegilmaydi", () => {
  test("setScore keyin finishAttempt qayta chaqirilsa ham score o'zgarmaydi", async () => {
    const s = await seedStudent(ctx.A.client, ctx.group, "Nodira");
    const quiz = await Quiz.create({
      client: ctx.A.client._id,
      center: ctx.A1.center._id,
      group: ctx.group._id,
      title: "3-test",
      questions: QUESTIONS,
      startAt: Math.floor(Date.now() / 1000) - 10,
      totalTimeSec: 60,
      status: "active",
      attempts: [{ student: s._id }],
    });

    const updated = await quizService.setScore(ctx.A.client._id, ctx.group._id, quiz._id, s._id, 9, {});
    const attempt = updated.attempts.find((a) => String(a.student._id) === String(s._id));
    assert.equal(attempt.score, 9);
    assert.equal(attempt.scoreSource, "manual");

    // Job timeout bosqichida qayta chaqirilsa ham (javobsiz) manual ustunlik qiladi.
    const fresh = await Quiz.findById(quiz._id);
    const freshAttempt = fresh.attempts[0];
    quizService.finishAttempt(fresh, freshAttempt);
    assert.equal(freshAttempt.score, 9);
    assert.equal(freshAttempt.scoreSource, "manual");
  });
});
