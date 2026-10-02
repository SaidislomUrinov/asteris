const Grade = require("../models/Grade");
const Group = require("../models/Group");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const { todayString, currentMonthString } = require("../utils/date.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { sourceWindowsOf, transferredGrades } = require("../utils/transferOverlay.util");

// Guruhga boshqa guruhdan O'TKAZILGAN o'quvchilar (manba zanjiri bilan) —
// ularning oldingi baholari shu guruh ko'rinishiga qo'shiladi
// (API_CONTRACT_student_transfer.md §4).
const transferredStudentsOf = (groupId, studentId = null) =>
  Student.find(
    {
      ...(studentId ? { _id: studentId } : {}),
      isDeleted: false,
      groups: { $elemMatch: { group: groupId, "transferredFrom.0": { $exists: true } } },
    },
    { _id: 1, "groups.group": 1, "groups.transferredFrom": 1 },
  );

const DTO = (g) => ({
  _id: String(g._id),
  group: String(g.group),
  student: String(g.student),
  date: g.date,
  value: g.value,
  // Kim qo'ygani — UI "o'zinikini tahrirlash" qoidasi uchun.
  teacher: g.teacher ? String(g.teacher) : null,
  note: g.note || "",
  createdAt: g.createdAt,
});

// Guruh shu clientniki ekanini (va o'qituvchi bo'lsa — o'ziniki ekanini)
// tekshiradi. Ikkinchisini route darajasidagi `requireTeacherGroup` ham
// qiladi, bu yerda servis mustaqil ishonchli bo'lishi uchun takrorlanadi.
// Guruhga biriktirilish orqali cheklanadigan rollar (o'qituvchi va yordamchi
// o'qituvchi) → Group'dagi mos maydon.
const SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };

// `scope` — { id, field } yoki null (cheklovsiz: Owner/Reception).
const assertGroup = async (clientId, groupId, scope = null) => {
  const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
  if (!group) throw new Error("group.notFound");
  if (scope?.id && String(group[scope.field] || "") !== String(scope.id)) {
    throw new Error("auth.forbidden");
  }
  return group;
};

// ─── Kim yoza oladi / o'chira oladi ──────────────────────────────────────
// Baho va dars rejasi — O'QUV JARAYONI yozuvlari. Ularni faqat darsni
// olib boruvchi kishi kiritadi: o'qituvchi va yordamchi o'qituvchi.
// Resepshin faqat KO'RADI, Boshliq (Owner) esa faqat O'CHIRA oladi
// (noto'g'ri yozuvni olib tashlash — nazorat huquqi).
//
// `staff` yo'q bo'lsa — bu Client Owner (mustaqil auth zanjiri).
const WRITER_ROLES = ["teacher", "assistant"];

const assertCanWrite = (staff) => {
  if (!WRITER_ROLES.includes(staff?.role)) throw new Error("auth.forbidden");
};

// O'chirish: Owner — istalganini; o'qituvchi — o'z guruhidagi barchasini;
// yordamchi — FAQAT o'zi yozganini; qolganlar — yo'q.
const assertCanDelete = (staff, doc) => {
  if (!staff) return; // Owner
  if (staff.role === "teacher") return;
  if (staff.role === "assistant" && String(doc.teacher || "") === String(staff._id)) return;
  throw new Error("auth.forbidden");
};

// Staff obyektidan qamrov yasaydi (rol biriktirish talab qilmasa — null).
const scopeOf = (staff) => {
  const field = SCOPE_FIELD[staff?.role];
  return field ? { id: staff._id, field } : null;
};

