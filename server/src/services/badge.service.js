// YUTUQ NISHONLARI (API_CONTRACT_badges_monthly_rank.md §C).
// Shartlar — `utils/badge.util.js` (sof hisob), bu yerda faqat bazadan
// yig'ish, berish (job/skript) va client endpointlari.
const { isValidObjectId } = require("mongoose");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const StudentBadge = require("../models/StudentBadge");
const StudentMedal = require("../models/StudentMedal");
const clientService = require("./client.service");
const emit = require("../utils/emitter.util");
const { MONTH_RE, groupStudentsSummary, positionsInSummary } = require("../utils/gradeScore.util");
const {
  BADGE_TYPES,
  BADGE_FEATURE,
  currentMonth,
  prevMonthOf,
  evaluateStudent,
  applyMostImproved,
  summarizeEarned,
} = require("../utils/badge.util");

// Guruhning `untilDate`gacha bo'lgan butun davomat/baho tarixi (seriyalar oy
// chegarasidan o'tadi). `studentIds` berilsa faqat shular (bitta o'quvchi
// progressi uchun). Qaytaradi: { att: Map<id, [{date,status}]>, gr: Map<id, [{date,value}]> }
const loadHistory = async (groupId, untilDate, studentIds = null) => {
  const only = studentIds ? { student: { $in: studentIds } } : {};
  const [sessions, grades] = await Promise.all([
    Attendance.find({ group: groupId, date: { $lte: untilDate } })
      .select("date records.student records.status")
      .sort({ date: 1 })
      .lean(),
    Grade.find({ group: groupId, date: { $lte: untilDate }, ...only })
      .select("student date value")
      .sort({ date: 1 })
      .lean(),
  ]);
  const want = studentIds ? new Set(studentIds.map(String)) : null;
  const att = new Map();
  for (const s of sessions) {
    for (const r of s.records || []) {
      const id = String(r.student);
      if (want && !want.has(id)) continue;
      if (!att.has(id)) att.set(id, []);
      att.get(id).push({ date: s.date, status: r.status });
    }
  }
  const gr = new Map();
  for (const g of grades) {
    const id = String(g.student);
    if (!gr.has(id)) gr.set(id, []);
    gr.get(id).push({ date: g.date, value: g.value });
  }
  return { att, gr };
};

// Guruh o'quvchilari bo'yicha `month` natijalari: { [studentId]: evaluateStudent }.
// `studentIds` berilmasa — guruhdagi barcha FAOL o'quvchilar va "Eng ko'p
// o'sgan" guruh bo'yicha hisoblanadi (oy yakuni). Berilsa — faqat progress.
const evaluateGroup = async (group, month, studentIds = null) => {
  const [summary, prevSummary] = await Promise.all([
    groupStudentsSummary(group, { month }),
    groupStudentsSummary(group, { month: prevMonthOf(month) }),
  ]);
  const positions = positionsInSummary(summary);
  const prevPositions = positionsInSummary(prevSummary);
  const rankedTotal = Object.keys(positions).length;
  const ids = studentIds ? studentIds.map(String) : Object.keys(summary);
  const only = { group: group._id, month: { $lt: month }, ...(studentIds ? { student: { $in: studentIds } } : {}) };
  const [{ att, gr }, medalDocs, rankBadges] = await Promise.all([
    loadHistory(group._id, `${month}-31`, studentIds),
    StudentMedal.find(only).select("student month position").lean(),
    StudentBadge.find({ ...only, type: { $in: ["podiumStreak", "goldCollection"] } }).select("student type month").lean(),
  ]);
  const byStudent = (docs) => {
    const map = new Map();
    for (const d of docs) {
      const id = String(d.student);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(d);
    }
    return map;
  };
  const medalsOf = byStudent(medalDocs);
  const rankBadgesOf = byStudent(rankBadges);

  const results = {};
  for (const id of ids) {
    results[id] = evaluateStudent({
      attendance: att.get(id) || [],
      grades: gr.get(id) || [],
      month,
      position: positions[id] ?? null,
      rankedTotal,
      prevPosition: prevPositions[id] ?? null,
      medals: medalsOf.get(id) || [],
      earnedBefore: rankBadgesOf.get(id) || [],
    });
  }
  if (!studentIds) applyMostImproved(results);
  return results;
};

