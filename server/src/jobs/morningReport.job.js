const moment = require("moment-timezone");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const telegramService = require("../services/telegram.service");
const { t } = require("../bot/i18n");
const { escapeHtml } = require("../bot/notify");
const { bulletList, blockList } = require("../bot/format");
const { todayString, todayDayCode } = require("../utils/date.util");

const TZ = "Asia/Tashkent";
const CHECK_MINUTES = 5;
const HOUR = 6; // 06:00–07:00 oralig'ida (soat 6 bo'lgan har chaqiriqda tekshiriladi)

// Bir kunda BIR MARTA — cluster'da bir nechta worker bir vaqtda tursa ham.
const acquireOnce = async (scope) => {
  const key = keyConfig.schedulerLock("morningReport", `${scope}:${todayString()}`);
  const res = await redis.set(key, "1", "EX", 6 * 3600, "NX");
  return res === "OK";
};

const uniq = (arr) => [...new Set(arr.filter(Boolean).map(String))];

// Bitta markaz uchun "bugungi kun" xulosasi — Client Owner va Resepshin
// bir xil kontentni oladi (moliyaviy ma'lumot bu xabarda umuman yo'q).
const buildCenterSummary = async (centerId, dayCode) => {
  const groups = await Group.find({
    center: centerId,
    status: "active",
    isDeleted: false,
    days: dayCode,
  }).select("teacher room subject");
  if (!groups.length) return { lessonsCount: 0, studentsExpected: 0, rooms: [], teachers: [] };

  const groupIds = groups.map((g) => g._id);
  const [studentRows, rooms, teachers] = await Promise.all([
    Student.aggregate([
      { $match: { isDeleted: false, "groups.group": { $in: groupIds } } },
      { $unwind: "$groups" },
      { $match: { "groups.group": { $in: groupIds }, "groups.status": "active" } },
      { $group: { _id: "$_id" } },
    ]),
    require("../models/Room")
      .find({ _id: { $in: uniq(groups.map((g) => g.room)) } })
      .select("name"),
    Staff.find({ _id: { $in: uniq(groups.map((g) => g.teacher)) }, isDeleted: false }).select("name"),
  ]);

  return {
    lessonsCount: groups.length,
    studentsExpected: studentRows.length,
    rooms: rooms.map((r) => r.name),
    teachers: teachers.map((s) => s.name),
  };
};

const buildCenterText = (lang, centerName, summary) => {
  const lines = [`${t(lang, "morningHeader")} — <b>${escapeHtml(centerName)}</b>`, ""];
  if (summary.lessonsCount === 0) {
    lines.push(t(lang, "morningNoLessons"));
    return lines.join("\n");
  }
  lines.push(`${t(lang, "morningLessonsToday")}: <b>${summary.lessonsCount}</b>`);
  lines.push(`${t(lang, "morningStudentsExpected")}: <b>${summary.studentsExpected}</b>`);
  if (summary.rooms.length) {
    lines.push("", `<b>${t(lang, "morningRooms")}:</b>`);
    lines.push(bulletList(summary.rooms.map((r) => escapeHtml(r))));
  }
  if (summary.teachers.length) {
    lines.push("", `<b>${t(lang, "morningTeachers")}:</b>`);
    lines.push(bulletList(summary.teachers.map((n) => escapeHtml(n))));
  }
  return lines.join("\n");
};

const sendCenterReports = async (dayCode) => {
  const centers = await Center.find({ status: "active", isDeleted: false }).select("client name");
  for (const center of centers) {
    if (!(await acquireOnce(`center:${center._id}`))) continue;

    const summary = await buildCenterSummary(center._id, dayCode);

    // Client Owner
    await telegramService
      .sendIfLinked("client", center.client, (lang) => buildCenterText(lang, center.name, summary))
      .catch(() => {});

    // Shu markazning Resepshinlari — xuddi Owner bilan bir xil kontent
    // (moliyaviy ma'lumot yo'q, shuning uchun cheklashning hojati yo'q).
    const receptions = await Staff.find({
      center: center._id,
      role: "reception",
      isDeleted: false,
      blocked: false,
    }).select("_id");
    for (const r of receptions) {
      await telegramService
        .sendIfLinked("staff", r._id, (lang) => buildCenterText(lang, center.name, summary))
        .catch(() => {});
    }
  }
};

// O'qituvchi/Yordamchi o'qituvchi — shaxsiy: FAQAT o'zining bugungi darslari.
const sendTeacherReports = async (dayCode) => {
  const teachers = await Staff.find({
    role: { $in: ["teacher", "assistant"] },
    isDeleted: false,
    blocked: false,
    "telegram.chatId": { $ne: null },
  }).select("_id");
  if (!teachers.length) return;

  for (const staff of teachers) {
    if (!(await acquireOnce(`staff:${staff._id}`))) continue;

    const groups = await Group.find({
      $or: [{ teacher: staff._id }, { assistant: staff._id }],
      status: "active",
      isDeleted: false,
      days: dayCode,
    })
      .select("subject room startTime endTime activeId")
      .sort({ startTime: 1 });

    const subjectIds = uniq(groups.map((g) => g.subject));
    const roomIds = uniq(groups.map((g) => g.room));
    const [subjects, rooms] = await Promise.all([
      require("../models/Subject").find({ _id: { $in: subjectIds } }).select("name"),
      require("../models/Room").find({ _id: { $in: roomIds } }).select("name"),
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));

    await telegramService
      .sendIfLinked("staff", staff._id, (lang) => {
        const lines = [t(lang, "morningHeader"), "", `<b>${t(lang, "morningMyLessons")}</b>`];
        if (!groups.length) {
          lines.push(t(lang, "morningNoLessonsMine"));
        } else {
          lines.push(
            "",
            blockList(
              groups.map((g) => ({
                title: escapeHtml(`${subjectMap[String(g.subject)] || "?"} - ${g.activeId}`),
                lines: [
                  [`${g.startTime}-${g.endTime}`, g.room ? escapeHtml(roomMap[String(g.room)] || "") : ""]
                    .filter(Boolean)
                    .join(" · "),
                ],
              })),
            ),
          );
        }
        return lines.join("\n");
      })
      .catch(() => {});
  }
};

const run = async () => {
  const hour = Number(moment.tz(TZ).format("H"));
  if (hour !== HOUR) return;

  const dayCode = todayDayCode();
  await sendCenterReports(dayCode);
  await sendTeacherReports(dayCode);
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("morningReport:", error.message));
  }, CHECK_MINUTES * 60 * 1000);
  timer.unref?.();
  // Server ${HOUR}:00–${HOUR}:59 oralig'ida ishga tushsa ham shu kuni
  // hisobot o'tkazib yuborilmasin deb darhol bir marta ham tekshiriladi.
  run().catch((error) => console.error("morningReport:", error.message));
  console.log(`Morning report scheduler started (soat ${HOUR}:00–${HOUR}:59)`);
};

module.exports = { start, run };
