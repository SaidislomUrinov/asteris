const moment = require("moment-timezone");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Homework = require("../models/Homework");
const StudentLead = require("../models/StudentLead");
const Expense = require("../models/Expense");
const BillingSetting = require("../models/BillingSetting");
const clientService = require("./client.service");
const dashboardService = require("./dashboard.service");
const teacherService = require("./teacher.service");
const studentService = require("./student.service");
const { attendanceRateOf } = require("./report.service");
const { getNow, todayString, dateStringToUnix, formatDay, currentMonthString } = require("../utils/date.util");

// Ishchi (Boshliq / Resepshn / O'qituvchi / Yordamchi) Telegram WebApp paneli —
// faqat O'QISH (API_CONTRACT_worker_webapp.md §3). Hisob-kitoblar mavjud
// servislardan olinadi (dashboard, teacher dashboard, billing, revenue) —
// bu yerda yangi formula yozilmaydi, faqat "bugun" kesimida yig'iladi.

const TZ = "Asia/Tashkent";
const PAYMENT_EVENTS_LIMIT = 50;
// Client panelidagi `useFeature` (client/src/hooks/useFeature.js) bilan bir xil:
// tarifda yoqilgan bo'lsa ham production'da vaqtincha yopiq flaglar.
const FORCE_DISABLED_FEATURES = ["ai.report", "ai.advice"];
const TEACHING_ROLES = ["teacher", "assistant"];

// Staff ruxsati — `requireTenantPermission` bilan bir xil qoida (Owner = hammasi).
const can = (staff, permission) =>
  !staff || !!staff.permissions?.includes("all") || !!staff.permissions?.includes(permission);

const featuresOf = async (clientId) =>
  (await clientService.getTariffFeatures(clientId)).filter((f) => !FORCE_DISABLED_FEATURES.includes(f));

// "HH:mm" → bugungi unix soniya (Toshkent).
const atOf = (dayStart, hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return dayStart;
  const [h, m] = hhmm.split(":").map(Number);
  return dayStart + h * 3600 + m * 60;
};
const timeOf = (unix) => moment.unix(unix).tz(TZ).format("HH:mm");

const lessonState = (now, startAt, endAt) => (now > endAt ? "past" : now >= startAt ? "now" : "upcoming");

// Guruh nomi — qo'lda qo'yilgan `name`, bo'lmasa "Fan - ID" (group.service label'i).
const groupNameOf = (group, fallbackLabel) => group?.name || fallbackLabel || "";

