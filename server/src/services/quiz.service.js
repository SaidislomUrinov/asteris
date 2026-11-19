const moment = require("moment-timezone");
const { isValidObjectId } = require("mongoose");
const ExcelJS = require("exceljs");
const Quiz = require("../models/Quiz");
const Group = require("../models/Group");
const Student = require("../models/Student");
const Grade = require("../models/Grade");
const emit = require("../utils/emitter.util");
const { getNow } = require("../utils/date.util");
const parentNotification = require("./parentNotification.service");
const { photoFor } = require("../utils/studentPhoto.util");

// TEST (QUIZ) moduli — docs/API_CONTRACT_quiz.md. Staff/teacher tomon.

const TZ = "Asia/Tashkent";
const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];

// Guruh tenant'ga tegishli bo'lishi shart — homework.service'dagi `assertGroup`
// bilan AYNAN bir xil naqsh (scope: { centerId, teacher: { id, field } }).
const assertGroup = async (clientId, groupId, scope = {}) => {
  if (!isValidObjectId(groupId)) throw new Error("group.notFound");
  const filter = { _id: groupId, client: clientId, isDeleted: false };
  if (scope.centerId) filter.center = scope.centerId;
  const group = await Group.findOne(filter).select("client center teacher assistant name subject status");
  if (!group) throw new Error("group.notFound");
  const t = scope.teacher;
  if (t?.id && String(group[t.field] || "") !== String(t.id)) throw new Error("auth.forbidden");
  return group;
};

const assertQuiz = async (clientId, groupId, quizId) => {
  if (!isValidObjectId(quizId)) throw new Error("quiz.notFound");
  const quiz = await Quiz.findOne({ _id: quizId, client: clientId, group: groupId, isDeleted: false });
  if (!quiz) throw new Error("quiz.notFound");
  return quiz;
};

// Savol ro'yxatini tekshiradi/normalizatsiya qiladi — create/import/update
// uchun bir xil qoida (option id lar kichik harf, correctOptionId mavjud).
const normalizeQuestions = (raw) => {
  if (!Array.isArray(raw) || !raw.length || raw.length > 100) throw new Error("quiz.invalidQuestions");
  return raw.map((q) => {
    const text = String(q?.text || "").trim();
    const options = Array.isArray(q?.options) ? q.options : [];
    if (!text || options.length < 2 || options.length > 6) throw new Error("quiz.invalidQuestions");
    // Variant — `{id,text}` yoki oddiy satr (AI/JSON importda qulay shakl).
    const normOptions = options.map((o, i) => ({
      id: OPTION_IDS[i],
      text: String(typeof o === "string" || typeof o === "number" ? o : o?.text || "").trim(),
    }));
    if (normOptions.some((o) => !o.text)) throw new Error("quiz.invalidQuestions");
    // To'g'ri javob — harf ("B") yoki asl `id`; `correct`/`answer` ham qabul qilinadi.
    const rawCorrect = String(q?.correctOptionId ?? q?.correct ?? q?.answer ?? "").trim().toLowerCase();
    const byOriginalId = options.findIndex((o) => typeof o === "object" && String(o?.id || "").toLowerCase() === rawCorrect);
    const correctOptionId = byOriginalId >= 0 ? OPTION_IDS[byOriginalId] : rawCorrect;
    if (!normOptions.some((o) => o.id === correctOptionId)) throw new Error("quiz.invalidQuestions");
    return { text, options: normOptions, correctOptionId };
  });
};

// Butun testga beriladigan umumiy vaqt (daqiqa) → soniya. 1–180 daqiqa.
const totalTimeFromMinutes = (raw) => {
  const min = Number(raw);
  if (!Number.isFinite(min) || min < 1 || min > 180) throw new Error("quiz.invalidDuration");
  return Math.round(min * 60);
};

// 10 ballik baho: to'g'ri javoblar ulushi, yaxlitlab. Eng kami 1 — jurnal
// (Grade) 1–10 oralig'ini qabul qiladi, 0 baho yo'q.
const scoreOf = (correctCount, total) => Math.max(1, Math.round((correctCount / (total || 1)) * 10));