// Bitta a'zolik uchun: olingan nishonlar + joriy oy progressi (client
// StudentDetail va ota-ona WebApp umumiy bloki).
// `progress: false` — nofaol a'zolik: joriy oy hisoblanmaydi (null).
const entryBadges = async (group, studentId, { progress = true } = {}) => {
  const month = currentMonth();
  const [badges, medals, results] = await Promise.all([
    StudentBadge.find({ student: studentId, group: group._id }).select("type month").lean(),
    StudentMedal.find({ student: studentId, group: group._id }).select("month position total").sort({ month: -1 }).lean(),
    progress ? evaluateGroup(group, month, [studentId]) : null,
  ]);
  return {
    month,
    earned: summarizeEarned(badges),
    medals: medals.map((m) => ({ month: m.month, position: m.position, total: m.total })),
    progress: progress ? results[String(studentId)]?.progress || null : null,
  };
};

// O'quvchi yutuqlari kartasining holati (API_CONTRACT_student_achievements.md, 2026-10-03).
const STATE_ORDER = ["active", "finished", "left", "archived"];
const membershipState = (group, entry) => {
  if (group.isDeleted || entry.status === "archived") return "archived";
  if (group.status === "finished") return "finished";
  if (entry.status === "left") return "left";
  return "active";
};
const membershipEndedAt = (group, entry, state) => {
  if (state === "left") return entry.leftAt || null;
  if (state === "archived") return entry.archivedAt || group.deletedAt || null;
  if (state === "finished") return group.finishedAt || null;
  return null;
};

const isDuplicateError = (error) =>
  (error?.writeErrors?.length ? error.writeErrors : [error]).every((e) => (e?.code ?? e?.err?.code) === 11000);

// OY YAKUNIDA BERISH — jobs/badges.job.js va scripts/award-badges.js.
// Idempotent: allaqachon berilganlar qayta yozilmaydi (oldindan filtr +
// unique index). Shu yerda Telegram xabari YUBORILMAYDI — nishonlar
// `notified: false` bilan yoziladi, xabarni kunduzgi oynada `notifyMonth`
// yuboradi (berish erta tongda, ota-onani uyg'otmaslik uchun xabar keyin).
// Shu bilan birga oy yakunidagi 1/2/3-o'rin `StudentMedal` ga yoziladi.
// `dry: true` — hech narsa yozilmaydi, faqat nima berilishi qaytadi.
// `medalsOnly: true` — faqat StudentMedal (o'tgan oylar tarixini to'ldirish,
// nishon va socket yo'q): `award-badges.js 2026-08 --medals-only`.
const awardMonth = async (month, { dry = false, medalsOnly = false } = {}) => {
  if (!MONTH_RE.test(month || "")) throw new Error("validation.month");

  const groups = await Group.find({ status: "active", isDeleted: false }).select("client center name").lean();
  const featureCache = new Map();
  const report = { month, groups: groups.length, skippedTariff: 0, awarded: [], inserted: 0, medals: 0 };

  for (const group of groups) {
    const clientKey = String(group.client);
    if (!featureCache.has(clientKey))
      featureCache.set(clientKey, await clientService.hasPermission(group.client, BADGE_FEATURE));
    if (!featureCache.get(clientKey)) {
      report.skippedTariff++;
      continue;
    }

    const results = await evaluateGroup(group, month);
    const base = { client: group.client, center: group.center, group: group._id, month };
    const candidates = [];
    const medals = [];
    for (const [studentId, r] of Object.entries(results)) {
      for (const type of medalsOnly ? [] : BADGE_TYPES) {
        if (r.earned[type]) candidates.push({ ...base, student: studentId, type, meta: r.earned[type] });
      }
      const { position, total } = r.progress.champion || {};
      if (position >= 1 && position <= 3) medals.push({ ...base, student: studentId, position, total });
    }

    const [existing, existingMedals] = await Promise.all([
      candidates.length ? StudentBadge.find({ group: group._id, month }).select("student type").lean() : [],
      medals.length ? StudentMedal.find({ group: group._id, month }).select("student").lean() : [],
    ]);
    const has = new Set(existing.map((b) => `${b.student}:${b.type}`));
    const fresh = candidates.filter((c) => !has.has(`${c.student}:${c.type}`));
    const hasMedal = new Set(existingMedals.map((m) => String(m.student)));
    const freshMedals = medals.filter((m) => !hasMedal.has(String(m.student)));
    if (!fresh.length && !freshMedals.length) continue;

    report.awarded.push(
      ...fresh.map((c) => ({ group: String(group._id), groupName: group.name, student: c.student, type: c.type, meta: c.meta })),
      ...freshMedals.map((m) => ({
        group: String(group._id),
        groupName: group.name,
        student: m.student,
        type: "medal",
        meta: { position: m.position, total: m.total },
      })),
    );
    if (dry) continue;

    if (fresh.length) {
      const students = await Student.find({ _id: { $in: [...new Set(fresh.map((c) => c.student))] }, isDeleted: false })
        .select("groups")
        .lean();
      const entryOf = new Map();
      for (const st of students) {
        const entry = st.groups.find((e) => String(e.group) === String(group._id) && e.status === "active");
        if (entry) entryOf.set(String(st._id), entry._id);
      }
      for (const c of fresh) c.entry = entryOf.get(String(c.student)) || null;
      report.inserted += await insertIgnoringDuplicates(StudentBadge, fresh);
    }
    if (freshMedals.length) report.medals += await insertIgnoringDuplicates(StudentMedal, freshMedals);

    if (medalsOnly) continue;
    // `client:` room — Owner ham, Staff ham shu yerda (socket.config joinRooms);
    // `center:` roomiga faqat Staff qo'shiladi. Frontend `groupId` bo'yicha filtrlaydi.
    emit(`client:${group.client}`, "badge:awarded", { groupId: String(group._id), month });
  }
  return report;
};

