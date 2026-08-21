const moment = require("moment-timezone");
const { Types } = require("mongoose");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const Expense = require("../models/Expense");
const SalaryTransaction = require("../models/SalaryTransaction");
const Attendance = require("../models/Attendance");
const Syllabus = require("../models/Syllabus");
const studentService = require("./student.service");
const salaryService = require("./salary.service");
const reportCache = require("../utils/reportCache.util");
const { formatMonth } = require("../utils/date.util");
const { flattenLessons, buildProgress, countDoneMap } = require("../utils/syllabusProgress.util");

// Hisobotlar — SAQLANADIGAN model yo'q, hammasi mavjud kolleksiyalardan
// (Student.groups[].payments, Expense, SalaryTransaction, Attendance, Group)
// so'rov paytida hisoblanadi. Natija `reportCache.util.js` da 5 daqiqa
// keshlanadi va to'lov/xarajat/davomat o'zgarganda darhol bekor qilinadi.
//
// date.util.js sana FORMATLASH uchun yetarli, lekin bu yerda davr
// CHEGARALARI (hafta boshi, oldingi davr, guruhlash oynalari) kerak —
// shuning uchun moment-timezone to'g'ridan-to'g'ri ishlatiladi, xuddi
// date.util.js ning o'zi kabi va AYNAN o'sha zona bilan.
const TZ = "Asia/Tashkent";

const UZ_MONTHS = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyun",
  "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek",
];

const oid = (value) => new Types.ObjectId(String(value));

// "period" ni aniq unix chegaralarga aylantiradi + taqqoslash uchun
// AYNAN shu uzunlikdagi oldingi davrni qaytaradi.
const resolvePeriod = ({ period = "monthly", from = "", to = "" }) => {
  const now = moment.tz(TZ);
  let start;
  let end;

  if (period === "custom" && from && to) {
    start = moment.tz(from, "YYYY-MM-DD", TZ).startOf("day");
    end = moment.tz(to, "YYYY-MM-DD", TZ).endOf("day");
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      throw new Error("report.invalidRange");
    }
  } else if (period === "daily") {
    start = now.clone().startOf("day");
    end = now.clone().endOf("day");
  } else if (period === "weekly") {
    start = now.clone().startOf("isoWeek");
    end = now.clone().endOf("isoWeek");
  } else {
    start = now.clone().startOf("month");
    end = now.clone().endOf("month");
  }

  const fromUnix = start.unix();
  const toUnix = end.unix();
  const length = toUnix - fromUnix;

  return {
    period,
    fromUnix,
    toUnix,
    fromDay: start.format("YYYY-MM-DD"),
    toDay: end.format("YYYY-MM-DD"),
    // Oldingi davr — o'sish foizini hisoblash uchun (aynan bir xil uzunlik)
    prevFromUnix: fromUnix - length - 1,
    prevToUnix: fromUnix - 1,
    // Grafik oynasi: qisqa davrlar kunlik, uzun davrlar oylik guruhlanadi
    defaultGroupBy: length <= 40 * 24 * 3600 ? "day" : "month",
  };
};

// Guruhlash oynasining kaliti va o'qiladigan yorlig'i.
const bucketOf = (unix, groupBy) => {
  const m = moment.unix(unix).tz(TZ);
  if (groupBy === "month") {
    return { key: m.format("YYYY-MM"), label: `${UZ_MONTHS[m.month()]} ${m.format("YYYY")}` };
  }
  if (groupBy === "week") {
    const start = m.clone().startOf("isoWeek");
    return { key: start.format("YYYY-MM-DD"), label: `${start.date()} ${UZ_MONTHS[start.month()]}` };
  }
  return { key: m.format("YYYY-MM-DD"), label: `${m.date()} ${UZ_MONTHS[m.month()]}` };
};

const bucketOfDay = (dayStr, groupBy) =>
  bucketOf(moment.tz(dayStr, "YYYY-MM-DD", TZ).startOf("day").unix(), groupBy);

