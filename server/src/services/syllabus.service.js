const { isValidObjectId } = require("mongoose");
const Syllabus = require("../models/Syllabus");
const TeachingPlan = require("../models/TeachingPlan");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const emit = require("../utils/emitter.util");
const {
  flattenLessons,
  countDoneLessons,
  getDoneDates,
  buildProgress,
  offsetForCurrentLesson,
} = require("../utils/syllabusProgress.util");
// Daraxt qoidalari (limitlar, normalizatsiya, nusxa) TeachingPlan bilan umumiy.
const {
  normalizeModules,
  cloneModules,
  moduleDTO,
  lightModules,
  countLessons,
} = require("../utils/syllabusTree.util");

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

// GET javobining yagona shakli — import ham, PUT ham aynan shuni qaytaradi,
// shuning uchun frontend har amaldan keyin bir xil holatni oladi.
const buildResponse = async (clientId, group, syllabus) => {
  const modules = syllabus?.modules || [];
  const lessons = flattenLessons(modules);
  const [doneCount, attendanceDates] = await Promise.all([
    countDoneLessons(clientId, group._id, group.lessonOffset),
    getDoneDates(clientId, group._id),
  ]);

  return {
    groupId: String(group._id),
    lessonOffset: group.lessonOffset || 0,
    modules: modules.map(moduleDTO),
    progress: buildProgress(lessons, doneCount, modules.length),
    // Xronologik davomat sanalari — kalendarda har bir dars AYNAN qaysi
    // kunda o'tilganini ko'rsatish uchun (useLessonSchedule.js, frontend).
    attendanceDates,
  };
};

// "Hozir qaysi darsdamiz" — K (yoyilgan ro'yxatda 1-dan). Butun son va
// 1 ≤ K ≤ totalLessons bo'lishi shart (API_CONTRACT_teaching_plans.md §4.2).
const parseLessonNo = (raw, totalLessons) => {
  const no = raw === null || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(no) || no < 1 || no > totalLessons) {
    throw new Error("syllabus.invalidCurrentLesson");
  }
  return no;
};