// Parallel ishga tushirishda takror (E11000) — e'tiborsiz, boshqasi xato.
// Qaytaradi: yozilgan hujjatlar soni.
const insertIgnoringDuplicates = async (Model, docs) => {
  try {
    return (await Model.insertMany(docs, { ordered: false })).length;
  } catch (error) {
    if (!isDuplicateError(error)) throw error;
    return error.insertedDocs?.length || 0;
  }
};

// XABAR BOSQICHI — `month` uchun hali xabar qilinmagan nishonlar bo'yicha
// a'zolik boshiga BITTA Telegram xabari (dedupKey ham takrorni to'sadi).
// Xabar ketgach (yoki a'zolik endi faol bo'lmasa) `notified: true`.
const notifyMonth = async (month) => {
  if (!MONTH_RE.test(month || "")) throw new Error("validation.month");
  // Aylanma import bo'lmasin (parentNotification → student.service → ...).
  const parentNotification = require("./parentNotification.service");

  const pending = await StudentBadge.find({ month, notified: false }).select("group student type").lean();
  const byEntry = new Map();
  for (const b of pending) {
    const key = `${b.group}:${b.student}`;
    if (!byEntry.has(key)) byEntry.set(key, { group: b.group, student: b.student, ids: [], types: [] });
    const item = byEntry.get(key);
    item.ids.push(b._id);
    item.types.push(b.type);
  }

  let sent = 0;
  for (const item of byEntry.values()) {
    const student = await Student.findOne({ _id: item.student, isDeleted: false });
    const entry = student?.groups.find((e) => String(e.group) === String(item.group) && e.status === "active");
    if (entry) {
      const types = BADGE_TYPES.filter((ty) => item.types.includes(ty));
      await parentNotification.onBadges({ student, entry, month, types });
      sent++;
    }
    await StudentBadge.updateMany({ _id: { $in: item.ids } }, { $set: { notified: true } });
  }
  return { month, entries: byEntry.size, sent };
};

