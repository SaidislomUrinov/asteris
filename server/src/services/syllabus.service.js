const { Types } = require("mongoose");
const Syllabus = require("../models/Syllabus");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const emit = require("../utils/emitter.util");
const {
  flattenLessons,
  countDoneLessons,
  buildProgress,
} = require("../utils/syllabusProgress.util");

// Daraxt hajmi cheklovlari — bitta hujjatga cheksiz modul/dars yozib
// yuborilsa Mongo hujjat limitiga (16MB) yaqinlashardi va frontend
// akkordeoni ishlatib bo'lmas holga kelardi.
const MAX_MODULES = 50;
const MAX_LESSONS_PER_MODULE = 200;

// Guruhga biriktirilish orqali cheklanadigan rollar → Group'dagi mos maydon.
const SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };

// ─── Kim yoza oladi ──────────────────────────────────────────────────────
// Kurs dasturi — MARKAZ darajasidagi hujjat (bitta dars yozuvi emas), shu
// sabab lessonPlan'dan farqli o'laroq Client Owner ham yozadi. Resepshin
// faqat ko'radi.
const WRITER_ROLES = ["teacher", "assistant"];

const assertCanWrite = (staff) => {
  if (!staff) return; // Client Owner — mustaqil auth zanjiri, `req.staff` yo'q
  if (!WRITER_ROLES.includes(staff.role)) throw new Error("auth.forbidden");
};

// Staff obyektidan qamrov yasaydi (rol biriktirish talab qilmasa — null).
const scopeOf = (staff) => {
  const field = SCOPE_FIELD[staff?.role];
  return field ? { id: staff._id, field } : null;
};

// Berilgan fan bilan BIR XIL NOMLI barcha fan `_id` lari (shu client ichida).
// Fan hujjati har filial uchun alohida yaratilgani sababli "Matematika"
// bir nechta `_id` ga ega bo'ladi — import ro'yxati ana shularning
// hammasini qamrashi kerak. Nom katta-kichik harf va bo'shliqqa sezgir emas.
const sameSubjectIds = async (clientId, subjectId) => {
  const subject = await Subject.findOne({ _id: subjectId }, { name: 1 });
  if (!subject?.name) return [subjectId];
  const escaped = subject.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const twins = await Subject.find(
    { client: clientId, name: { $regex: `^${escaped}$`, $options: "i" }, isDeleted: false },
    { _id: 1 },
  );
  return twins.length ? twins.map((s) => s._id) : [subjectId];
};

// `scope` — { id, field } yoki null (cheklovsiz: Owner/Reception).
const assertGroup = async (clientId, groupId, scope = null) => {
  const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
  if (!group) throw new Error("group.notFound");
  if (scope?.id && String(group[scope.field] || "") !== String(scope.id)) {
    throw new Error("auth.forbidden");
  }
  return group;
};

const moduleDTO = (mod) => ({
  _id: String(mod._id),
  title: mod.title,
  lessons: (mod.lessons || []).map((l) => ({
    _id: String(l._id),
    title: l.title,
    description: l.description || "",
    homework: l.homework || "",
  })),
});

// GET javobining yagona shakli — import ham, PUT ham aynan shuni qaytaradi,
// shuning uchun frontend har amaldan keyin bir xil holatni oladi.
const buildResponse = async (clientId, group, syllabus) => {
  const modules = syllabus?.modules || [];
  const lessons = flattenLessons(modules);
  const doneCount = await countDoneLessons(clientId, group._id, group.lessonOffset);

  return {
    groupId: String(group._id),
    lessonOffset: group.lessonOffset || 0,
    modules: modules.map(moduleDTO),
    progress: buildProgress(lessons, doneCount, modules.length),
  };
};