module.exports = {
  // Oylik baholar — guruh bo'yicha barcha o'quvchilar (davomat matritsasi
  // bilan bir xil shakl: student → { date: value }).
  listByGroup: async (clientId, groupId, month, scope = null) => {
    await assertGroup(clientId, groupId, scope);

    const targetMonth = month || currentMonthString();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("attendance.invalidMonth");

    const grades = await Grade.find({
      group: groupId,
      date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
    });

    const byStudent = {};
    for (const g of grades) {
      const sid = String(g.student);
      if (!byStudent[sid]) byStudent[sid] = {};
      byStudent[sid][g.date] = {
        value: g.value,
        note: g.note || "",
        teacher: g.teacher ? String(g.teacher) : null,
      };
    }

    // Oldingi guruhdagi baholar — o'z sanasi bilan, faqat o'qish uchun.
    const carried = await transferredGrades(sourceWindowsOf(await transferredStudentsOf(groupId), groupId), {
      $gte: `${targetMonth}-01`,
      $lte: `${targetMonth}-31`,
    });
    for (const [sid, map] of carried) {
      if (!byStudent[sid]) byStudent[sid] = {};
      for (const [date, rec] of map) {
        if (byStudent[sid][date]) continue;
        byStudent[sid][date] = {
          value: rec.value,
          note: rec.note,
          teacher: rec.teacher,
          transferred: true,
          fromGroup: rec.fromGroup,
        };
      }
    }

    // O'rtacha baho — o'quvchining shu oydagi barcha baholari bo'yicha.
    const averages = {};
    for (const [sid, map] of Object.entries(byStudent)) {
      const values = Object.values(map).map((x) => x.value);
      averages[sid] = values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : 0;
    }

    return { month: targetMonth, grades: byStudent, averages };
  },

  // Baho qo'yish/yangilash. Bitta kunda bitta o'quvchiga bitta baho —
  // qayta qo'yilsa ustiga yoziladi (upsert).
  set: async (clientId, groupId, body, staff = null) => {
    // Baho qo'yish/tahrirlash — faqat o'qituvchi va yordamchi o'qituvchi.
    assertCanWrite(staff);

    const { studentId, value, note = "", date } = body;
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 10) throw new Error("grade.invalidValue");

    const group = await assertGroup(clientId, groupId, scopeOf(staff));

    const target = date || todayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw new Error("group.invalidDate");
    if (target > todayString()) throw new Error("grade.futureNotAllowed");

    // O'quvchi shu guruhda faol bo'lishi shart.
    const student = await Student.findOne({
      _id: studentId,
      isDeleted: false,
      groups: { $elemMatch: { group: groupId, client: clientId, status: "active" } },
    }).select("_id fullName");
    if (!student) throw new Error("student.notInGroup");

    // Kelmagan o'quvchiga baho qo'yib bo'lmaydi — davomat "absent" yoki
    // "excused" (sababli) bo'lsa rad etiladi. Frontend ham shu holatni
    // oldindan yashiradi, bu yerda yakuniy tekshiruv (haqiqat manbai backend).
    const session = await Attendance.findOne({ group: groupId, date: target });
    const record = session?.records.find((r) => String(r.student) === String(studentId));
    if (record?.status === "absent") throw new Error("grade.studentAbsent");
    if (record?.status === "excused") throw new Error("grade.studentExcused");

    // Mavjud bahoni USTIGA yozish ham "tahrirlash" — yordamchi boshqa
    // kishi qo'ygan bahoga tega olmaydi.
    const existing = await Grade.findOne({ group: groupId, student: studentId, date: target });
    if (existing) assertCanDelete(staff, existing);

    const grade = await Grade.findOneAndUpdate(
      { group: groupId, student: studentId, date: target },
      {
        $set: {
          client: clientId,
          center: group.center,
          teacher: staff?._id || null,
          value: num,
          scale: 10,
          note: String(note || "").trim().slice(0, 200),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    emit(`client:${clientId}`, "grade:set", {
      groupId: String(groupId),
      studentId: String(studentId),
      date: target,
      value: num,
      note: grade.note || "",
      teacher: grade.teacher ? String(grade.teacher) : null,
    });

    return DTO(grade);
  },

  // Baho — katakcha qiymati (student+guruh+sana bo'yicha noyob), arxivlanadigan
  // obyekt emas: tozalanganda yozuv o'chadi, lekin eski qiymat audit
  // jurnalida qoladi (kim, qachon, qaysi baho).
  remove: async (clientId, groupId, gradeId, staff = null, actor = null) => {
    await assertGroup(clientId, groupId, scopeOf(staff));

    const target = await Grade.findOne({ _id: gradeId, group: groupId, client: clientId });
    if (!target) throw new Error("grade.notFound");
    assertCanDelete(staff, target);

    const grade = await Grade.findOneAndDelete({ _id: gradeId, group: groupId, client: clientId });
    if (!grade) throw new Error("grade.notFound");
    void audit.log({
      actor,
      client: clientId,
      center: staff?.center || null,
      action: "grade:removed",
      entity: { type: "grade", id: grade._id, label: grade.date },
      changes: [{ field: "value", from: grade.value, to: null }],
      meta: { groupId: String(groupId), studentId: String(grade.student) },
    });

    emit(`client:${clientId}`, "grade:removed", {
      groupId: String(groupId),
      studentId: String(grade.student),
      date: grade.date,
    });

    return { _id: String(grade._id) };
  },

  // O'quvchi baholari XULOSASI — Student Detail sahifasi uchun.
  // Har guruh bo'yicha: umumiy o'rtacha ("8.5 / 10") va FAQAT o'zi o'qigan
  // oylar kesimida o'rtacha. Baho yo'q oylar ro'yxatga tushmaydi.
  studentSummary: async (clientId, studentId) => {
    const student = await Student.findOne({ _id: studentId, isDeleted: false }).select("groups");
    if (!student) throw new Error("student.notFound");

    // Faqat SHU clientning guruh yozuvlari (Student hujjati tenant'lararo umumiy).
    const entries = student.groups.filter((g) => String(g.client) === String(clientId));
    const groupIds = entries.map((g) => g.group);
    if (!groupIds.length) return [];

    const grades = await Grade.find({ student: studentId, group: { $in: groupIds } }).sort({
      date: 1,
    });

    // O'tkazilgan a'zolik oldingi guruh baholarini ham o'z xulosasiga oladi
    // (API_CONTRACT_student_transfer.md §4) — guruh matritsasi bilan bir xil.
    const rows = grades.map((g) => ({ group: String(g.group), date: g.date, value: g.value }));
    for (const entry of entries) {
      if (!entry.transferredFrom?.length) continue;
      const carried = await transferredGrades(sourceWindowsOf([student], entry.group));
      for (const [date, rec] of carried.get(String(studentId)) || []) {
        rows.push({ group: String(entry.group), date, value: rec.value });
      }
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));

    const byGroup = new Map();
    for (const g of rows) {
      const gid = String(g.group);
      if (!byGroup.has(gid)) byGroup.set(gid, { values: [], months: new Map() });
      const bucket = byGroup.get(gid);
      bucket.values.push(g.value);

      const month = g.date.slice(0, 7);
      if (!bucket.months.has(month)) bucket.months.set(month, []);
      bucket.months.get(month).push(g.value);
    }

    const avg = (list) =>
      list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : 0;

    return [...byGroup.entries()].map(([group, bucket]) => ({
      group,
      average: avg(bucket.values),
      count: bucket.values.length,
      months: [...bucket.months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, values]) => ({ month, average: avg(values), count: values.length })),
    }));
  },

  // Bitta o'quvchining shu guruhdagi barcha baholari (eng yangisi birinchi).
  listByStudent: async (clientId, groupId, studentId, scope = null) => {
    await assertGroup(clientId, groupId, scope);
    const grades = await Grade.find({ group: groupId, student: studentId }).sort({ date: -1 });
    const own = grades.map(DTO);

    const carried = await transferredGrades(
      sourceWindowsOf(await transferredStudentsOf(groupId, studentId), groupId),
    );
    const ownDates = new Set(own.map((g) => g.date));
    const extra = [...(carried.get(String(studentId)) || [])]
      .filter(([date]) => !ownDates.has(date))
      .map(([date, rec]) => ({
        _id: String(rec._id),
        group: rec.fromGroup,
        student: String(studentId),
        date,
        value: rec.value,
        teacher: rec.teacher,
        note: rec.note,
        createdAt: rec.createdAt,
        transferred: true,
      }));

    return [...own, ...extra].sort((a, b) => (a.date < b.date ? 1 : -1));
  },
};
