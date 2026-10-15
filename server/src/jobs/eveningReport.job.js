const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const telegramService = require("../services/telegram.service");
const { t } = require("../bot/i18n");
const { escapeHtml } = require("../bot/notify");
const { blockList } = require("../bot/format");
const { todayString, todayDayCode, dateStringToUnix, getNow } = require("../utils/date.util");

const CHECK_MINUTES = 5;

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

const timeToUnixToday = (hhmm, date) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dateStringToUnix(date) + h * 3600 + m * 60;
};

// Bir kunda BIR MARTA — hisobot allaqachon yuborilgan bo'lsa qaytadan
// yuborilmaydi (server qayta ishga tushsa ham). `scope` markaz (markaz
// hisoboti) yoki `staff:{id}` (o'qituvchining shaxsiy hisoboti) bo'ladi.
const acquireOnce = async (scope, date) => {
  const key = keyConfig.schedulerLock("eveningReport", `${scope}:${date}`);
  const res = await redis.set(key, "1", "EX", 20 * 3600, "NX");
  return res === "OK";
};

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

// Guruhlarning bugungi kuni tugaganini tekshiradi — eng oxirgi dars
// tugamaguncha hisobot yuborilmaydi.
const lastLessonEnded = (groups, date, now) => {
  const maxEnd = Math.max(...groups.map((g) => timeToUnixToday(g.endTime, date) ?? 0));
  return !!maxEnd && now >= maxEnd;
};

