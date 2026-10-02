const { Types } = require("mongoose");
const Group = require("../models/Group");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Expense = require("../models/Expense");
const Subject = require("../models/Subject");
const Room = require("../models/Room");
const studentService = require("./student.service");
const dashboardCache = require("../utils/dashboardCache.util");
const { monthRolloverAdjustment } = require("../utils/rollover.util");
const {
  currentMonthString,
  formatMonth,
  formatDate,
  todayDayCode,
  todayString,
  formatDay,
} = require("../utils/date.util");

// Dashboard — markaz bo'yicha jonli statistika. Hammasi so'rov paytida
// hisoblanadi (saqlanadigan agregat yo'q), socket eventlari (payment:*,
// attendance:*, expense:*) kelganda frontend qayta so'raydi.
module.exports = {
  stats: async (clientId, { center = "", month = "" }) => {
    const m = month || currentMonthString();

    // Kesh — API_CONTRACT_performance.md §3. To'lov/xarajat/davomat/oylik
    // o'zgarganda darhol bekor qilinadi, shuning uchun eskirgan raqam
    // ko'rinmaydi.
    const cached = await dashboardCache.get(clientId, center, m);
    if (cached) return cached;

    const groupFilter = { client: clientId, isDeleted: false };
    if (center) groupFilter.center = center;

    const staffFilter = { client: clientId, isDeleted: false };
    if (center) staffFilter.center = center;

    const entryFilter = { "groups.client": clientId };
    if (center) entryFilter["groups.center"] = center;

    // O'quvchilar BIR MARTA yuklanadi va billing hisobiga ham shu ro'yxat
    // uzatiladi — avval centerBillingTotals() ayni hujjatlarni ikkinchi marta
    // bazadan tortardi (API_CONTRACT_performance.md §2).
    const students = await Student.find(
      { ...entryFilter, isDeleted: false },
      { fullName: 1, groups: 1 },
    );

    const [activeGroups, pendingGroups, staffCount, expenseAgg, billingTotals] = await Promise.all([
      Group.countDocuments({ ...groupFilter, status: "active" }),
      Group.countDocuments({ ...groupFilter, status: "pending" }),
      Staff.countDocuments(staffFilter),
      Expense.aggregate([
        // aggregate Mongoose kabi avtomatik cast qilmaydi — ObjectId qo'lda
        {
          $match: {
            client: new Types.ObjectId(String(clientId)),
            ...(center ? { center: new Types.ObjectId(String(center)) } : {}),
            month: m,
            status: "active",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Markaz tanlangan bo'lsa o'sha markaz, aks holda butun tenant
      // bo'yicha (har guruh o'z markazining cycleMode'i bilan hisoblanadi).
      // Bitta so'rovda: barcha-vaqt qarzi + joriy sikl to'langan/qolgan.
      studentService.centerBillingTotals(clientId, center, students),
    ]);

    // Tenant qamrovidagi o'quvchilar, oylik tushum va so'nggi to'lovlar —
    // hammasi bitta Student aylanishida yig'iladi.
    const centerStr = center ? String(center) : "";
    const clientStr = String(clientId);
    let activeStudents = 0;
    let monthRevenue = 0;
    const recentPayments = [];
    // Oxirgi 30 kunlik tushum grafigi (RevenueChart, GroupDetail'dagi bilan
    // bir xil komponent) uchun — recentPayments'dan farqli, 10taga
    // cheklanmaydi, aks holda faol markazda chart noto'g'ri (kamroq) chiqadi.
    const chartPayments = [];
    const chartSinceUnix = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    for (const student of students) {
      let counted = false;
      for (const entry of student.groups) {
        if (String(entry.client) !== clientStr) continue;
        if (centerStr && String(entry.center) !== centerStr) continue;
        // Arxivlangan a'zolik (entry.status "archived") statistikaga
        // kirmasligi kerak — faqat faol a'zoliklar hisoblanadi.
        if (entry.status !== "active") continue;

        if (!counted) {
          activeStudents += 1;
          counted = true;
        }

        for (const p of entry.payments) {
          if (p.status !== "paid") continue;
          if ((p.forMonth || formatMonth(p.date)) === m) monthRevenue += p.amount;
          recentPayments.push({
            student: { _id: student._id, fullName: student.fullName },
            amount: p.amount,
            type: p.type,
            forMonth: p.forMonth,
            date: formatDate(p.date),
            dateUnix: p.date,
          });
          if (p.date >= chartSinceUnix) {
            chartPayments.push({ status: "paid", date: p.date, amount: p.amount });
          }
        }
      }
    }

    // "3 kun ketma-ket kelmadi" rollover: o'tkazilgan summa shu oy tushumidan
    // chiqib, keyingi oyga qo'shiladi (utils/rollover.util.js).
    monthRevenue = Math.max(
      0,
      monthRevenue +
        monthRolloverAdjustment(
          students,
          null,
          m,
          (e) =>
            String(e.client) === clientStr &&
            (!centerStr || String(e.center) === centerStr) &&
            e.status === "active",
        ),
    );

    recentPayments.sort((a, b) => b.dateUnix - a.dateUnix);

    const result = {
      month: m,
      activeStudents,
      activeGroups,
      pendingGroups,
      staffCount,
      monthRevenue,
      monthExpenses: expenseAgg[0]?.total || 0,
      totalDebt: billingTotals.debt,
      // "To'lov holati" donut'i uchun — ikkala segment ham JORIY sikl
      // bo'yicha (monthRevenue/totalDebt juftligi taqqoslab bo'lmas edi).
      currentCyclePaid: billingTotals.currentCyclePaid,
      currentCycleDebt: billingTotals.currentCycleDebt,
      recentPayments: recentPayments.slice(0, 10).map(({ dateUnix, ...p }) => p),
      chartPayments,
    };

    await dashboardCache.set(clientId, center, m, result);
    return result;
  },

  // Bugungi kun uchun dars jadvali (Dashboard "Bugungi darslar" scroll'i) —
  // faqat faol, bugun dars kuni bo'lgan va allaqachon faollashtirilgan
  // guruhlar, Subject/Teacher/Room nomlari serverda hal qilingan holda.
  todayLessons: async (clientId, { center = "" }) => {
    const dayCode = todayDayCode();
    const today = todayString();

    const filter = { client: clientId, isDeleted: false, status: "active", days: dayCode };
    if (center) filter.center = center;

    const groups = await Group.find(filter).select(
      "subject teacher room startTime endTime activatedAt activeId",
    );

    const validGroups = groups.filter(
      (g) => g.activatedAt && formatDay(g.activatedAt) <= today && g.startTime && g.endTime,
    );

    const subjectIds = [...new Set(validGroups.map((g) => String(g.subject)))];
    const teacherIds = [...new Set(validGroups.filter((g) => g.teacher).map((g) => String(g.teacher)))];
    const roomIds = [...new Set(validGroups.filter((g) => g.room).map((g) => String(g.room)))];

    const [subjects, teachers, rooms] = await Promise.all([
      Subject.find({ _id: { $in: subjectIds } }, { name: 1 }),
      Staff.find({ _id: { $in: teacherIds } }, { name: 1 }),
      Room.find({ _id: { $in: roomIds } }, { name: 1 }),
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));

    return validGroups
      .map((g) => ({
        _id: g._id,
        subjectName: subjectMap[String(g.subject)] || "?",
        teacherName: g.teacher ? teacherMap[String(g.teacher)] || "—" : "—",
        roomName: g.room ? roomMap[String(g.room)] || "—" : "—",
        startTime: g.startTime,
        endTime: g.endTime,
        activeId: g.activeId,
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
};
