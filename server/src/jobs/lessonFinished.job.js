// "DARS TUGADI" — ota-onaga (project_parent_telegram_webapp_plan, 5-bosqich).
//
// Har daqiqada: bugun darsi bo'lgan aktiv guruhlar ichidan `endTime` +
// FINISH_DELAY daqiqa oynasiga tushganlari olinadi. Kechikish ataylab —
// o'qituvchi baholarni dars tugagach bir necha daqiqada qo'yadi, xabar
// baho bilan ketsin. Faqat BUGUN DAVOMAT BELGILANGAN guruhlar (dars bo'lmagan
// / bekor qilingan kunda "tugadi" ketmasin) va faqat darsga KELGAN
// o'quvchilar (kelmaganga "kelmadi" xabari allaqachon ketgan).
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Group = require("../models/Group");
const Attendance = require("../models/Attendance");
const Grade = require("../models/Grade");
const Student = require("../models/Student");
const parentNotification = require("../services/parentNotification.service");
const { todayString, todayDayCode, dateStringToUnix, getNow, currentMonthString } = require("../utils/date.util");
const { groupStudentsSummary, positionsInSummary } = require("../utils/gradeScore.util");
const moment = require("moment-timezone");

const TZ = "Asia/Tashkent";
const FINISH_DELAY_MINUTES = Number(process.env.PARENT_LESSON_FINISH_DELAY_MIN) || 10;
const TICK_MINUTES = 1;
const DAY_IDX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
// Oylik o'rinlar hash'i oy tugagach ham biroz yashaydi (keyin kerak emas).
const RANK_TTL_SEC = 40 * 24 * 3600;

const timeToUnixToday = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dateStringToUnix(todayString()) + h * 3600 + m * 60;
};

const acquireLock = async (tick) => {
  const res = await redis.set(keyConfig.schedulerLock("lessonFinished", tick), "1", "EX", 120, "NX");
  return res === "OK";
};

// O'rin o'zgarishi (API_CONTRACT_badges_monthly_rank.md §B): joriy oylik
// reyting hisoblanadi, Redis'dagi OLDINGI o'rinlar bilan solishtiriladi va
// yangilari yoziladi. Faqat guruh uchun BIR MARTA (har o'quvchi uchun emas).
// Qaytaradi: { [studentId]: { from, to, total } } — faqat o'rni KO'TARILGANLAR.
const rankChangesOf = async (group) => {
  // Individual guruhda reyting yo'q (API_CONTRACT_individual_students.md §0.6).
  if (group.kind === "individual") return {};
  const month = currentMonthString();
  const summary = await groupStudentsSummary(group, { month });
  const positions = positionsInSummary(summary);
  const total = Object.keys(positions).length;
  const key = keyConfig.groupMonthRank(group._id, month);

  const prev = await redis.hgetall(key);
  const changes = {};
  for (const [id, to] of Object.entries(positions)) {
    const from = prev[id] != null ? Number(prev[id]) : null;
    if (from !== null && to < from) changes[id] = { from, to, total };
  }

  // Eski holat butunlay almashtiriladi (reytingdan chiqib ketgan o'quvchi
  // qoldig'i qolmasin). ioredis `keyPrefix`ni o'zi qo'shadi.
  const tx = redis.multi().del(key);
  if (total) tx.hset(key, positions).expire(key, RANK_TTL_SEC);
  await tx.exec();
  return changes;
};

// Guruhning bugundan keyingi birinchi dars kuni (days bo'yicha), 14 kun ichida.
const nextLessonOf = (group) => {
  const wanted = new Set((group.days || []).map((d) => DAY_IDX[d]));
  if (!wanted.size) return null;
  const cur = moment.tz(TZ).startOf("day");
  for (let i = 1; i <= 14; i++) {
    cur.add(1, "day");
    if (wanted.has(cur.day())) return { date: cur.format("YYYY-MM-DD"), startTime: group.startTime || "" };
  }
  return null;
};

const run = async () => {
  const now = getNow();
  const tick = Math.floor(now / (TICK_MINUTES * 60));
  if (!(await acquireLock(tick))) return;

  const groups = await Group.find({ status: "active", isDeleted: false, days: todayDayCode() }).select(
    "client center days startTime endTime kind",
  );
  if (!groups.length) return;

  // endTime + delay ∈ [now - tick, now)
  const due = groups.filter((g) => {
    const end = timeToUnixToday(g.endTime);
    if (end === null) return false;
    const fireAt = end + FINISH_DELAY_MINUTES * 60;
    return fireAt >= now - TICK_MINUTES * 60 && fireAt < now;
  });
  if (!due.length) return;

  const date = todayString();
  for (const g of due) {
    const session = await Attendance.findOne({ group: g._id, date }).select("records");
    const present = (session?.records || []).filter((r) => r.status === "present");
    if (!present.length) continue;

    const studentIds = present.map((r) => r.student);
    const [students, grades] = await Promise.all([
      Student.find({ _id: { $in: studentIds }, isDeleted: false }),
      Grade.find({ group: g._id, date, student: { $in: studentIds } }).select("student value").lean(),
    ]);
    const gradeOf = Object.fromEntries(grades.map((x) => [String(x.student), x.value]));
    const nextLesson = nextLessonOf(g);
    // Reyting xatosi "Dars tugadi" xabarini to'xtatmasin — o'rin qatorisiz ketadi.
    const rankChanges = await rankChangesOf(g).catch((error) => {
      console.error("lessonFinished rank:", error.message);
      return {};
    });

    for (const student of students) {
      const entry = student.groups.find(
        (e) => String(e.group) === String(g._id) && String(e.client) === String(g.client) && e.status === "active",
      );
      if (!entry) continue;
      await parentNotification.onLessonFinished({
        student,
        entry,
        date,
        grade: gradeOf[String(student._id)] ?? null,
        nextLesson,
        rankChange: rankChanges[String(student._id)] || null,
      });
    }
  }
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("lessonFinished:", error.message));
  }, TICK_MINUTES * 60 * 1000);
  timer.unref?.();
  console.log(`Lesson finished scheduler started (endTime + ${FINISH_DELAY_MINUTES} min)`);
};

module.exports = { start, run, nextLessonOf, rankChangesOf };
