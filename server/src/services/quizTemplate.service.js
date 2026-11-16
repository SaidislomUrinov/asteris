const { isValidObjectId } = require("mongoose");
const QuizTemplate = require("../models/QuizTemplate");
const Subject = require("../models/Subject");
const quizService = require("./quiz.service");
const audit = require("../utils/audit.util");
const { getNow } = require("../utils/date.util");

// TEST SHABLONLARI (QuizTemplate) — docs/API_CONTRACT_quiz_templates.md.
//
// Faqat teacher/assistant (Staff). Har so'rov `client` + `staff` (egalik)
// filtri bilan — begona shablonga ID orqali kirib bo'lmaydi
// (`quizTemplate.notFound`). Naqsh teachingPlan.service.js bilan bir xil.

const TITLE_MAX = 120;

const assertTeacher = (staff) => {
  if (!staff || !["teacher", "assistant"].includes(staff.role)) throw new Error("auth.forbidden");
};

const cleanTitle = (raw) => {
  const title = String(raw || "").trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("quizTemplate.titleRequired");
  return title;
};

// Egalik filtri bilan bitta shablon (topilmasa — notFound, begona bo'lsa ham).
const findOwn = async (clientId, staff, id) => {
  if (!isValidObjectId(id)) throw new Error("quizTemplate.notFound");
  const template = await QuizTemplate.findOne({
    _id: id,
    client: clientId,
    staff: staff._id,
    isDeleted: false,
  });
  if (!template) throw new Error("quizTemplate.notFound");
  return template;
};

const assertSubjectExists = async (clientId, subjectId) => {
  if (!subjectId || !isValidObjectId(subjectId)) throw new Error("quizTemplate.subjectNotAllowed");
  const subject = await Subject.findOne({ _id: subjectId, client: clientId, isDeleted: false }).select("_id");
  if (!subject) throw new Error("quizTemplate.subjectNotAllowed");
};

const subjectNameMap = async (templates) => {
  const ids = [...new Set(templates.map((t) => String(t.subject)))];
  if (!ids.length) return {};
  const rows = await Subject.find({ _id: { $in: ids } }, { name: 1 }).lean();
  return Object.fromEntries(rows.map((s) => [String(s._id), s.name]));
};

const dto = (template, names = {}) => ({
  _id: String(template._id),
  title: template.title,
  subject: { _id: String(template.subject), name: names[String(template.subject)] || "?" },
  questions: template.questions.map((q) => ({
    _id: String(q._id),
    text: q.text,
    options: q.options,
    correctOptionId: q.correctOptionId,
  })),
  defaultDurationMin: template.defaultDurationMin,
  updatedAt: template.updatedAt,
});

module.exports = {
  // GET /quiz-templates (?subject=)
  list: async (clientId, staff, query = {}) => {
    assertTeacher(staff);
    const filter = { client: clientId, staff: staff._id, isDeleted: false };
    if (query.subject) {
      if (!isValidObjectId(query.subject)) return [];
      filter.subject = query.subject;
    }
    const templates = await QuizTemplate.find(filter).sort({ updatedAt: -1 }).lean();
    const names = await subjectNameMap(templates);
    return templates.map((t) => dto(t, names));
  },

  // GET /quiz-templates/:id
  getOne: async (clientId, staff, id) => {
    assertTeacher(staff);
    const template = await findOwn(clientId, staff, id);
    const names = await subjectNameMap([template]);
    return dto(template, names);
  },

  // POST /quiz-templates — { title, subject, questions, defaultDurationMin? }
  create: async (clientId, staff, body = {}) => {
    assertTeacher(staff);
    const title = cleanTitle(body.title);
    await assertSubjectExists(clientId, body.subject);
    const questions = quizService.normalizeQuestions(body.questions);
    const defaultDurationMin = Number.isFinite(Number(body.defaultDurationMin))
      ? Math.max(1, Math.min(180, Math.round(Number(body.defaultDurationMin))))
      : 10;

    const template = await QuizTemplate.create({
      client: clientId,
      center: staff.center,
      staff: staff._id,
      subject: body.subject,
      title,
      questions,
      defaultDurationMin,
    });

    const names = await subjectNameMap([template]);
    return dto(template, names);
  },

  // PUT /quiz-templates/:id — xuddi shu body
  update: async (clientId, staff, id, body = {}) => {
    assertTeacher(staff);
    const template = await findOwn(clientId, staff, id);

    if (body.title !== undefined) template.title = cleanTitle(body.title);
    if (body.subject !== undefined && String(body.subject) !== String(template.subject)) {
      await assertSubjectExists(clientId, body.subject);
      template.subject = body.subject;
    }
    if (body.questions !== undefined) template.questions = quizService.normalizeQuestions(body.questions);
    if (body.defaultDurationMin !== undefined) {
      const min = Number(body.defaultDurationMin);
      if (Number.isFinite(min)) template.defaultDurationMin = Math.max(1, Math.min(180, Math.round(min)));
    }

    await template.save();
    const names = await subjectNameMap([template]);
    return dto(template, names);
  },

  // DELETE /quiz-templates/:id — soft delete.
  remove: async (clientId, staff, id, actor = null) => {
    assertTeacher(staff);
    const template = await findOwn(clientId, staff, id);
    template.isDeleted = true;
    template.deletedAt = getNow();
    await template.save();

    void audit.log({
      actor,
      client: clientId,
      center: template.center,
      action: "quizTemplate:deleted",
      entity: { type: "quizTemplate", id: template._id, label: template.title },
    });
    return { _id: String(template._id) };
  },

  // POST /quiz-templates/:id/send — { groupId, startAt, durationMin }.
  // Shablon savollarini nusxalab, mavjud quiz.service.js `create()` oqimini
  // chaqiradi (socket emit `quiz:sent` + parentNotification shu funksiya
  // ichida — bu yerda qayta yozilmaydi).
  send: async (clientId, staff, templateId, body = {}, actor, scope = {}) => {
    assertTeacher(staff);
    const template = await findOwn(clientId, staff, templateId);

    return await quizService.create(
      clientId,
      body.groupId,
      {
        title: template.title,
        questions: template.questions,
        startAt: body.startAt,
        durationMin: body.durationMin,
      },
      actor,
      scope,
    );
  },
};
