const { isValidObjectId } = require("mongoose");
const TeachingPlan = require("../models/TeachingPlan");
const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { emitArchiveChanged } = require("../utils/archive.util");
const { getNow } = require("../utils/date.util");
const {
  normalizeModules,
  cloneModules,
  moduleDTO,
  countLessons,
} = require("../utils/syllabusTree.util");

// "DARS REJALARIM" — API_CONTRACT_teaching_plans.md §4.1.
//
// Faqat teacher/assistant (Staff). Client Owner va resepshinda bu bo'lim
// yo'q. Har so'rov `client` + `staff` (egalik) filtri bilan — begona rejaga
// ID orqali kirib bo'lmaydi (`teachingPlan.notFound`).

// Rol → Group'dagi biriktirish maydoni.
const SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };
const TITLE_MAX = 120;

const assertTeacher = (staff) => {
  if (!staff || !SCOPE_FIELD[staff.role]) throw new Error("auth.forbidden");
};

const cleanTitle = (raw) => {
  const title = String(raw || "").trim().slice(0, TITLE_MAX);
  if (!title) throw new Error("teachingPlan.titleRequired");
  return title;
};

// O'qituvchining fanlari = Staff.subjects ∪ u teacher/assistant bo'lgan
// (o'chirilmagan) guruhlarning fanlari. `req.staff` Redis keshidan keladi
// (eskirgan bo'lishi mumkin) — shu sabab `subjects` bazadan jonli o'qiladi.
const teacherSubjects = async (clientId, staff) => {
  const [staffDoc, groupSubjects] = await Promise.all([
    Staff.findOne({ _id: staff._id, client: clientId }).select("subjects").lean(),
    Group.distinct("subject", {
      client: clientId,
      [SCOPE_FIELD[staff.role]]: staff._id,
      isDeleted: false,
    }),
  ]);

  const ids = [
    ...new Set([...(staffDoc?.subjects || []), ...groupSubjects].filter(Boolean).map(String)),
  ];
  if (!ids.length) return [];

  return Subject.find({ _id: { $in: ids }, client: clientId, isDeleted: false }, { name: 1 })
    .sort({ name: 1 })
    .lean();
};

const assertSubjectAllowed = async (clientId, staff, subjectId) => {
  if (!subjectId || !isValidObjectId(subjectId)) throw new Error("teachingPlan.subjectNotAllowed");
  const subjects = await teacherSubjects(clientId, staff);
  if (!subjects.some((s) => String(s._id) === String(subjectId))) {
    throw new Error("teachingPlan.subjectNotAllowed");
  }
};

// Egalik filtri bilan bitta reja (topilmasa — notFound, begona bo'lsa ham).
const findOwn = async (clientId, staff, id) => {
  if (!isValidObjectId(id)) throw new Error("teachingPlan.notFound");
  const plan = await TeachingPlan.findOne({
    _id: id,
    client: clientId,
    staff: staff._id,
    isDeleted: false,
  });
  if (!plan) throw new Error("teachingPlan.notFound");
  return plan;
};

// Fan nomlari xaritasi — bitta so'rovda (reja boshiga emas).
const subjectNameMap = async (plans) => {
  const ids = [...new Set(plans.map((p) => String(p.subject)))];
  if (!ids.length) return {};
  const rows = await Subject.find({ _id: { $in: ids } }, { name: 1 }).lean();
  return Object.fromEntries(rows.map((s) => [String(s._id), s.name]));
};

const summaryDTO = (plan, names) => ({
  _id: String(plan._id),
  title: plan.title,
  subject: { _id: String(plan.subject), name: names[String(plan.subject)] || "?" },
  moduleCount: plan.modules?.length || 0,
  lessonCount: countLessons(plan.modules),
  updatedAt: plan.updatedAt,
});

const fullDTO = async (plan) => {
  const names = await subjectNameMap([plan]);
  return { ...summaryDTO(plan, names), modules: (plan.modules || []).map(moduleDTO) };
};

const notify = (staff, plan) =>
  emit(`user:${staff._id}`, "teachingPlan:changed", { planId: String(plan._id) });

module.exports = {
  subjects: async (clientId, staff) => {
    assertTeacher(staff);
    const rows = await teacherSubjects(clientId, staff);
    return rows.map((s) => ({ _id: String(s._id), name: s.name }));
  },

  list: async (clientId, staff, query = {}) => {
    assertTeacher(staff);
    const filter = { client: clientId, staff: staff._id, isDeleted: false };
    if (query.subject) {
      if (!isValidObjectId(query.subject)) return [];
      filter.subject = query.subject;
    }

    const plans = await TeachingPlan.find(filter).sort({ updatedAt: -1 }).lean();
    const names = await subjectNameMap(plans);
    return plans.map((p) => summaryDTO(p, names));
  },

  getOne: async (clientId, staff, id) => {
    assertTeacher(staff);
    const plan = await findOwn(clientId, staff, id);
    return fullDTO(plan);
  },

  create: async (clientId, staff, body = {}) => {
    assertTeacher(staff);
    const title = cleanTitle(body.title);
    await assertSubjectAllowed(clientId, staff, body.subject);
    const modules = body.modules === undefined ? [] : normalizeModules(body.modules);

    const plan = await TeachingPlan.create({
      client: clientId,
      center: staff.center,
      staff: staff._id,
      subject: body.subject,
      title,
      modules,
    });

    notify(staff, plan);
    return fullDTO(plan);
  },

  // `modules` — butun daraxt (full replace), Syllabus PUT bilan bir xil.
  update: async (clientId, staff, id, body = {}) => {
    assertTeacher(staff);
    const plan = await findOwn(clientId, staff, id);

    if (body.title !== undefined) plan.title = cleanTitle(body.title);
    // Fan faqat O'ZGARTIRILSA tekshiriladi — o'qituvchi keyinchalik fandan
    // ajratilgan bo'lsa ham eski rejasini tahrirlay olishi kerak.
    if (body.subject !== undefined && String(body.subject) !== String(plan.subject)) {
      await assertSubjectAllowed(clientId, staff, body.subject);
      plan.subject = body.subject;
    }
    if (body.modules !== undefined) plan.modules = normalizeModules(body.modules);

    await plan.save();
    notify(staff, plan);
    return fullDTO(plan);
  },

  duplicate: async (clientId, staff, id) => {
    assertTeacher(staff);
    const source = await findOwn(clientId, staff, id);

    const plan = await TeachingPlan.create({
      client: clientId,
      center: source.center,
      staff: staff._id,
      subject: source.subject,
      title: `${source.title} (nusxa)`.slice(0, TITLE_MAX),
      modules: cloneModules(source.modules),
    });

    notify(staff, plan);
    return fullDTO(plan);
  },

  // Soft delete (arxiv semantikasi — CLAUDE.md).
  // "O'chirish" = Arxivlash (API_CONTRACT_archive.md) — reja Arxiv
  // bo'limining "Dars rejalari" tabiga tushadi va o'sha yerdan qaytariladi.
  remove: async (clientId, staff, id, actor = null) => {
    assertTeacher(staff);
    const plan = await findOwn(clientId, staff, id);
    plan.isDeleted = true;
    plan.deletedAt = getNow();
    await plan.save();

    notify(staff, plan);
    emitArchiveChanged(clientId, plan.center, "teachingPlan", plan._id, "archived");
    void audit.log({
      actor,
      client: clientId,
      center: plan.center,
      action: "teachingPlan:archived",
      entity: { type: "teachingPlan", id: plan._id, label: plan.title },
    });
    return { _id: String(plan._id) };
  },
};