// Berilgan guruhlar bo'yicha bugungi davomatni yig'adi. Markaz hisoboti ham,
// o'qituvchining shaxsiy hisoboti ham AYNAN shu hisobdan foydalanadi —
// ikkalasida bir xil raqam chiqishi uchun (faqat ko'rsatilish shakli farq
// qiladi). "Belgilanmagan" = guruhga biriktirilgan faol o'quvchilar soni
// minus davomat yozuvlari soni.
const collectAttendance = async (groups, date) => {
  const groupIds = groups.map((g) => g._id);

  const [attendanceRows, studentCountRows] = await Promise.all([
    Attendance.find({ group: { $in: groupIds }, date }).select("group records"),
    Student.aggregate([
      { $match: { isDeleted: false, "groups.group": { $in: groupIds } } },
      { $unwind: "$groups" },
      { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
      { $group: { _id: "$groups.group", count: { $sum: 1 } } },
    ]),
  ]);

  const attendanceByGroup = Object.fromEntries(attendanceRows.map((a) => [String(a.group), a.records || []]));
  const studentsCountMap = Object.fromEntries(studentCountRows.map((r) => [String(r._id), r.count]));

  const byGroup = {};
  const totals = { present: 0, absent: 0, excused: 0, unmarked: 0 };

  for (const g of groups) {
    const records = attendanceByGroup[String(g._id)] || [];
    const stat = {
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      excused: records.filter((r) => r.status === "excused").length,
      unmarked: Math.max(0, (studentsCountMap[String(g._id)] || 0) - records.length),
    };
    byGroup[String(g._id)] = stat;
    totals.present += stat.present;
    totals.absent += stat.absent;
    totals.excused += stat.excused;
    totals.unmarked += stat.unmarked;
  }

  return { byGroup, totals };
};

const summaryLines = (lang, totals) => [
  `${t(lang, "eveningPresent")}: <b>${totals.present}</b>`,
  `${t(lang, "eveningAbsent")}: <b>${totals.absent}</b>`,
  `${t(lang, "eveningExcused")}: <b>${totals.excused}</b>`,
  `${t(lang, "eveningUnmarked")}: <b>${totals.unmarked}</b>`,
];

// Markaz hisoboti — Client Owner (tushum bilan) va Resepshin (tushumsiz).
const sendCenterReports = async (date, dayCode, now) => {
  const centers = await Center.find({ status: "active", isDeleted: false }).select("client name");

  for (const center of centers) {
    const groups = await Group.find({
      center: center._id,
      status: "active",
      isDeleted: false,
      days: dayCode,
    }).select("subject teacher activeId startTime endTime");
    if (!groups.length) continue;

    if (!lastLessonEnded(groups, date, now)) continue;
    if (!(await acquireOnce(center._id, date))) continue;

    const [{ totals }, revenueRows, subjects, teachers] = await Promise.all([
      collectAttendance(groups, date),
      Student.aggregate([
        { $match: { isDeleted: false, "groups.center": center._id } },
        { $unwind: "$groups" },
        { $match: { "groups.center": center._id } },
        { $unwind: "$groups.payments" },
        {
          $match: {
            "groups.payments.status": "paid",
            "groups.payments.date": { $gte: dateStringToUnix(date), $lt: dateStringToUnix(date) + 86400 },
          },
        },
        { $group: { _id: null, total: { $sum: "$groups.payments.amount" } } },
      ]),
      Subject.find({ _id: { $in: uniq(groups.map((g) => g.subject)) } }).select("name"),
      Staff.find({ _id: { $in: uniq(groups.map((g) => g.teacher)) }, isDeleted: false }).select("name"),
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));
    const revenue = revenueRows[0]?.total || 0;

    const lessonBlocks = groups.map((g) => ({
      title: escapeHtml(`${subjectMap[String(g.subject)] || "?"} - ${g.activeId}`),
      lines: [
        [`${g.startTime}-${g.endTime}`, g.teacher ? escapeHtml(teacherMap[String(g.teacher)] || "") : ""]
          .filter(Boolean)
          .join(" · "),
      ],
    }));

    const buildText = (lang, withRevenue) => {
      const lines = [`${t(lang, "eveningHeader")} — <b>${escapeHtml(center.name)}</b>`, ""];
      lines.push(...summaryLines(lang, totals));
      if (withRevenue) lines.push(`${t(lang, "eveningRevenue")}: <b>${money(revenue)}</b>`);
      lines.push("", `<b>${t(lang, "eveningLessons")}:</b>`, "", blockList(lessonBlocks));
      return lines.join("\n");
    };

    await telegramService
      .sendIfLinked("client", center.client, (lang) => buildText(lang, true))
      .catch(() => {});

    const receptions = await Staff.find({
      // Ko'p filialli resepshin har filiali hisobotini alohida oladi.
      centers: center._id,
      role: "reception",
      isDeleted: false,
      blocked: false,
    }).select("_id");
    for (const r of receptions) {
      await telegramService
        .sendIfLinked("staff", r._id, (lang) => buildText(lang, false))
        .catch(() => {});
    }
  }
};

// O'qituvchi/Yordamchi o'qituvchi — shaxsiy: FAQAT o'zi dars bergan
// guruhlar bo'yicha yakun (ertalabki hisobotdagi `sendTeacherReports` bilan
// bir xil naqsh). Moliyaviy ma'lumot yo'q. Vaqt markazga emas, o'ZINING
// oxirgi darsi tugashiga bog'lanadi — bir nechta markazda dars beradigan
// o'qituvchi ham to'g'ri paytda oladi.
const sendTeacherReports = async (date, dayCode, now) => {
  const staffList = await Staff.find({
    role: { $in: ["teacher", "assistant"] },
    isDeleted: false,
    blocked: false,
    "telegram.chatId": { $ne: null },
  }).select("_id center centers");
  if (!staffList.length) return;

  for (const staff of staffList) {
    const groups = await Group.find({
      $or: [{ teacher: staff._id }, { assistant: staff._id }],
      status: "active",
      isDeleted: false,
      days: dayCode,
    })
      .select("subject center activeId startTime endTime")
      .sort({ startTime: 1 });
    // Bugun darsi bo'lmagan o'qituvchiga kechqurun umuman xabar yuborilmaydi
    // (ertalabki hisobotdan farqli — u yerda "bugun dars yo'q" ma'noli, bu
    // yerda yakunlanadigan hech narsa yo'q).
    if (!groups.length) continue;

    if (!lastLessonEnded(groups, date, now)) continue;
    if (!(await acquireOnce(`staff:${staff._id}`, date))) continue;

    // Ko'p filialli o'qituvchi — har darsda filial nomi (API_CONTRACT_multi_center.md §6).
    const multiCenter = Staff.centersOf(staff).length > 1;
    const [{ byGroup, totals }, subjects, centers] = await Promise.all([
      collectAttendance(groups, date),
      Subject.find({ _id: { $in: uniq(groups.map((g) => g.subject)) } }).select("name"),
      multiCenter ? Center.find({ _id: { $in: uniq(groups.map((g) => g.center)) } }).select("name") : [],
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    const lessonBlocks = (lang) =>
      groups.map((g) => {
        const stat = byGroup[String(g._id)];
        return {
          title: escapeHtml(`${subjectMap[String(g.subject)] || "?"} - ${g.activeId}`),
          lines: [
            `${g.startTime}-${g.endTime}`,
            ...(multiCenter && centerMap[String(g.center)]
              ? [`${t(lang, "reminderCenterLabel")}: ${escapeHtml(centerMap[String(g.center)])}`]
              : []),
            `${t(lang, "eveningPresent")}: ${stat.present} · ${t(lang, "eveningAbsent")}: ${stat.absent}`,
          ],
        };
      });

    await telegramService
      .sendIfLinked("staff", staff._id, (lang) => {
        const lines = [t(lang, "eveningHeader"), ""];
        lines.push(...summaryLines(lang, totals));
        lines.push("", `<b>${t(lang, "eveningMyLessons")}:</b>`, "", blockList(lessonBlocks(lang)));
        return lines.join("\n");
      })
      .catch(() => {});
  }
};

const run = async () => {
  const now = getNow();
  const dayCode = todayDayCode();
  const date = todayString();

  await sendCenterReports(date, dayCode, now);
  await sendTeacherReports(date, dayCode, now);
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("eveningReport:", error.message));
  }, CHECK_MINUTES * 60 * 1000);
  timer.unref?.();
  console.log("Evening report scheduler started (har filial darslari tugagach)");
};

// `sendTeacherReports` — tekshiruv skriptlari uchun (soat sharti chetlab o'tiladi).
module.exports = { start, run, sendTeacherReports };
