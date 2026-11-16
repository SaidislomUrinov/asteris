const moment = require("moment-timezone");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const telegramService = require("../services/telegram.service");
const { t } = require("../bot/i18n");
const { richTable } = require("../bot/format");
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

const buildCenterRich = (lang, centerName, summary) => {
  const blocks = [{ type: "heading", size: 3, text: `${t(lang, "morningHeader")} — ${centerName}` }];
  if (summary.lessonsCount === 0) {
    blocks.push({ type: "paragraph", text: t(lang, "morningNoLessons") });
    return { blocks };
  }
  blocks.push(
    richTable(null, [
      [t(lang, "morningLessonsToday"), String(summary.lessonsCount)],
      [t(lang, "morningStudentsExpected"), String(summary.studentsExpected)],
    ]),
  );
  if (summary.rooms.length) {
    blocks.push(
      { type: "paragraph", text: { type: "bold", text: `${t(lang, "morningRooms")}:` } },
      richTable(null, summary.rooms.map((r) => [r])),
    );
  }
  if (summary.teachers.length) {
    blocks.push(
      { type: "paragraph", text: { type: "bold", text: `${t(lang, "morningTeachers")}:` } },
      richTable(null, summary.teachers.map((n) => [n])),
    );
  }
  return { blocks };
};

const sendCenterReports = async (dayCode) => {
  const centers = await Center.find({ status: "active", isDeleted: false }).select("client name");
  for (const center of centers) {
    if (!(await acquireOnce(`center:${center._id}`))) continue;

    const summary = await buildCenterSummary(center._id, dayCode);

    // Client Owner
    await telegramService
      .sendRichIfLinked("client", center.client, (lang) => buildCenterRich(lang, center.name, summary))
      .catch(() => {});

    // Shu markazning Resepshinlari — xuddi Owner bilan bir xil kontent
    // (moliyaviy ma'lumot yo'q, shuning uchun cheklashning hojati yo'q).
    const receptions = await Staff.find({
      // Ko'p filialli resepshin har filiali hisobotini alohida oladi.
      centers: center._id,
      role: "reception",
      isDeleted: false,
      blocked: false,
    }).select("_id");
    for (const r of receptions) {
      await telegramService
        .sendRichIfLinked("staff", r._id, (lang) => buildCenterRich(lang, center.name, summary))
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
  }).select("_id center centers");
  if (!teachers.length) return;

  for (const staff of teachers) {
    if (!(await acquireOnce(`staff:${staff._id}`))) continue;

    const groups = await Group.find({
      $or: [{ teacher: staff._id }, { assistant: staff._id }],
      status: "active",
      isDeleted: false,
      days: dayCode,
    })
      .select("subject room center startTime endTime activeId")
      .sort({ startTime: 1 });

    // Ko'p filialli o'qituvchi — har darsda qaysi filialda ekani yoziladi
    // (API_CONTRACT_multi_center.md §6); bitta filialda ortiqcha matn yo'q.
    const multiCenter = Staff.centersOf(staff).length > 1;
    const subjectIds = uniq(groups.map((g) => g.subject));
    const roomIds = uniq(groups.map((g) => g.room));
    const [subjects, rooms, centers] = await Promise.all([
      require("../models/Subject").find({ _id: { $in: subjectIds } }).select("name"),
      require("../models/Room").find({ _id: { $in: roomIds } }).select("name"),
      multiCenter ? Center.find({ _id: { $in: uniq(groups.map((g) => g.center)) } }).select("name") : [],
    ]);
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
    const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    await telegramService
      .sendRichIfLinked("staff", staff._id, (lang) => {
        const blocks = [
          { type: "heading", size: 3, text: t(lang, "morningHeader") },
          { type: "paragraph", text: { type: "bold", text: t(lang, "morningMyLessons") } },
        ];
        if (!groups.length) {
          blocks.push({ type: "paragraph", text: t(lang, "morningNoLessonsMine") });
        } else {
          const headers = [t(lang, "morningSubjectCol"), t(lang, "morningTimeCol"), t(lang, "morningRoomCol")];
          if (multiCenter) headers.push(t(lang, "reminderCenterLabel"));
          blocks.push(
            richTable(
              headers,
              groups.map((g) => {
                const row = [
                  `${subjectMap[String(g.subject)] || "?"} - ${g.activeId}`,
                  `${g.startTime}-${g.endTime}`,
                  g.room ? roomMap[String(g.room)] || "" : "",
                ];
                if (multiCenter) row.push(centerMap[String(g.center)] || "");
                return row;
              }),
            ),
          );
        }
        return { blocks };
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

// `sendTeacherReports` — tekshiruv skriptlari uchun (soat sharti chetlab o'tiladi).
module.exports = { start, run, sendTeacherReports };