// Foiz o'zgarish — oldingi davr 0 bo'lsa 0 qaytadi (bo'linish xatosi va
// "cheksiz o'sish" ko'rsatilmasligi uchun).
const growth = (current, previous) => {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
};

// Tenant qamrovidagi guruh-yozuvlari (Student.groups[]) bo'ylab bitta
// aylanish — barcha hisobotlar SHU yagona yuklashdan foydalanadi.
const loadStudents = async (clientId, center) => {
  const filter = { "groups.client": clientId, isDeleted: false };
  if (center) filter["groups.center"] = center;
  return Student.find(filter, { fullName: 1, phone: 1, groups: 1 });
};

const scopedEntries = (students, clientId, center) => {
  const rows = [];
  for (const student of students) {
    for (const entry of student.groups || []) {
      if (String(entry.client) !== String(clientId)) continue;
      if (center && String(entry.center) !== String(center)) continue;
      rows.push({ student, entry });
    }
  }
  return rows;
};

// Berilgan oraliqdagi to'lov qatorlari (barcha statuslar — chaqiruvchi
// o'zi filtrlaydi: "paid" tushum, "refunded" qaytarilgan).
const paymentRows = (entries, fromUnix, toUnix) => {
  const rows = [];
  for (const { student, entry } of entries) {
    for (const p of entry.payments || []) {
      if (p.date < fromUnix || p.date > toUnix) continue;
      rows.push({
        studentId: student._id,
        studentName: student.fullName,
        group: entry.group,
        center: entry.center,
        amount: p.amount,
        type: p.type,
        status: p.status,
        date: p.date,
        collectedBy: p.collectedBy,
        collectedByKind: p.collectedByKind,
      });
    }
  }
  return rows;
};

const sumPaid = (rows) => rows.reduce((sum, r) => (r.status === "paid" ? sum + r.amount : sum), 0);

const expenseFilter = (clientId, center, fromUnix, toUnix) => {
  const filter = {
    client: clientId,
    status: "active",
    createdAt: { $gte: fromUnix, $lte: toUnix },
  };
  if (center) filter.center = center;
  return filter;
};

// Haqiqatda TARQATILGAN pul: avans + oldindan olingan summa. Bonus/jarima
// yakuniy oylikning tarkibiy qismi, alohida "to'langan pul" emas.
const PAYOUT_TYPES = ["advance", "withdrawal"];

const salaryFilter = (clientId, center, fromUnix, toUnix) => {
  const filter = {
    client: clientId,
    status: "active",
    type: { $in: PAYOUT_TYPES },
    createdAt: { $gte: fromUnix, $lte: toUnix },
  };
  if (center) filter.center = center;
  return filter;
};

const attendanceFilter = (clientId, center, fromDay, toDay) => {
  const filter = { client: clientId, date: { $gte: fromDay, $lte: toDay } };
  if (center) filter.center = center;
  return filter;
};

// Davomat foizi: kelgan (present) / belgilangan barcha yozuvlar.
// "late" — status emas, bayroq (Attendance modeli izohi), shuning uchun
// kechikkan o'quvchi ham "present" sifatida hisoblanadi.
const attendanceRateOf = (sessions) => {
  let total = 0;
  let present = 0;
  for (const s of sessions) {
    for (const r of s.records || []) {
      total += 1;
      if (r.status === "present") present += 1;
    }
  }
  return total ? Math.round((present / total) * 100) : 0;
};