// Test bahosini shu kunning jurnaliga (Baholar) yozadi — FAQAT o'sha kunga
// baho hali qo'yilmagan bo'lsa (`$setOnInsert`): qo'lda qo'yilgan baho
// ustun. Testda qatnashmagan (boshlamagan) o'quvchiga baho yozilmaydi.
const writeGrade = async (quiz, attempt) => {
  if (!attempt.startedAt || attempt.score == null) return;
  try {
    const date = moment.unix(quiz.startAt).tz(TZ).format("YYYY-MM-DD");
    const now = getNow();
    const res = await Grade.updateOne(
      { group: quiz.group, student: attempt.student, date },
      {
        $setOnInsert: {
          client: quiz.client,
          center: quiz.center,
          teacher: null,
          value: attempt.score,
          scale: 10,
          note: String(quiz.title || "Test").slice(0, 200),
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) {
      emit(`client:${quiz.client}`, "grade:set", {
        groupId: String(quiz.group),
        studentId: String(attempt.student),
        date,
        value: attempt.score,
        note: String(quiz.title || "Test").slice(0, 200),
        teacher: null,
      });
    }
  } catch (error) {
    console.error("quiz.writeGrade:", String(quiz._id), error?.message || error);
  }
};

// "HH:mm" → bugungi shu vaqtning Asia/Tashkent unix (sekund) qiymati.
const startAtFromHHmm = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) throw new Error("quiz.invalidStartAt");
  const m = moment.tz(TZ).startOf("day");
  const [h, mi] = hhmm.split(":").map(Number);
  return m.unix() + h * 3600 + mi * 60;
};

// Guruhdagi faol o'quvchilar — attempt stub pre-populate qilish uchun
// (API_CONTRACT_quiz.md: "attempts bir martalik student-per-quiz").
const activeStudentIdsOf = async (groupId) => {
  const students = await Student.find({
    isDeleted: false,
    groups: { $elemMatch: { group: groupId, status: "active" } },
  }).select("_id");
  return students.map((s) => s._id);
};

const attemptStatsOf = (quiz) => {
  const total = quiz.attempts.length;
  const finished = quiz.attempts.filter((a) => a.finishedAt).length;
  const withCorrect = quiz.attempts.filter((a) => a.finishedAt);
  const avgCorrect = withCorrect.length
    ? Math.round((withCorrect.reduce((s, a) => s + (a.correctCount || 0), 0) / withCorrect.length) * 10) / 10
    : null;
  return { total, finished, avgCorrect };
};

const listDTO = (quiz) => ({
  _id: String(quiz._id),
  title: quiz.title,
  status: quiz.status,
  startAt: quiz.startAt,
  totalTimeSec: quiz.totalTimeSec,
  questionCount: quiz.questions.length,
  attemptStats: attemptStatsOf(quiz),
});

// Batafsil — har savol va har o'quvchi javobi (o'quvchi ismi bilan).
const detailDTO = async (quiz) => {
  const studentIds = quiz.attempts.map((a) => a.student);
  const students = studentIds.length
    ? await Student.find({ _id: { $in: studentIds } }).select("fullName photos").lean()
    : [];
  const studentOf = new Map(students.map((s) => [String(s._id), s]));
  return {
    _id: String(quiz._id),
    title: quiz.title,
    status: quiz.status,
    startAt: quiz.startAt,
    totalTimeSec: quiz.totalTimeSec,
    questions: quiz.questions.map((q) => ({
      _id: String(q._id),
      text: q.text,
      options: q.options,
      correctOptionId: q.correctOptionId,
    })),
    attempts: quiz.attempts.map((a) => ({
      student: {
        _id: String(a.student),
        fullName: studentOf.get(String(a.student))?.fullName || "",
        photo: photoFor(studentOf.get(String(a.student)), quiz.client),
      },
      startedAt: a.startedAt,
      finishedAt: a.finishedAt,
      correctCount: a.correctCount,
      score: a.score,
      scoreSource: a.scoreSource,
      answers: a.answers.map((ans) => ({
        questionId: String(ans.questionId),
        optionId: ans.optionId,
        correct: ans.correct,
        answeredAt: ans.answeredAt,
      })),
    })),
  };
};