// Guruhlar bo'yicha FAOL o'quvchilar soni (teacher.service dashboard'idagi bilan bir xil).
const activeCountsOf = async (groupIds) => {
  if (!groupIds.length) return {};
  const rows = await Student.aggregate([
    { $match: { isDeleted: false, "groups.group": { $in: groupIds } } },
    { $unwind: "$groups" },
    { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
    { $group: { _id: "$groups.group", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
};

// Bugungi davomat hujjatlari → guruh bo'yicha xulosa. `late` — status emas,
// bayroq (Attendance modeli): kechikkan o'quvchi `late` ga, qolgan kelganlar
// `present` ga tushadi — shunda yig'indi = belgilanganlar soni.
const attendanceSummaryOf = (doc, studentsCount) => {
  if (!doc) return null;
  const s = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const r of doc.records || []) {
    if (r.status === "present") s[r.late ? "late" : "present"] += 1;
    else if (s[r.status] !== undefined) s[r.status] += 1;
  }
  s.unmarked = Math.max(0, studentsCount - (doc.records || []).length);
  return s;
};

// Filial doirasi: staff — o'z filiali; owner — `centerId` (tekshiriladi) yoki
// barcha filiallar ("" — mavjud servislardagi "butun tenant" ma'nosi).
const resolveCenter = async (clientId, staff, centerId) => {
  if (staff) return String(staff.center);
  if (!centerId) return "";
  const center = await Center.exists({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("worker.centerNotFound");
  return String(centerId);
};

// Qarzdorlar soni va bugun to'lov muddati kelganlar — `centerBillingTotals`
// bilan bir xil yuklash, har a'zolik uchun `computeBilling` (yagona formula).
// "Bugun muddati" — `parentDebt.job` dagi kabi `nextDueDate` kuni bugun.
const debtScan = async (clientId, centerId, today) => {
  const filter = { isDeleted: false, "groups.client": clientId };
  if (centerId) filter["groups.center"] = centerId;
  const students = await Student.find(filter, { groups: 1 });

  const entries = students.flatMap((s) =>
    s.groups
      .filter(
        (g) =>
          String(g.client) === String(clientId) &&
          (!centerId || String(g.center) === String(centerId)) &&
          (g.status === "active" || g.status === "left"),
      )
      .map((g) => ({ studentId: String(s._id), entry: g })),
  );
  if (!entries.length) return { debtors: 0, dueCount: 0, dueAmount: 0 };

  const groupIds = [...new Set(entries.map((e) => String(e.entry.group)))];
  const groups = await Group.find({ _id: { $in: groupIds } }).select("status activatedAt finishedAt center days");
  const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));
  const centerIds = [...new Set(groups.map((g) => String(g.center)))];
  const billingDocs = await BillingSetting.find({ center: { $in: centerIds } }).select("center cycleMode");
  const cycleModeMap = Object.fromEntries(billingDocs.map((b) => [String(b.center), b.cycleMode]));

  const debtors = new Set();
  let dueCount = 0;
  let dueAmount = 0;
  for (const { studentId, entry } of entries) {
    const group = groupMap[String(entry.group)];
    const cycleMode = (group && cycleModeMap[String(group.center)]) || "anchor";
    const billing = studentService.computeBilling(entry, group, cycleMode);
    if ((billing.debt || 0) <= 0) continue;
    debtors.add(studentId);
    if (entry.status === "active" && billing.nextDueDate && formatDay(billing.nextDueDate) === today) {
      dueCount += 1;
      dueAmount += billing.debt;
    }
  }
  return { debtors: debtors.size, dueCount, dueAmount };
};

// Owner/resepshin: bugungi darslar — `dashboardService.todayLessons` (Dashboard
// "Bugungi darslar" bilan bir xil manba) + o'quvchilar soni va davomat.
const centerLessons = async (clientId, centerId, today, dayStart, now) => {
  const lessons = await dashboardService.todayLessons(clientId, { center: centerId });
  const ids = lessons.map((l) => l._id);
  const [groups, counts, attendance] = await Promise.all([
    Group.find({ _id: { $in: ids } }).select("name"),
    activeCountsOf(ids),
    Attendance.find({ client: clientId, date: today, group: { $in: ids } }).select("group records").lean(),
  ]);
  const nameMap = Object.fromEntries(groups.map((g) => [String(g._id), g.name]));
  const attMap = Object.fromEntries(attendance.map((a) => [String(a.group), a]));

  return lessons.map((l) => {
    const id = String(l._id);
    const startAt = atOf(dayStart, l.startTime);
    const endAt = atOf(dayStart, l.endTime);
    const studentsCount = counts[id] || 0;
    return {
      id: `lesson:${id}`,
      type: "lesson",
      at: startAt,
      time: l.startTime,
      endTime: l.endTime,
      endAt,
      state: lessonState(now, startAt, endAt),
      group: {
        _id: id,
        name: l.isIndividual && l.studentName ? l.studentName : groupNameOf({ name: nameMap[id] }, `${l.subjectName} - ${l.activeId}`),
        isIndividual: !!l.isIndividual,
      },
      room: l.roomName && l.roomName !== "—" ? l.roomName : null,
      teacherName: l.teacherName && l.teacherName !== "—" ? l.teacherName : null,
      studentsCount,
      attendance: attendanceSummaryOf(attMap[id], studentsCount),
    };
  });
};

// O'qituvchi/yordamchi: `teacherService.dashboard` (TeacherHome bilan bir xil
// manba — guruh doirasi `scopeField`, oylik `salaryService.detail`).
const teachingLessons = async (clientId, staff, today, dayStart, now) => {
  const dash = await teacherService.dashboard(clientId, staff._id, { scopeField: staff.role, centerId: staff.center });
  const ids = dash.todayLessons.map((l) => l._id);
  const [groups, attendance] = await Promise.all([
    Group.find({ _id: { $in: ids } }).select("name"),
    Attendance.find({ client: clientId, date: today, group: { $in: ids } }).select("group records").lean(),
  ]);
  const nameMap = Object.fromEntries(groups.map((g) => [String(g._id), g.name]));
  const attMap = Object.fromEntries(attendance.map((a) => [String(a.group), a]));

  const lessons = dash.todayLessons.map((l) => {
    const startAt = atOf(dayStart, l.startTime);
    const endAt = atOf(dayStart, l.endTime);
    return {
      id: `lesson:${l._id}`,
      type: "lesson",
      at: startAt,
      time: l.startTime,
      endTime: l.endTime,
      endAt,
      state: lessonState(now, startAt, endAt),
      group: {
        _id: l._id,
        name: l.isIndividual && l.studentName ? l.studentName : groupNameOf({ name: nameMap[l._id] }, l.label),
        isIndividual: !!l.isIndividual,
      },
      room: l.room?.name || null,
      studentsCount: l.studentsCount,
      attendance: attendanceSummaryOf(attMap[l._id], l.studentsCount),
      _attendance: attMap[l._id] || null,
    };
  });
  return { lessons, salary: dash.salary };
};

module.exports = {
  // GET /worker/me (§3.1). `ctx` — tenantAuth natijasi: owner uchun
  // `{ client: DTO, staff: null }`, hodim uchun `{ client: {_id}, staff: DTO }`.
  me: async ({ client, staff }) => {
    const clientId = client._id;
    const [clientDoc, features, subscription] = await Promise.all([
      Client.findOne({ _id: clientId, isDeleted: false }).select("name telegram"),
      featuresOf(clientId),
      clientService.getSubscriptionStatus(clientId),
    ]);
    if (!clientDoc) throw new Error("auth.failed");

    let center = null;
    let centers;
    let lang;
    let name;
    if (staff) {
      // Ko'p filialli hodim (API_CONTRACT_multi_center.md §6): `center` — faol
      // filial (`x-center-id`), `centers` — ishlay oladigan barcha filiallari.
      const allowed = staff.centers?.length ? staff.centers : [staff.center];
      const [centerDocs, staffDoc] = await Promise.all([
        // Bloklangan filialda ishlab bo'lmaydi (fullStaffAuth) — chip ham chiqmaydi.
        Center.find({ _id: { $in: allowed }, client: clientId, isDeleted: false, status: { $ne: "blocked" } })
          .select("name")
          .sort({ createdAt: 1 }),
        Staff.findById(staff._id).select("name telegram.lang"),
      ]);
      // Login javobida (middleware'siz) asosiy filial bloklangan bo'lishi mumkin — keyingisi.
      const centerDoc = centerDocs.find((c) => String(c._id) === String(staff.center)) || centerDocs[0];
      if (!centerDoc) throw new Error("worker.centerNotFound");
      center = { _id: String(centerDoc._id), name: centerDoc.name };
      centers = centerDocs.map((c) => ({ _id: String(c._id), name: c.name }));
      lang = staffDoc?.telegram?.lang;
      name = staffDoc?.name || staff.name;
    } else {
      const list = await Center.find({ client: clientId, isDeleted: false, status: "active" })
        .select("name")
        .sort({ createdAt: 1 });
      centers = list.map((c) => ({ _id: String(c._id), name: c.name }));
      lang = clientDoc.telegram?.lang;
      name = clientDoc.name;
    }

    return {
      kind: staff ? "staff" : "owner",
      role: staff ? staff.role : "owner",
      _id: String(staff ? staff._id : clientId),
      name: name || "",
      client: { _id: String(clientDoc._id), name: clientDoc.name || "" },
      center,
      centers,
      permissions: staff ? staff.permissions || [] : ["all"],
      features: Object.fromEntries(features.map((f) => [f, true])),
      // Obuna tugagan — `requireActiveSubscription` bilan bir xil manba.
      readOnly: !subscription.active,
      lang: lang || "uz",
    };
  },

  // GET /worker/today (§3.2). Ruxsat/tarif yo'q bo'lsa tegishli KPI/voqea
  // QO'SHILMAYDI. O'qituvchi/yordamchi hech qanday moliyaviy voqea olmaydi.
  today: async ({ client, staff }, { centerId = "" } = {}) => {
    const clientId = client._id;
    const role = staff ? staff.role : "owner";
    const today = todayString();
    const dayStart = dateStringToUnix(today);
    const now = getNow();
    const center = await resolveCenter(clientId, staff, centerId);
    const features = await featuresOf(clientId);
    const hasFeature = (f) => features.includes(f);

    const kpis = [];
    let events = [];

    if (TEACHING_ROLES.includes(role)) {
      const { lessons, salary } = await teachingLessons(clientId, staff, today, dayStart, now);
      kpis.push({ key: "lessonsToday", value: lessons.length });

      if (role === "teacher") {
        kpis.push({ key: "studentsToday", value: lessons.reduce((sum, l) => sum + (l.studentsCount || 0), 0) });
        // Uyga vazifa yozilmagan bugungi darslar — tarif `homework.manage`
        // va yozish ruxsati (`/homework` PUT bilan bir xil shart).
        if (hasFeature("homework.manage") && can(staff, "attendance:create") && lessons.length) {
          const written = await Homework.find({
            client: clientId,
            group: { $in: lessons.map((l) => l.group._id) },
            date: today,
            isDeleted: false,
          }).distinct("group");
          const done = new Set(written.map(String));
          for (const l of lessons) {
            if (done.has(String(l.group._id))) continue;
            events.push({ id: `homework:${l.group._id}`, type: "homeworkMissing", at: l.endAt, time: l.endTime, group: l.group });
          }
        }
      } else {
        // Yordamchi: bugun KELGAN, lekin hali baho qo'yilmagan o'quvchilar
        // (kelmaganga baho qo'yib bo'lmaydi — grade.service qoidasi).
        let pendingTotal = 0;
        if (hasFeature("student.rate") && can(staff, "attendance:create")) {
          const marked = lessons.filter((l) => l._attendance);
          const graded = marked.length
            ? await Grade.find({ client: clientId, group: { $in: marked.map((l) => l.group._id) }, date: today }).select("group student").lean()
            : [];
          const gradedSet = new Set(graded.map((g) => `${g.group}:${g.student}`));
          for (const l of marked) {
            const count = (l._attendance.records || []).filter(
              (r) => r.status === "present" && !gradedSet.has(`${l.group._id}:${r.student}`),
            ).length;
            if (!count) continue;
            pendingTotal += count;
            events.push({ id: `grades:${l.group._id}`, type: "gradesPending", at: l.endAt, time: l.endTime, group: l.group, count });
          }
          kpis.push({ key: "gradesPending", value: pendingTotal });
        }
      }

      // O'z oyligi — moliyaviy voqea emas, shaxsiy KPI (TeacherHome bilan bir xil).
      if (salary) kpis.push({ key: "salaryMonth", value: salary.final || 0, money: true });
      events.push(...lessons);
    } else {
      const isOwner = role === "owner";
      const canPayments = can(staff, "payment:view");

      // To'lovlar — "Tushumlar" sahifasi manbai (`exportRevenue`), faqat bugun, `paid`.
      let payments = [];
      if (isOwner || canPayments) {
        payments = await studentService.exportRevenue(clientId, { from: today, to: today, center, status: "paid" });
        const groupIds = [...new Set(payments.slice(0, PAYMENT_EVENTS_LIMIT).map((p) => p.groupId))];
        const groups = await Group.find({ _id: { $in: groupIds } }).select("name subject activeId pendingId status").populate("subject", "name");
        const groupMap = Object.fromEntries(
          groups.map((g) => [
            String(g._id),
            groupNameOf(g, `${g.subject?.name || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}`),
          ]),
        );
        events.push(
          ...payments.slice(0, PAYMENT_EVENTS_LIMIT).map((p) => ({
            id: `payment:${p.paymentId}`,
            type: "payment",
            at: p.date,
            time: timeOf(p.date),
            amount: p.amount,
            method: p.type,
            student: { _id: p.studentId, fullName: p.studentName },
            group: { _id: p.groupId, name: groupMap[p.groupId] || "" },
            collectedByName: p.collectedBy?.name || null,
          })),
        );
      }
      const revenueToday = payments.reduce((sum, p) => sum + p.amount, 0);

      // Darslar — owner har doim, resepshin `group:view` bilan (`/dashboard/today-lessons`).
      let lessons = [];
      if (isOwner || can(staff, "group:view")) {
        lessons = await centerLessons(clientId, center, today, dayStart, now);
        events.push(...lessons);
      }

      // Lidlar — tarif flagi yo'q, faqat `lead:view` ruxsati (`/student-leads`).
      if (isOwner || can(staff, "lead:view")) {
        const leadFilter = { client: clientId, isDeleted: false, createdAt: { $gte: dayStart, $lt: dayStart + 86400 } };
        if (center) leadFilter.center = center;
        const leads = await StudentLead.find(leadFilter).select("fullName source status createdAt").sort({ createdAt: 1 }).lean();
        events.push(
          ...leads.map((l) => ({
            id: `lead:${l._id}`,
            type: "lead",
            at: l.createdAt,
            time: timeOf(l.createdAt),
            name: l.fullName,
            source: l.source,
            status: l.status,
          })),
        );
      }

      if (isOwner) {
        const [stats, attendanceDocs] = await Promise.all([
          dashboardService.stats(clientId, { center }),
          Attendance.find({ client: clientId, date: today, ...(center && { center }) }).select("records").lean(),
        ]);
        const hasRecords = attendanceDocs.some((a) => (a.records || []).length);
        kpis.push(
          { key: "revenueToday", value: revenueToday, money: true },
          // Bugun hali davomat belgilanmagan bo'lsa — null (0% emas).
          { key: "attendanceRate", value: hasRecords ? attendanceRateOf(attendanceDocs) : null, percent: true },
          { key: "debtTotal", value: stats.totalDebt || 0, money: true },
        );

        // Xarajatlar — `/expenses` bilan bir xil tarif flagi (`finance.expense`).
        if (hasFeature("finance.expense")) {
          const expenseFilter = {
            client: clientId,
            month: currentMonthString(),
            status: "active",
            createdAt: { $gte: dayStart, $lt: dayStart + 86400 },
          };
          if (center) expenseFilter.center = center;
          const expenses = await Expense.find(expenseFilter).select("amount category createdAt").lean();
          events.push(
            ...expenses.map((e) => ({
              id: `expense:${e._id}`,
              type: "expense",
              at: e.createdAt,
              time: timeOf(e.createdAt),
              amount: e.amount,
              category: e.category,
            })),
          );
        }

        // Kechki hisobot — `eveningReport.job` oxirgi dars tugagach yuboradi.
        if (lessons.length) {
          const lastEnd = Math.max(...lessons.map((l) => l.endAt));
          events.push({ id: "report", type: "eveningReport", at: lastEnd, time: timeOf(lastEnd) });
        }
      } else if (canPayments) {
        const scan = await debtScan(clientId, center, today);
        kpis.push(
          { key: "cashToday", value: revenueToday, money: true },
          { key: "paymentsCount", value: payments.length },
          { key: "debtorsCount", value: scan.debtors },
        );
        if (scan.dueCount) {
          events.push({ id: `due:${today}`, type: "dueToday", at: dayStart, time: "00:00", count: scan.dueCount, amount: scan.dueAmount });
        }
      }
    }

    // Ichki yordamchi maydonlar javobga chiqmaydi.
    events = events
      .map(({ endAt, _attendance, ...e }) => e)
      .sort((a, b) => a.at - b.at);

    return { date: today, role, kpis, events };
  },
};