// Frontenddan kelgan daraxtni tozalaydi va tekshiradi. `_id` yuborilsa
// SAQLANADI (frontend qatorlarining key'i va tahrir holati buzilmasligi
// uchun), yo'q bo'lsa yangi generatsiya qilinadi.
const normalizeModules = (raw) => {
  if (!Array.isArray(raw)) throw new Error("syllabus.invalidModules");
  if (raw.length > MAX_MODULES) throw new Error("syllabus.tooManyModules");

  return raw.map((mod) => {
    const title = String(mod?.title || "").trim();
    if (!title) throw new Error("syllabus.titleRequired");

    const rawLessons = Array.isArray(mod?.lessons) ? mod.lessons : [];
    if (rawLessons.length > MAX_LESSONS_PER_MODULE) throw new Error("syllabus.tooManyLessons");

    return {
      _id: Types.ObjectId.isValid(mod?._id) ? new Types.ObjectId(mod._id) : new Types.ObjectId(),
      title,
      lessons: rawLessons.map((lesson) => {
        const lessonTitle = String(lesson?.title || "").trim();
        if (!lessonTitle) throw new Error("syllabus.titleRequired");
        return {
          _id: Types.ObjectId.isValid(lesson?._id)
            ? new Types.ObjectId(lesson._id)
            : new Types.ObjectId(),
          title: lessonTitle,
          description: String(lesson?.description || "").trim(),
          homework: String(lesson?.homework || "").trim(),
        };
      }),
    };
  });
};