module.exports = {
  activeStudentIdsOf,
  assertGroup,
  assertQuiz,
  normalizeQuestions,

  // GET /quiz/:groupId
  listByGroup: async (clientId, groupId, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const quizzes = await Quiz.find({ client: clientId, group: groupId, isDeleted: false })
      .sort({ startAt: -1 })
      .lean();
    return quizzes.map(listDTO);
  },

  // GET /quiz/:groupId/:quizId
  detail: async (clientId, groupId, quizId, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const quiz = await assertQuiz(clientId, groupId, quizId);
    return await detailDTO(quiz);
  },

  // POST /quiz/:groupId/import — multipart `file` (Excel) yoki JSON {questions}.
  // Faqat parse qiladi, saqlamaydi — frontend natijani `create()`ga yuboradi.
  importQuestions: async (clientId, groupId, body, file, scope = {}) => {
    await assertGroup(clientId, groupId, scope);

    if (file?.data) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.data);
      const ws = workbook.worksheets[0];
      if (!ws) throw new Error("quiz.invalidFile");
      const questions = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // sarlavha qatori
        const cell = (i) => String(row.getCell(i).value ?? "").trim();
        const text = cell(1);
        if (!text) return;
        const options = [
          { id: "a", text: cell(2) },
          { id: "b", text: cell(3) },
          { id: "c", text: cell(4) },
          { id: "d", text: cell(5) },
        ].filter((o) => o.text);
        questions.push({ text, options, correctOptionId: cell(6).toLowerCase() });
      });
      return { questions: normalizeQuestions(questions) };
    }

    if (Array.isArray(body?.questions) && body.questions.length) {
      return { questions: normalizeQuestions(body.questions) };
    }

    throw new Error("quiz.invalidFile");
  },

  // POST /quiz/:groupId — yangi test yaratish + yuborish.
  // Body: { title?, startAt: "HH:mm", durationMin, questions: [...] }
  create: async (clientId, groupId, body, actor, scope = {}) => {
    const group = await assertGroup(clientId, groupId, scope);
    if (group.status === "finished") throw new Error("quiz.groupFinished");

    const questions = normalizeQuestions(body?.questions);
    const startAt = startAtFromHHmm(body?.startAt);
    const totalTimeSec = totalTimeFromMinutes(body?.durationMin);

    const studentIds = await activeStudentIdsOf(groupId);

    const quiz = await Quiz.create({
      client: clientId,
      center: group.center,
      group: group._id,
      title: String(body?.title || "").trim(),
      questions,
      startAt,
      totalTimeSec,
      status: "scheduled",
      attempts: studentIds.map((student) => ({ student })),
      createdBy: { id: actor?.id || null, kind: actor?.kind === "staff" ? "staff" : "client" },
    });

    emit.toCenter(clientId, group.center, "quiz:sent", {
      groupId: String(group._id),
      quizId: String(quiz._id),
      title: quiz.title,
      startAt: quiz.startAt,
      totalTimeSec: quiz.totalTimeSec,
    });

    // Telegram — darhol guruh o'quvchilariga, fire-and-forget (xato hech
    // qachon `create()` ni to'xtatmaydi — lessonReminder/homework naqshi).
    void parentNotification.onQuizSent({ groupId: group._id, quizId: quiz._id }).catch(() => {});

    return await detailDTO(quiz);
  },

  // PUT /quiz/:groupId/:quizId — faqat status "scheduled" bo'lsa tahrirlanadi.
  update: async (clientId, groupId, quizId, body, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const quiz = await assertQuiz(clientId, groupId, quizId);
    if (quiz.status !== "scheduled") throw new Error("quiz.notEditable");

    if (body?.title !== undefined) quiz.title = String(body.title || "").trim();
    if (body?.questions !== undefined) {
      quiz.questions = normalizeQuestions(body.questions);
    }
    if (body?.durationMin !== undefined) quiz.totalTimeSec = totalTimeFromMinutes(body.durationMin);
    if (body?.startAt !== undefined) quiz.startAt = startAtFromHHmm(body.startAt);

    await quiz.save();
    emit.toCenter(clientId, quiz.center, "quiz:sent", {
      groupId: String(quiz.group),
      quizId: String(quiz._id),
      title: quiz.title,
      startAt: quiz.startAt,
      totalTimeSec: quiz.totalTimeSec,
    });
    return await detailDTO(quiz);
  },

  // DELETE /quiz/:groupId/:quizId — faqat "scheduled" yoki "finished" (active emas).
  remove: async (clientId, groupId, quizId, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const quiz = await assertQuiz(clientId, groupId, quizId);
    if (quiz.status === "active") throw new Error("quiz.cannotDeleteActive");
    quiz.isDeleted = true;
    quiz.deletedAt = getNow();
    await quiz.save();
    emit.toCenter(clientId, quiz.center, "quiz:finished", {
      groupId: String(quiz.group),
      quizId: String(quiz._id),
      deleted: true,
    });
  },

  // PUT /quiz/:groupId/:quizId/attempts/:studentId/score — qo'lda baho.
  setScore: async (clientId, groupId, quizId, studentId, scoreRaw, scope = {}) => {
    await assertGroup(clientId, groupId, scope);
    const quiz = await assertQuiz(clientId, groupId, quizId);
    const score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 1 || score > 10) throw new Error("quiz.invalidScore");

    const attempt = quiz.attempts.find((a) => String(a.student) === String(studentId));
    if (!attempt) throw new Error("quiz.attemptNotFound");
    attempt.score = score;
    attempt.scoreSource = "manual";
    await quiz.save();

    emit.toCenter(clientId, quiz.center, "quiz:attempt_updated", {
      groupId: String(quiz.group),
      quizId: String(quiz._id),
      studentId: String(studentId),
      score,
      scoreSource: "manual",
    });

    return await detailDTO(quiz);
  },

  // ===== PARENT/STUDENT WEBAPP TOMONI (prefix /api/parent-quiz) =====

  // `entryId` → { student, entry } — parent.service'dagi resolveEntry bilan
  // bir xil tekshiruv (telegram raqam bo'yicha rol mosligi). Lazy require —
  // aylanma import bo'lmasin.
  resolveEntry: async (parent, entryId) => {
    if (!isValidObjectId(entryId)) throw new Error("parent.entryNotFound");
    const { roleMatch, effectiveRole } = require("./parent.service");
    const role = await effectiveRole(parent);
    const student = await Student.findOne({
      "groups._id": entryId,
      isDeleted: false,
      ...roleMatch(role, parent.phone),
    });
    const entry = student?.groups?.id(entryId);
    if (!student || !entry) throw new Error("parent.entryNotFound");
    return { student, entry };
  },

  // Entry + quizId → quiz hujjati, shu guruhga tegishli bo'lishi shart.
  quizOfEntry: async (entry, quizId) => {
    if (!isValidObjectId(quizId)) throw new Error("quiz.notFound");
    const quiz = await Quiz.findOne({ _id: quizId, group: entry.group, isDeleted: false });
    if (!quiz) throw new Error("quiz.notFound");
    return quiz;
  },

  // Shu o'quvchining urinishi — agar hali yo'q bo'lsa (guruhga keyin
  // qo'shilgan o'quvchi) joyida yaratiladi.
  attemptOf: (quiz, studentId) => {
    let attempt = quiz.attempts.find((a) => String(a.student) === String(studentId));
    if (!attempt) {
      quiz.attempts.push({ student: studentId });
      attempt = quiz.attempts[quiz.attempts.length - 1];
    }
    return attempt;
  },

  // Urinishni avto/qo'lda yopadi — `correctCount` + (manual bo'lmasa) `score`.
  // Job (timeout) va parent `finish` ikkalasi ham shu bitta funksiyadan foydalanadi.
  finishAttempt: (quiz, attempt) => {
    if (attempt.finishedAt) return;
    attempt.finishedAt = getNow();
    attempt.correctCount = attempt.answers.filter((a) => a.correct).length;
    if (attempt.scoreSource !== "manual") {
      attempt.score = scoreOf(attempt.correctCount, quiz.questions.length);
      attempt.scoreSource = "auto";
    }
  },

  writeGrade,

  // GET /parent-quiz/:entryId/:quizId/state — polling uchun, countdown/
  // serverNow sinxronizatsiyasi.
  parentState: async (parent, entryId, quizId) => {
    const self = module.exports;
    const { student, entry } = await self.resolveEntry(parent, entryId);
    const quiz = await self.quizOfEntry(entry, quizId);
    const attempt = quiz.attempts.find((a) => String(a.student) === String(student._id)) || null;
    return {
      status: quiz.status,
      startAt: quiz.startAt,
      serverNow: getNow(),
      totalTimeSec: quiz.totalTimeSec,
      attempt: {
        startedAt: attempt?.startedAt || null,
        finishedAt: attempt?.finishedAt || null,
        answeredCount: attempt?.answers?.length || 0,
      },
    };
  },

  // POST /parent-quiz/:entryId/:quizId/start
  parentStart: async (parent, entryId, quizId) => {
    const self = module.exports;
    const { student, entry } = await self.resolveEntry(parent, entryId);
    const quiz = await self.quizOfEntry(entry, quizId);
    const attempt = self.attemptOf(quiz, student._id);

    if (!attempt.startedAt) {
      if (quiz.status === "scheduled" && quiz.startAt > getNow()) throw new Error("quiz.notStarted");
      if (quiz.status === "finished" && !attempt.finishedAt) throw new Error("quiz.finished");
      attempt.startedAt = getNow();
      await quiz.save();
      emit.toCenter(quiz.client, quiz.center, "quiz:attempt_updated", {
        groupId: String(quiz.group),
        quizId: String(quiz._id),
        studentId: String(student._id),
        startedAt: attempt.startedAt,
      });
    }

    return {
      questions: quiz.questions.map((q) => ({
        _id: String(q._id),
        text: q.text,
        options: q.options,
      })),
      // Ilova qayta ochilganda belgilangan javoblar tiklanadi.
      answers: attempt.answers.map((a) => ({ questionId: String(a.questionId), optionId: a.optionId })),
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      startAt: quiz.startAt,
      serverNow: getNow(),
      totalTimeSec: quiz.totalTimeSec,
    };
  },

  // PUT /parent-quiz/:entryId/:quizId/answer — body { questionId, optionId }
  parentAnswer: async (parent, entryId, quizId, body) => {
    const self = module.exports;
    const { student, entry } = await self.resolveEntry(parent, entryId);
    const quiz = await self.quizOfEntry(entry, quizId);
    const attempt = self.attemptOf(quiz, student._id);
    if (attempt.finishedAt) throw new Error("quiz.alreadyFinished");
    // Umumiy vaqt tugagach javob qabul qilinmaydi (tarmoq kechikishiga 3s).
    if (getNow() > quiz.startAt + quiz.totalTimeSec + 3) throw new Error("quiz.alreadyFinished");

    const questionId = String(body?.questionId || "");
    const question = quiz.questions.find((q) => String(q._id) === questionId);
    if (!question) throw new Error("quiz.questionNotFound");
    const optionId = body?.optionId ? String(body.optionId).toLowerCase() : null;
    const correct = optionId !== null && optionId === question.correctOptionId;

    const existing = attempt.answers.find((a) => String(a.questionId) === questionId);
    if (existing) {
      existing.optionId = optionId;
      existing.correct = correct;
      existing.answeredAt = getNow();
    } else {
      attempt.answers.push({ questionId: question._id, optionId, correct, answeredAt: getNow() });
    }
    await quiz.save();

    emit.toCenter(quiz.client, quiz.center, "quiz:attempt_updated", {
      groupId: String(quiz.group),
      quizId: String(quiz._id),
      studentId: String(student._id),
      answeredCount: attempt.answers.length,
    });

    return { ok: true };
  },

  // POST /parent-quiz/:entryId/:quizId/finish
  parentFinish: async (parent, entryId, quizId) => {
    const self = module.exports;
    const { student, entry } = await self.resolveEntry(parent, entryId);
    const quiz = await self.quizOfEntry(entry, quizId);
    const attempt = self.attemptOf(quiz, student._id);
    const wasFinished = !!attempt.finishedAt;
    self.finishAttempt(quiz, attempt);
    await quiz.save();
    if (!wasFinished) await writeGrade(quiz, attempt);

    emit.toCenter(quiz.client, quiz.center, "quiz:finished", {
      groupId: String(quiz.group),
      quizId: String(quiz._id),
      studentId: String(student._id),
      correctCount: attempt.correctCount,
      score: attempt.score,
    });

    return { correctCount: attempt.correctCount, total: quiz.questions.length, score: attempt.score };
  },

  // GET /parent-quiz/active — role almashganda yo'qolmasin: bog'liq barcha
  // Student hujjatlar (roleMatch bo'yicha, parent.service bilan bir xil
  // qoida) kesimida tugallanmagan (startedAt bor, finishedAt yo'q) urinishlar.
  parentActiveAttempts: async (parent) => {
    const { roleMatch, effectiveRole } = require("./parent.service");
    const role = await effectiveRole(parent);
    const students = await Student.find({
      isDeleted: false,
      ...roleMatch(role, parent.phone),
    }).select("groups._id groups.group groups.client");
    if (!students.length) return [];

    // entryId -> { studentId, groupId }
    const entryMap = new Map();
    const groupIds = new Set();
    for (const s of students) {
      for (const g of s.groups || []) {
        entryMap.set(String(g._id), { studentId: s._id, groupId: g.group });
        groupIds.add(String(g.group));
      }
    }
    if (!entryMap.size) return [];

    const quizzes = await Quiz.find({
      group: { $in: [...groupIds] },
      isDeleted: false,
      attempts: { $elemMatch: { startedAt: { $ne: null }, finishedAt: null } },
    }).select("title group startAt totalTimeSec attempts");
    if (!quizzes.length) return [];

    const groups = await Group.find({ _id: { $in: [...groupIds] } }).select("name").lean();
    const groupName = new Map(groups.map((g) => [String(g._id), g.name]));

    const now = getNow();
    const result = [];
    for (const quiz of quizzes) {
      for (const [entryId, link] of entryMap) {
        if (String(link.groupId) !== String(quiz.group)) continue;
        const attempt = quiz.attempts.find(
          (a) => String(a.student) === String(link.studentId) && a.startedAt && !a.finishedAt,
        );
        if (!attempt) continue;
        result.push({
          quizId: String(quiz._id),
          entryId,
          title: quiz.title,
          groupName: groupName.get(String(quiz.group)) || "",
          startedAt: attempt.startedAt,
          totalTimeSec: quiz.totalTimeSec,
          remainingSec: Math.max(0, quiz.totalTimeSec - (now - attempt.startedAt)),
        });
      }
    }
    return result;
  },

  // GET /parent-quiz/history — tugallangan (finishedAt mavjud) urinishlar,
  // eng yangisi birinchi — parentActiveAttempts bilan bir xil entry/group
  // kesimi, faqat teskari filtr.
  parentHistory: async (parent) => {
    const { roleMatch, effectiveRole } = require("./parent.service");
    const role = await effectiveRole(parent);
    const students = await Student.find({
      isDeleted: false,
      ...roleMatch(role, parent.phone),
    }).select("groups._id groups.group groups.client");
    if (!students.length) return [];

    const entryMap = new Map();
    const groupIds = new Set();
    for (const s of students) {
      for (const g of s.groups || []) {
        entryMap.set(String(g._id), { studentId: s._id, groupId: g.group });
        groupIds.add(String(g.group));
      }
    }
    if (!entryMap.size) return [];

    const quizzes = await Quiz.find({
      group: { $in: [...groupIds] },
      isDeleted: false,
      attempts: { $elemMatch: { finishedAt: { $ne: null } } },
    }).select("title group startAt totalTimeSec attempts questions");
    if (!quizzes.length) return [];

    const groups = await Group.find({ _id: { $in: [...groupIds] } }).select("name").lean();
    const groupName = new Map(groups.map((g) => [String(g._id), g.name]));

    const result = [];
    for (const quiz of quizzes) {
      for (const [entryId, link] of entryMap) {
        if (String(link.groupId) !== String(quiz.group)) continue;
        const attempt = quiz.attempts.find((a) => String(a.student) === String(link.studentId) && a.finishedAt);
        if (!attempt) continue;
        result.push({
          quizId: String(quiz._id),
          entryId,
          title: quiz.title,
          groupName: groupName.get(String(quiz.group)) || "",
          startAt: quiz.startAt,
          finishedAt: attempt.finishedAt,
          correctCount: attempt.correctCount,
          total: quiz.questions.length,
          score: attempt.score,
        });
      }
    }
    result.sort((a, b) => b.finishedAt - a.finishedAt);
    return result;
  },

  // GET /parent-quiz/:entryId/:quizId/result — faqat finishedAt mavjud bo'lsa.
  parentResult: async (parent, entryId, quizId) => {
    const self = module.exports;
    const { student, entry } = await self.resolveEntry(parent, entryId);
    const quiz = await self.quizOfEntry(entry, quizId);
    const attempt = quiz.attempts.find((a) => String(a.student) === String(student._id));
    if (!attempt?.finishedAt) throw new Error("quiz.notFinished");
    // To'g'ri javoblar faqat test HAMMA uchun tugagach ochiladi — aks holda
    // erta tugatgan o'quvchi javoblarni boshqalarga tarqatishi mumkin.
    const reviewable = quiz.status === "finished";
    const questionById = new Map(quiz.questions.map((q) => [String(q._id), q]));
    return {
      correctCount: attempt.correctCount,
      total: quiz.questions.length,
      score: attempt.score,
      joined: !!attempt.startedAt,
      reviewable,
      questions: reviewable
        ? quiz.questions.map((q) => ({ _id: String(q._id), text: q.text, options: q.options, correctOptionId: q.correctOptionId }))
        : [],
      answers: attempt.answers.map((a) => ({
        questionId: String(a.questionId),
        optionId: a.optionId,
        correct: a.correct,
        correctOptionId: reviewable ? questionById.get(String(a.questionId))?.correctOptionId || null : null,
      })),
    };
  },
};