// Oraliq bo'yicha xom raqamlar (comparison uchun oldingi davrda ham
// AYNAN shu funksiya ishlatiladi).
const rawTotals = async (clientId, center, entries, fromUnix, toUnix, fromDay, toDay) => {
  const [expenseAgg, salaryAgg, sessions] = await Promise.all([
    Expense.aggregate([
      { $match: { ...expenseFilter(clientId, center, fromUnix, toUnix), client: oid(clientId), ...(center ? { center: oid(center) } : {}) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    SalaryTransaction.aggregate([
      { $match: { ...salaryFilter(clientId, center, fromUnix, toUnix), client: oid(clientId), ...(center ? { center: oid(center) } : {}) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Attendance.find(attendanceFilter(clientId, center, fromDay, toDay), { records: 1 }),
  ]);

  const revenue = sumPaid(paymentRows(entries, fromUnix, toUnix));
  const expense = expenseAgg[0]?.total || 0;
  const salaryPaid = salaryAgg[0]?.total || 0;

  return {
    revenue,
    expense,
    salaryPaid,
    // Sof foyda — tushumdan HAM xarajat, HAM tarqatilgan ish haqi ayiriladi
    // (ish haqi Expense kolleksiyasida yotmaydi, alohida modul).
    profit: revenue - expense - salaryPaid,
    attendanceRate: attendanceRateOf(sessions),
  };
};

module.exports = {
  resolvePeriod,

  summary: async (clientId, query = {}) => {
    const cacheKey = { scope: "summary", ...query };
    const cached = await reportCache.get(clientId, "summary", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);

    const students = await loadStudents(clientId, center);
    const entries = scopedEntries(students, clientId, center);

    const [current, previous, activeGroups, billing] = await Promise.all([
      rawTotals(clientId, center, entries, p.fromUnix, p.toUnix, p.fromDay, p.toDay),
      rawTotals(
        clientId,
        center,
        entries,
        p.prevFromUnix,
        p.prevToUnix,
        moment.unix(p.prevFromUnix).tz(TZ).format("YYYY-MM-DD"),
        moment.unix(p.prevToUnix).tz(TZ).format("YYYY-MM-DD"),
      ),
      Group.countDocuments({
        client: clientId,
        isDeleted: false,
        status: "active",
        ...(center ? { center } : {}),
      }),
      // Qarzdorlik — DAVRGA bog'liq emas, "hozirgi holat" (o'tgan barcha
      // sikllar + joriy sikl qoldig'i), dashboard bilan bir xil manba.
      studentService.centerBillingTotals(clientId, center, students),
    ]);

    const activeIds = new Set();
    let newStudents = 0;
    let leftStudents = 0;
    for (const { student, entry } of entries) {
      if (entry.status === "active") activeIds.add(String(student._id));
      if (entry.joinedAt >= p.fromUnix && entry.joinedAt <= p.toUnix) newStudents += 1;
      if (entry.leftAt && entry.leftAt >= p.fromUnix && entry.leftAt <= p.toUnix) leftStudents += 1;
    }

    const result = {
      period: p.period,
      from: p.fromDay,
      to: p.toDay,
      revenue: current.revenue,
      expense: current.expense,
      profit: current.profit,
      salaryPaid: current.salaryPaid,
      debt: billing.debt,
      newStudents,
      leftStudents,
      activeStudents: activeIds.size,
      activeGroups,
      attendanceRate: current.attendanceRate,
      comparison: {
        revenue: growth(current.revenue, previous.revenue),
        expense: growth(current.expense, previous.expense),
        profit: growth(current.profit, previous.profit),
      },
    };

    await reportCache.set(clientId, "summary", cacheKey, result);
    return result;
  },

  timeline: async (clientId, query = {}) => {
    const cacheKey = { scope: "timeline", ...query };
    const cached = await reportCache.get(clientId, "timeline", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);
    const groupBy = ["day", "week", "month"].includes(query.groupBy)
      ? query.groupBy
      : p.defaultGroupBy;

    const students = await loadStudents(clientId, center);
    const entries = scopedEntries(students, clientId, center);

    const [expenses, sessions] = await Promise.all([
      Expense.find(expenseFilter(clientId, center, p.fromUnix, p.toUnix), {
        amount: 1,
        createdAt: 1,
      }),
      Attendance.find(attendanceFilter(clientId, center, p.fromDay, p.toDay), {
        date: 1,
        records: 1,
      }),
    ]);

    const buckets = new Map();
    const touch = (key, label) => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label,
          revenue: 0,
          expense: 0,
          profit: 0,
          students: 0,
          present: 0,
          totalRecords: 0,
        });
      }
      return buckets.get(key);
    };

    for (const row of paymentRows(entries, p.fromUnix, p.toUnix)) {
      if (row.status !== "paid") continue;
      const b = bucketOf(row.date, groupBy);
      touch(b.key, b.label).revenue += row.amount;
    }

    for (const e of expenses) {
      const b = bucketOf(e.createdAt, groupBy);
      touch(b.key, b.label).expense += e.amount;
    }

    for (const { entry } of entries) {
      if (entry.joinedAt < p.fromUnix || entry.joinedAt > p.toUnix) continue;
      const b = bucketOf(entry.joinedAt, groupBy);
      touch(b.key, b.label).students += 1;
    }

    for (const s of sessions) {
      const b = bucketOfDay(s.date, groupBy);
      const bucket = touch(b.key, b.label);
      for (const r of s.records || []) {
        bucket.totalRecords += 1;
        if (r.status === "present") bucket.present += 1;
      }
    }

    const result = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({
        key: b.key,
        label: b.label,
        revenue: b.revenue,
        expense: b.expense,
        profit: b.revenue - b.expense,
        students: b.students,
        attendanceRate: b.totalRecords ? Math.round((b.present / b.totalRecords) * 100) : 0,
      }));

    await reportCache.set(clientId, "timeline", cacheKey, result);
    return result;
  },

  byCenter: async (clientId, query = {}) => {
    const cacheKey = { scope: "byCenter", ...query };
    const cached = await reportCache.get(clientId, "byCenter", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);

    const centerFilter = { client: clientId, isDeleted: false };
    if (center) centerFilter._id = center;

    const [centers, students] = await Promise.all([
      Center.find(centerFilter, { name: 1 }).sort({ createdAt: -1 }),
      loadStudents(clientId, center),
    ]);

    const entries = scopedEntries(students, clientId, center);

    const [expenses, salaries, sessions, groups] = await Promise.all([
      Expense.find(expenseFilter(clientId, center, p.fromUnix, p.toUnix), { amount: 1, center: 1 }),
      SalaryTransaction.find(salaryFilter(clientId, center, p.fromUnix, p.toUnix), {
        amount: 1,
        center: 1,
      }),
      Attendance.find(attendanceFilter(clientId, center, p.fromDay, p.toDay), {
        center: 1,
        records: 1,
      }),
      Group.find(
        { client: clientId, isDeleted: false, status: "active", ...(center ? { center } : {}) },
        { center: 1 },
      ),
    ]);

    const acc = new Map();
    const slot = (id) => {
      const key = String(id);
      if (!acc.has(key)) {
        acc.set(key, {
          revenue: 0,
          expense: 0,
          salaryPaid: 0,
          students: new Set(),
          groups: 0,
          present: 0,
          totalRecords: 0,
        });
      }
      return acc.get(key);
    };

    for (const row of paymentRows(entries, p.fromUnix, p.toUnix)) {
      if (row.status !== "paid") continue;
      slot(row.center).revenue += row.amount;
    }
    for (const e of expenses) slot(e.center).expense += e.amount;
    for (const s of salaries) slot(s.center).salaryPaid += s.amount;
    for (const g of groups) slot(g.center).groups += 1;
    for (const { student, entry } of entries) {
      if (entry.status === "active") slot(entry.center).students.add(String(student._id));
    }
    for (const s of sessions) {
      const item = slot(s.center);
      for (const r of s.records || []) {
        item.totalRecords += 1;
        if (r.status === "present") item.present += 1;
      }
    }

    // Qarzdorlik markaz kesimida — har markaz uchun alohida jonli hisob
    // (`centerBillingTotals` allaqachon yuklangan o'quvchilarni qayta
    // ishlatadi, ya'ni qo'shimcha Student so'rovi bo'lmaydi).
    const debts = await Promise.all(
      centers.map((c) => studentService.centerBillingTotals(clientId, c._id, students)),
    );

    const result = centers.map((c, i) => {
      const item = acc.get(String(c._id)) || {
        revenue: 0,
        expense: 0,
        salaryPaid: 0,
        students: new Set(),
        groups: 0,
        present: 0,
        totalRecords: 0,
      };
      return {
        center: { _id: c._id, name: c.name },
        revenue: item.revenue,
        expense: item.expense,
        salaryPaid: item.salaryPaid,
        profit: item.revenue - item.expense - item.salaryPaid,
        students: item.students.size,
        groups: item.groups,
        attendanceRate: item.totalRecords
          ? Math.round((item.present / item.totalRecords) * 100)
          : 0,
        debt: debts[i].debt,
      };
    });

    await reportCache.set(clientId, "byCenter", cacheKey, result);
    return result;
  },

  byTeacher: async (clientId, query = {}) => {
    const cacheKey = { scope: "byTeacher", ...query };
    const cached = await reportCache.get(clientId, "byTeacher", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);

    const staffFilter = { client: clientId, isDeleted: false, role: { $in: ["teacher", "assistant"] } };
    if (center) staffFilter.center = center;

    const [teachers, groups, students] = await Promise.all([
      Staff.find(staffFilter, { name: 1, role: 1 }).sort({ createdAt: -1 }),
      Group.find(
        { client: clientId, isDeleted: false, ...(center ? { center } : {}) },
        { teacher: 1, center: 1 },
      ),
      loadStudents(clientId, center),
    ]);

    const groupTeacher = new Map(groups.map((g) => [String(g._id), String(g.teacher || "")]));
    const entries = scopedEntries(students, clientId, center);

    const sessions = await Attendance.find(attendanceFilter(clientId, center, p.fromDay, p.toDay), {
      group: 1,
      records: 1,
    });

    const acc = new Map();
    const slot = (id) => {
      const key = String(id);
      if (!acc.has(key)) {
        acc.set(key, {
          groups: new Set(),
          students: new Set(),
          lessonsHeld: 0,
          present: 0,
          totalRecords: 0,
          revenueGenerated: 0,
        });
      }
      return acc.get(key);
    };

    for (const g of groups) {
      if (g.teacher) slot(g.teacher).groups.add(String(g._id));
    }
    for (const { student, entry } of entries) {
      const t = groupTeacher.get(String(entry.group));
      if (!t) continue;
      if (entry.status === "active") slot(t).students.add(String(student._id));
    }
    for (const row of paymentRows(entries, p.fromUnix, p.toUnix)) {
      if (row.status !== "paid") continue;
      const t = groupTeacher.get(String(row.group));
      if (t) slot(t).revenueGenerated += row.amount;
    }
    for (const s of sessions) {
      const t = groupTeacher.get(String(s.group));
      if (!t) continue;
      const item = slot(t);
      item.lessonsHeld += 1;
      for (const r of s.records || []) {
        item.totalRecords += 1;
        if (r.status === "present") item.present += 1;
      }
    }

    // Oylik — mavjud salary zanjiridan olinadi (bu yerda qayta
    // hisoblanmaydi: bitta domen = bitta manba). Davr oxiri qaysi oyga
    // tegishli bo'lsa, o'sha oyning hisobi ko'rsatiladi.
    const month = formatMonth(p.toUnix);
    const salary = await salaryService.summary(clientId, { month, center });
    const salaryMap = Object.fromEntries(salary.data.map((s) => [String(s.staff._id), s.final]));

    const result = teachers.map((t) => {
      const item = acc.get(String(t._id));
      return {
        staff: { _id: t._id, fullName: t.name, role: t.role },
        groups: item ? item.groups.size : 0,
        students: item ? item.students.size : 0,
        lessonsHeld: item ? item.lessonsHeld : 0,
        attendanceRate:
          item && item.totalRecords ? Math.round((item.present / item.totalRecords) * 100) : 0,
        revenueGenerated: item ? item.revenueGenerated : 0,
        salaryEarned: salaryMap[String(t._id)] || 0,
      };
    });

    await reportCache.set(clientId, "byTeacher", cacheKey, result);
    return result;
  },

  byCollector: async (clientId, query = {}) => {
    const cacheKey = { scope: "byCollector", ...query };
    const cached = await reportCache.get(clientId, "byCollector", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);

    const students = await loadStudents(clientId, center);
    const entries = scopedEntries(students, clientId, center);
    const rows = paymentRows(entries, p.fromUnix, p.toUnix);

    const acc = new Map();
    for (const row of rows) {
      // Eski to'lovlarda `collectedBy` yo'q (moliyaviy yozuv qayta
      // yozilmaydi) — ular "noma'lum" guruhida yig'iladi.
      const id = row.collectedBy ? String(row.collectedBy) : "unknown";
      const kind = row.collectedByKind || null;
      if (!acc.has(id)) {
        acc.set(id, {
          id: row.collectedBy || null,
          kind,
          paymentsCount: 0,
          collected: 0,
          cash: 0,
          card: 0,
          refunded: 0,
        });
      }
      const item = acc.get(id);
      if (row.status === "refunded") {
        item.refunded += row.amount;
        continue;
      }
      if (row.status !== "paid") continue;

      item.paymentsCount += 1;
      item.collected += row.amount;
      if (row.type === "cash") item.cash += row.amount;
      if (row.type === "card") item.card += row.amount;
    }

    // Ism/rol — Staff yoki Client (Owner) modelidan. Ikkalasi mustaqil
    // model bo'lgani uchun `kind` ga qarab alohida o'qiladi.
    const staffIds = [...acc.values()].filter((v) => v.kind === "staff" && v.id).map((v) => v.id);
    const staffDocs = staffIds.length
      ? await Staff.find({ _id: { $in: staffIds }, client: clientId }, { name: 1, role: 1 })
      : [];
    const staffMap = Object.fromEntries(staffDocs.map((s) => [String(s._id), s]));

    const result = [...acc.values()]
      .map((v) => ({
        collector: {
          id: v.id,
          kind: v.kind,
          fullName:
            v.kind === "staff"
              ? staffMap[String(v.id)]?.name || "—"
              : v.kind === "owner"
                ? "Boshliq"
                : "Noma'lum",
          role: v.kind === "staff" ? staffMap[String(v.id)]?.role || "" : "owner",
        },
        paymentsCount: v.paymentsCount,
        collected: v.collected,
        cash: v.cash,
        card: v.card,
        refunded: v.refunded,
      }))
      .sort((a, b) => b.collected - a.collected);

    await reportCache.set(clientId, "byCollector", cacheKey, result);
    return result;
  },

  byGroup: async (clientId, query = {}) => {
    const cacheKey = { scope: "byGroup", ...query };
    const cached = await reportCache.get(clientId, "byGroup", cacheKey);
    if (cached) return cached;

    const center = query.center || "";
    const p = resolvePeriod(query);

    const [groups, students] = await Promise.all([
      Group.find(
        { client: clientId, isDeleted: false, status: { $ne: "finished" }, ...(center ? { center } : {}) },
        { subject: 1, teacher: 1, center: 1, activeId: 1, pendingId: 1, status: 1, lessonOffset: 1 },
      ).sort({ createdAt: -1 }),
      loadStudents(clientId, center),
    ]);

    const groupIds = groups.map((g) => g._id);
    const entries = scopedEntries(students, clientId, center);

    const [subjects, teachers, sessions, syllabuses, doneMap] = await Promise.all([
      Subject.find({ _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } }, { name: 1 }),
      Staff.find(
        { _id: { $in: [...new Set(groups.filter((g) => g.teacher).map((g) => String(g.teacher)))] } },
        { name: 1 },
      ),
      Attendance.find(
        { client: clientId, group: { $in: groupIds }, date: { $gte: p.fromDay, $lte: p.toDay } },
        { group: 1, records: 1 },
      ),
      Syllabus.find({ group: { $in: groupIds } }, { group: 1, modules: 1 }),
      countDoneMap(clientId, groupIds),
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));
    const syllabusMap = Object.fromEntries(syllabuses.map((s) => [String(s.group), s]));

    const acc = new Map();
    const slot = (id) => {
      const key = String(id);
      if (!acc.has(key)) {
        acc.set(key, { revenue: 0, debt: 0, students: new Set(), present: 0, totalRecords: 0 });
      }
      return acc.get(key);
    };

    for (const row of paymentRows(entries, p.fromUnix, p.toUnix)) {
      if (row.status !== "paid") continue;
      slot(row.group).revenue += row.amount;
    }
    for (const s of sessions) {
      const item = slot(s.group);
      for (const r of s.records || []) {
        item.totalRecords += 1;
        if (r.status === "present") item.present += 1;
      }
    }

    // Qarzdorlik guruh kesimida — o'quvchining SHU guruhdagi jonli
    // hisobidan (studentService DTO ichidagi `debt`). Bir so'rovda barcha
    // o'quvchilar bo'yicha aylanamiz.
    const dtos = await Promise.all(
      students.map((s) => studentService.DTO(s, clientId, center)),
    );
    for (const dto of dtos) {
      for (const g of dto.groups) {
        if (g.status !== "active") continue;
        const item = slot(g.group);
        item.debt += g.debt || 0;
        item.students.add(String(dto._id));
      }
    }

    const result = groups.map((g) => {
      const item = acc.get(String(g._id)) || {
        revenue: 0,
        debt: 0,
        students: new Set(),
        present: 0,
        totalRecords: 0,
      };

      const syllabus = syllabusMap[String(g._id)];
      const lessons = syllabus ? flattenLessons(syllabus.modules) : [];
      const progress = buildProgress(
        lessons,
        (doneMap[String(g._id)] || 0) + (g.lessonOffset || 0),
        syllabus ? syllabus.modules.length : 0,
      );

      return {
        group: {
          _id: g._id,
          name: `${subjectMap[String(g.subject)] || "?"}-${g.activeId || g.pendingId}`,
          status: g.status,
        },
        teacher: g.teacher ? teacherMap[String(g.teacher)] || "—" : "—",
        students: item.students.size,
        revenue: item.revenue,
        debt: item.debt,
        attendanceRate: item.totalRecords
          ? Math.round((item.present / item.totalRecords) * 100)
          : 0,
        syllabusProgress: progress.totalLessons
          ? Math.min(100, Math.round((progress.doneCount / progress.totalLessons) * 100))
          : 0,
      };
    });

    await reportCache.set(clientId, "byGroup", cacheKey, result);
    return result;
  },

  // Qarzdorlar — DAVRGA bog'liq emas (qarz "hozirgi holat"), lekin filial
  // filtri va sahifalash qo'llaniladi.
  debtors: async (clientId, query = {}) => {
    const center = query.center || "";
    const { data } = await studentService.list(clientId, {
      center,
      status: "active",
      debtStatus: "debtor",
      search: query.search || "",
    });

    const groupIds = [
      ...new Set(data.flatMap((s) => s.groups.map((g) => String(g.group)))),
    ];
    const groups = await Group.find({ _id: { $in: groupIds } }, { subject: 1, activeId: 1, pendingId: 1 });
    const subjects = await Subject.find(
      { _id: { $in: [...new Set(groups.map((g) => String(g.subject)))] } },
      { name: 1 },
    );
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const groupMap = Object.fromEntries(
      groups.map((g) => [
        String(g._id),
        `${subjectMap[String(g.subject)] || "?"}-${g.activeId || g.pendingId}`,
      ]),
    );

    const rows = [];
    for (const student of data) {
      for (const g of student.groups) {
        if (g.status !== "active" || !(g.debt > 0)) continue;
        rows.push({
          student: { _id: student._id, fullName: student.fullName },
          phone: student.phone,
          group: { _id: g.group, name: groupMap[String(g.group)] || "—" },
          months: (g.debtBreakdown || []).map((d) => d.month),
          amount: g.debt,
        });
      }
    }

    rows.sort((a, b) => b.amount - a.amount);

    const pageNum = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (pageNum - 1) * limit;

    return {
      data: rows.slice(skip, skip + limit),
      totalDebt: rows.reduce((sum, r) => sum + r.amount, 0),
      meta: {
        page: pageNum,
        limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit) || 1,
      },
    };
  },
};