const hasValue = (value) => value !== undefined && value !== null && value !== "";

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

    const syllabus = await Syllabus.findOne({ group: group._id, client: clientId, isDeleted: false });

    if (hasValue(body.currentLessonNo)) {
      // "Joriy darsni o'zgartirish" — offset serverda YAGONA formula bilan
      // hisoblanadi (syllabusProgress.util.js#offsetForCurrentLesson).
      const totalLessons = countLessons(syllabus?.modules);
      if (!totalLessons) throw new Error("syllabus.sourceEmpty");
      const no = parseLessonNo(body.currentLessonNo, totalLessons);
      group.lessonOffset = await offsetForCurrentLesson(clientId, group._id, no);
    } else {
      // Manfiy butun son ham ruxsat (reja guruh boshlanganidan keyin biriktirilgan).
      const offset = hasValue(body.lessonOffset) ? Number(body.lessonOffset) : NaN;
      if (!Number.isInteger(offset)) throw new Error("syllabus.invalidOffset");
      group.lessonOffset = offset;
    }
    await group.save();

    emit(`client:${clientId}`, "syllabus:changed", { groupId: String(group._id) });
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
        const lessonCount = countLessons(modules);
        return {
          _id: String(g._id),
          // Guruh nomi frontendda saqlanmaydi (fan nomi + activeId ?? pendingId)
          // — import ro'yxati uchun backendda tayyorlab beriladi.
          name: `${subjectName} - ${g.activeId ?? g.pendingId}`,
          moduleCount: modules.length,
          lessonCount,
          studentsCount: countMap[String(g._id)] || 0,
          // Yengil daraxt — "Hozir qaysi darsdamiz?" tanlovchisi uchun.
          modules: lightModules(modules),
        };
      })
      // Dasturi bo'sh guruhdan import qilishning ma'nosi yo'q.
      .filter((g) => g.lessonCount > 0);
  },

  // Import uchun O'QITUVCHILAR REJALARI — shu fandagi (fan NOMI bo'yicha,
  // `sources` bilan bir xil qoida) barcha o'qituvchilarning shablon rejalari,
  // har birida muallif ko'rsatiladi. Staff faqat o'z filiali rejalarini
  // ko'radi (staffCenter). Bo'sh rejalar chiqmaydi.
  plans: async (clientId, groupId, scope = null, staffCenter = "", staff = null) => {
    const group = await assertGroup(clientId, groupId, scope);
    const subjectIds = await sameSubjectIds(clientId, group.subject);

    const filter = { client: clientId, subject: { $in: subjectIds }, isDeleted: false };
    if (staffCenter) filter.center = staffCenter;

    const plans = (await TeachingPlan.find(filter).lean()).filter((p) => countLessons(p.modules) > 0);
    if (!plans.length) return [];

    // Mualliflar — bitta so'rovda (reja boshiga emas).
    const authorIds = [...new Set(plans.map((p) => String(p.staff)))];
    const authors = await Staff.find({ _id: { $in: authorIds }, client: clientId }, { name: 1 }).lean();
    const nameMap = Object.fromEntries(authors.map((a) => [String(a._id), a.name]));
    const myId = staff?._id ? String(staff._id) : null;

    return plans
      .map((p) => ({
        _id: String(p._id),
        title: p.title,
        teacher: { _id: String(p.staff), name: nameMap[String(p.staff)] || "?" },
        // Owner uchun doim false (`staff` yo'q).
        mine: Boolean(myId) && String(p.staff) === myId,
        moduleCount: p.modules.length,
        lessonCount: countLessons(p.modules),
        updatedAt: p.updatedAt,
        modules: lightModules(p.modules),
      }))
      .sort((a, b) => Number(b.mine) - Number(a.mine) || (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  // To'liq NUSXA — manba bilan hech qanday bog'liqlik qolmaydi, shuning
  // uchun barcha `_id` lar yangidan generatsiya qilinadi (aks holda ikki
  // guruh bir xil dars id'larini ulashib, frontendda chalkashardi).
  //
  // Manba: `{ sourceGroupId }` (boshqa guruh dasturi) YOKI `{ planId }`
  // (o'qituvchi shablon rejasi). Ixtiyoriy `currentLessonNo` — "hozir qaysi
  // darsdamiz" → `lessonOffset` (API_CONTRACT_teaching_plans.md §3).
  importFrom: async (clientId, groupId, body = {}, staff = null) => {
    assertCanWrite(staff);
    const scope = scopeOf(staff);
    const group = await assertGroup(clientId, groupId, scope);
    // `sources`/`plans` bilan bir xil qoida — fan NOMI bo'yicha (yuqoridagi izohga qara).
    const subjectIds = await sameSubjectIds(clientId, group.subject);
    const sameSubject = (id) => subjectIds.some((s) => String(s) === String(id));

    let sourceModules;
    if (hasValue(body.planId)) {
      if (!isValidObjectId(body.planId)) throw new Error("teachingPlan.notFound");
      const filter = { _id: body.planId, client: clientId, isDeleted: false };
      // Staff faqat o'z filiali rejalaridan import qiladi (`plans` ro'yxati bilan bir xil).
      if (staff?.center) filter.center = staff.center;
      const plan = await TeachingPlan.findOne(filter);
      if (!plan) throw new Error("teachingPlan.notFound");
      if (!sameSubject(plan.subject)) throw new Error("syllabus.subjectMismatch");
      sourceModules = plan.modules;
    } else {
      const sourceGroup = await Group.findOne({
        _id: body.sourceGroupId,
        client: clientId,
        isDeleted: false,
      });
      if (!sourceGroup) throw new Error("group.notFound");
      if (!sameSubject(sourceGroup.subject)) throw new Error("syllabus.subjectMismatch");

      const source = await Syllabus.findOne({
        group: sourceGroup._id,
        client: clientId,
        isDeleted: false,
      });
      sourceModules = source?.modules;
    }

    const totalLessons = countLessons(sourceModules);
    if (!sourceModules?.length || !totalLessons) throw new Error("syllabus.sourceEmpty");

    // Diapazon YOZISHDAN OLDIN tekshiriladi — xato bo'lsa dastur o'zgarmaydi.
    // Berilmasa offset o'zgarmaydi (eski xatti-harakat).
    const lessonNo = hasValue(body.currentLessonNo)
      ? parseLessonNo(body.currentLessonNo, totalLessons)
      : null;

    // Offset `replaceModules` dan OLDIN saqlanadi: u `syllabus:changed`
    // emit qiladi, boshqa qurilmalar refetch qilganda yangi offset tayyor bo'lsin.
    if (lessonNo !== null) {
      group.lessonOffset = await offsetForCurrentLesson(clientId, group._id, lessonNo);
      await group.save();
    }

    // Replace rejimi — maqsad guruhning eski modullari butunlay almashadi
    // (tasdiq modali frontendda ko'rsatiladi).
    const syllabus = await replaceModules(clientId, group, cloneModules(sourceModules));

    return buildResponse(clientId, group, syllabus);
  },
};
