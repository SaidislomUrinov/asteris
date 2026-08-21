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
const { todayString, todayDayCode, dateStringToUnix, getNow } = require("../utils/date.util");

const CHECK_MINUTES = 5;

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

const timeToUnixToday = (hhmm, date) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dateStringToUnix(date) + h * 3600 + m * 60;
};

// Bir kunda BIR MARTA — markaz hisoboti allaqachon yuborilgan bo'lsa
// qaytadan yuborilmaydi (server qayta ishga tushsa ham).
const acquireOnce = async (centerId, date) => {
  const key = keyConfig.schedulerLock("eveningReport", `${centerId}:${date}`);
  const res = await redis.set(key, "1", "EX", 20 * 3600, "NX");
  return res === "OK";
};

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

const run = async () => {
  const now = getNow();
  const dayCode = todayDayCode();
  const date = todayString();

  const centers = await Center.find({ status: "active", isDeleted: false }).select("client name");

  for (const center of centers) {
    const groups = await Group.find({
      center: center._id,
      status: "active",
      isDeleted: false,
      days: dayCode,
    }).select("subject teacher activeId startTime endTime");
    if (!groups.length) continue;

    // Shu markazning BUGUNGI eng oxirgi darsi tugamaguncha kutiladi.
    const maxEnd = Math.max(...groups.map((g) => timeToUnixToday(g.endTime, date) ?? 0));
    if (!maxEnd || now < maxEnd) continue;

    if (!(await acquireOnce(center._id, date))) continue;

    const groupIds = groups.map((g) => g._id);

    const [attendanceRows, revenueRows, subjects, teachers, studentCountRows] = await Promise.all([
      Attendance.find({ group: { $in: groupIds }, date }).select("group records"),
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
      Student.aggregate([
        { $match: { isDeleted: false, "groups.group": { $in: groupIds } } },
        { $unwind: "$groups" },
        { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
        { $group: { _id: "$groups.group", count: { $sum: 1 } } },
      ]),
    ]);

    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const teacherMap = Object.fromEntries(teachers.map((s) => [String(s._id), s.name]));
    const attendanceByGroup = Object.fromEntries(attendanceRows.map((a) => [String(a.group), a.records || []]));
    const studentsCountMap = Object.fromEntries(studentCountRows.map((r) => [String(r._id), r.count]));
    const revenue = revenueRows[0]?.total || 0;

    let present = 0;
    let absent = 0;
    let excused = 0;
    let unmarked = 0;
    const lessonLines = [];

    for (const g of groups) {
      const records = attendanceByGroup[String(g._id)] || [];
      const p = records.filter((r) => r.status === "present").length;
      const a = records.filter((r) => r.status === "absent").length;
      const e = records.filter((r) => r.status === "excused").length;
      present += p;
      absent += a;
      excused += e;
      const enrolled = studentsCountMap[String(g._id)] || 0;
      unmarked += Math.max(0, enrolled - records.length);

      lessonLines.push(
        `• ${escapeHtml(subjectMap[String(g.subject)] || "?")} - ${g.activeId} (${g.startTime}–${g.endTime})` +
          (g.teacher ? ` — ${escapeHtml(teacherMap[String(g.teacher)] || "")}` : ""),
      );
    }

    const buildText = (lang, withRevenue) => {
      const lines = [`${t(lang, "eveningHeader")} — <b>${escapeHtml(center.name)}</b>`, ""];
      lines.push(`✅ ${t(lang, "eveningPresent")}: <b>${present}</b>`);
      lines.push(`❌ ${t(lang, "eveningAbsent")}: <b>${absent}</b>`);
      lines.push(`🟡 ${t(lang, "eveningExcused")}: <b>${excused}</b>`);
      lines.push(`⬜ ${t(lang, "eveningUnmarked")}: <b>${unmarked}</b>`);
      if (withRevenue) lines.push(`💰 ${t(lang, "eveningRevenue")}: <b>${money(revenue)}</b>`);
      lines.push("", `<b>${t(lang, "eveningLessons")}:</b>`, ...lessonLines);
      return lines.join("\n");
    };

    await telegramService
      .sendIfLinked("client", center.client, (lang) => buildText(lang, true))
      .catch(() => {});

    const receptions = await Staff.find({
      center: center._id,
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

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("eveningReport:", error.message));
  }, CHECK_MINUTES * 60 * 1000);
  timer.unref?.();
  console.log("Evening report scheduler started (har filial darslari tugagach)");
};

module.exports = { start, run };