module.exports = {
  evaluateGroup,
  entryBadges,
  awardMonth,
  notifyMonth,

  // GET /badges/group/:groupId?month= — guruh ro'yxatidagi ikonkalar
  // (default — o'tgan oy). Staff bo'lsa faqat o'z filiali guruhi.
  getGroup: async (clientId, groupId, monthRaw, centerScope = null) => {
    const month = monthRaw || prevMonthOf(currentMonth());
    if (!MONTH_RE.test(month)) throw new Error("validation.month");
    if (!isValidObjectId(groupId)) throw new Error("group.notFound");
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false }).select("center").lean();
    if (!group || (centerScope && String(group.center) !== String(centerScope))) throw new Error("group.notFound");

    const badges = await StudentBadge.find({ client: clientId, group: groupId, month }).select("student type").lean();
    const items = {};
    for (const b of badges) {
      const id = String(b.student);
      if (!items[id]) items[id] = [];
      items[id].push(b.type);
    }
    for (const id of Object.keys(items)) items[id].sort((a, b) => BADGE_TYPES.indexOf(a) - BADGE_TYPES.indexOf(b));
    return { month, items };
  },

  // GET /badges/student/:studentId — faqat SHU client (staff bo'lsa uning
  // filiali) guruhlari bo'yicha: olingan nishonlar, oylik medallar va joriy
  // oy progressi. `teaching` ({ field, staffId }) — o'qituvchi/yordamchi:
  // faqat o'zi dars beradigan guruhlar (API_CONTRACT_student_achievements.md).
  // `student` — faqat ism va rasm (telefon/ota-ona/pul hech qachon).
  getStudent: async (clientId, studentId, centerScope = null, { teaching = null } = {}) => {
    if (!isValidObjectId(studentId)) throw new Error("student.notFound");
    const student = await Student.findOne({ _id: studentId, isDeleted: false }).select("fullName photo groups");
    if (!student) throw new Error("student.notFound");

    // Bir guruhda bir necha a'zolik bo'lishi mumkin (chiqib qayta qo'shilgan) —
    // guruh bo'yicha bittasi: faol bo'lsa o'sha, aks holda oxirgisi. Arxivlangan
    // a'zolik ham olinadi — yutuqlar doimiy (API_CONTRACT_student_achievements.md, 2026-10-03).
    const entryByGroup = new Map();
    for (const e of student.groups) {
      if (String(e.client) !== String(clientId)) continue;
      if (centerScope && String(e.center) !== String(centerScope)) continue;
      const key = String(e.group);
      const cur = entryByGroup.get(key);
      if (!cur || e.status === "active" || (cur.status !== "active" && (e.joinedAt || 0) > (cur.joinedAt || 0)))
        entryByGroup.set(key, e);
    }
    if (!entryByGroup.size) throw new Error("student.notFound");

    // Arxivlangan (isDeleted) guruh ham — undagi medal/nishonlar yo'qolmasin.
    const groups = await Group.find({
      _id: { $in: [...entryByGroup.keys()] },
      client: clientId,
      ...(teaching ? { [teaching.field]: teaching.staffId } : {}),
    })
      .select("name subject status isDeleted deletedAt finishedAt")
      .lean();
    // O'qituvchining bu o'quvchi bilan umumiy guruhi yo'q — o'quvchi "topilmadi".
    if (!groups.length) throw new Error("student.notFound");
    const subjects = await Subject.find({ _id: { $in: groups.map((g) => g.subject).filter(Boolean) } })
      .select("name")
      .lean();
    const subjectName = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));

    const out = [];
    const month = currentMonth();
    for (const group of groups) {
      const entry = entryByGroup.get(String(group._id));
      const state = membershipState(group, entry);
      const data = await entryBadges(group, student._id, { progress: state === "active" });
      // Nofaol guruh, yutuqsiz — ro'yxatni to'ldirmaydi.
      if (state !== "active" && !data.earned.length && !data.medals.length) continue;
      out.push({
        groupId: String(group._id),
        entryId: String(entry._id),
        groupName: group.name || subjectName[String(group.subject)] || "",
        subjectName: subjectName[String(group.subject)] || "",
        status: entry.status,
        state,
        startedAt: entry.joinedAt || null,
        endedAt: membershipEndedAt(group, entry, state),
        earned: data.earned,
        medals: data.medals,
        progress: data.progress,
      });
    }
    if (!out.length) throw new Error("student.notFound");
    out.sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
        (b.endedAt || b.startedAt || 0) - (a.endedAt || a.startedAt || 0),
    );
    return {
      student: { _id: String(student._id), fullName: student.fullName, photo: student.photo || null },
      scope: teaching ? "teacher" : "full",
      month,
      groups: out,
    };
  },
};