// Daraxtni butunlay almashtiradi (upsert) — PUT ham, import ham shu orqali.
const replaceModules = async (clientId, group, modules) => {
  const syllabus = await Syllabus.findOneAndUpdate(
    { group: group._id },
    {
      $set: {
        client: clientId,
        center: group.center,
        group: group._id,
        modules,
        isDeleted: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  emit(`client:${clientId}`, "syllabus:changed", { groupId: String(group._id) });
  return syllabus;
};

module.exports = {
  get: async (clientId, groupId, scope = null) => {
    const group = await assertGroup(clientId, groupId, scope);
    const syllabus = await Syllabus.findOne({ group: group._id, client: clientId, isDeleted: false });
    return buildResponse(clientId, group, syllabus);
  },

  // Butun daraxtni saqlash (full replace) — frontend akkordeonda tahrirlab,
  // yakuniy holatni bir marta yuboradi. Qismli PATCH'lar ketma-ketligi
  // modullarni qayta tartiblashda konfliktga olib kelardi.
  save: async (clientId, groupId, body = {}, staff = null) => {
    assertCanWrite(staff);
    const group = await assertGroup(clientId, groupId, scopeOf(staff));

    const modules = normalizeModules(body.modules);
    const syllabus = await replaceModules(clientId, group, modules);
    return buildResponse(clientId, group, syllabus);
  },

  // Boshlanish nuqtasi — dastur o'rtasidan boshlangan guruh uchun.
  setOffset: async (clientId, groupId, body = {}, staff = null) => {
    assertCanWrite(staff);
    const group = await assertGroup(clientId, groupId, scopeOf(staff));

    const offset = Number(body.lessonOffset);
    if (!Number.isFinite(offset) || offset < 0) throw new Error("syllabus.invalidOffset");

    group.lessonOffset = Math.floor(offset);
    await group.save();

    emit(`client:${clientId}`, "syllabus:changed", { groupId: String(group._id) });

    const syllabus = await Syllabus.findOne({ group: group._id, client: clientId, isDeleted: false });
    return buildResponse(clientId, group, syllabus);
  },

  // Import uchun manba guruhlar — FAQAT shu fandagi, shu client ichidagi,
  // dasturi bo'sh bo'lmagan boshqa guruhlar. Filial cheklovi
  // teacherScope/staff center isolation orqali (staffCenter).
  sources: async (clientId, groupId, scope = null, staffCenter = "") => {
    const group = await assertGroup(clientId, groupId, scope);

    // "Shu fan" — subject `_id` bo'yicha emas, NOMI bo'yicha aniqlanadi:
    // Fan hujjati har filialda alohida yaratiladi, ya'ni "Matematika" ikki
    // filialda ikki xil `_id`. Faqat `_id` bilan solishtirilsa, boshqa
    // filialdagi bir xil fan guruhlari ro'yxatga umuman tushmasdi.
    const subjectIds = await sameSubjectIds(clientId, group.subject);

    const filter = {
      client: clientId,
      subject: { $in: subjectIds },
      isDeleted: false,
      _id: { $ne: group._id },
    };
    if (staffCenter) filter.center = staffCenter;

    const groups = await Group.find(filter).sort({ createdAt: -1 });
    if (!groups.length) return [];

    const groupIds = groups.map((g) => g._id);

    // Uchta ro'yxat — uchta so'rov, guruh boshiga emas (N+1 yo'q).
    const [syllabuses, subject, studentRows] = await Promise.all([
      Syllabus.find({ group: { $in: groupIds }, client: clientId, isDeleted: false }),
      Subject.findOne({ _id: group.subject }, { name: 1 }),
      Student.aggregate([
        { $match: { "groups.group": { $in: groupIds } } },
        { $unwind: "$groups" },
        { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
        { $group: { _id: "$groups.group", count: { $sum: 1 } } },
      ]),
    ]);

    const syllabusMap = Object.fromEntries(syllabuses.map((s) => [String(s.group), s]));
    const countMap = Object.fromEntries(studentRows.map((r) => [String(r._id), r.count]));
    const subjectName = subject?.name || "?";

    return groups
      .map((g) => {
        const modules = syllabusMap[String(g._id)]?.modules || [];
        const lessonCount = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
        return {
          _id: String(g._id),
          // Guruh nomi frontendda saqlanmaydi (fan nomi + activeId ?? pendingId)
          // — import ro'yxati uchun backendda tayyorlab beriladi.
          name: `${subjectName} - ${g.activeId ?? g.pendingId}`,
          moduleCount: modules.length,
          lessonCount,
          studentsCount: countMap[String(g._id)] || 0,
        };
      })
      // Dasturi bo'sh guruhdan import qilishning ma'nosi yo'q.
      .filter((g) => g.lessonCount > 0);
  },

  // To'liq NUSXA — manba bilan hech qanday bog'liqlik qolmaydi, shuning
  // uchun barcha `_id` lar yangidan generatsiya qilinadi (aks holda ikki
  // guruh bir xil dars id'larini ulashib, frontendda chalkashardi).
  importFrom: async (clientId, groupId, body = {}, staff = null) => {
    assertCanWrite(staff);
    const scope = scopeOf(staff);
    const group = await assertGroup(clientId, groupId, scope);

    const sourceGroup = await Group.findOne({
      _id: body.sourceGroupId,
      client: clientId,
      isDeleted: false,
    });
    if (!sourceGroup) throw new Error("group.notFound");
    // `sources` bilan bir xil qoida — fan NOMI bo'yicha (yuqoridagi izohga qara).
    const subjectIds = await sameSubjectIds(clientId, group.subject);
    if (!subjectIds.some((id) => String(id) === String(sourceGroup.subject))) {
      throw new Error("syllabus.subjectMismatch");
    }

    const source = await Syllabus.findOne({
      group: sourceGroup._id,
      client: clientId,
      isDeleted: false,
    });
    if (!source?.modules?.length) throw new Error("syllabus.sourceEmpty");

    const modules = source.modules.map((mod) => ({
      _id: new Types.ObjectId(),
      title: mod.title,
      lessons: (mod.lessons || []).map((lesson) => ({
        _id: new Types.ObjectId(),
        title: lesson.title,
        description: lesson.description || "",
        homework: lesson.homework || "",
      })),
    }));

    // Replace rejimi — maqsad guruhning eski modullari butunlay almashadi
    // (tasdiq modali frontendda ko'rsatiladi).
    const syllabus = await replaceModules(clientId, group, modules);
    return buildResponse(clientId, group, syllabus);
  },
};
