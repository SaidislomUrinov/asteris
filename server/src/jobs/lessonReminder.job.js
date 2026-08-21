const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Subject = require("../models/Subject");
const Room = require("../models/Room");
const Syllabus = require("../models/Syllabus");
const notificationService = require("../services/notification.service");
const telegramService = require("../services/telegram.service");
const syllabusProgress = require("../utils/syllabusProgress.util");
const { t } = require("../bot/i18n");
const { escapeHtml } = require("../bot/notify");
const { todayString, todayDayCode, dateStringToUnix, getNow } = require("../utils/date.util");

// Darsga shuncha daqiqa qolganda eslatma yuboriladi. Tekshiruv har daqiqada
// bo'lgani uchun oyna (window) kerak: [60, 60+TICK) daqiqa oralig'i.
const LEAD_MINUTES = 60;
const TICK_MINUTES = 1;

// "HH:mm" → bugungi shu vaqtning unix qiymati.
const timeToUnixToday = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dateStringToUnix(todayString()) + h * 3600 + m * 60;
};

// Bir daqiqalik "tick" uchun qulf — cluster rejimida bir nechta worker bir
// vaqtda ishga tushsa ham eslatma FAQAT BIR MARTA yuboriladi.
const acquireLock = async (tick) => {
  const key = keyConfig.schedulerLock("lessonReminder", tick);
  const res = await redis.set(key, "1", "EX", 120, "NX");
  return res === "OK";
};

// Kurs dasturidagi "bugungi" (keyingi o'tiladigan) dars mavzusi — mavjud
// bo'lmasa (dastur tuzilmagan/tugagan) `null` (Telegram xabarida shunda
// umuman ko'rsatilmaydi, GroupDetail/Lesson sahifasidagi bilan bir xil
// hisoblash usuli — `syllabusProgress.util.js`).
const getTodayTopic = async (clientId, groupId, lessonOffset) => {
  const syllabus = await Syllabus.findOne({ client: clientId, group: groupId, isDeleted: false });
  if (!syllabus) return null;
  const lessons = syllabusProgress.flattenLessons(syllabus.modules);
  if (!lessons.length) return null;
  const doneCount = await syllabusProgress.countDoneLessons(clientId, groupId, lessonOffset);
  const nextNo = doneCount >= lessons.length ? null : doneCount + 1;
  return nextNo ? lessons[nextNo - 1].title || null : null;
};

const run = async () => {
  const now = getNow();
  const tick = Math.floor(now / (TICK_MINUTES * 60));
  if (!(await acquireLock(tick))) return;

  const dayCode = todayDayCode();
  // O'qituvchi VA yordamchi o'qituvchi — ikkalasi ham eslatma oladi
  // (avval faqat `teacher` edi, `assistant` chetda qolib ketgan edi).
  const groups = await Group.find({
    status: "active",
    isDeleted: false,
    days: dayCode,
    $or: [{ teacher: { $ne: null } }, { assistant: { $ne: null } }],
  }).select("client center teacher assistant subject room startTime activeId lessonOffset");
  if (!groups.length) return;

  const from = now + LEAD_MINUTES * 60;
  const to = from + TICK_MINUTES * 60;

  const due = groups.filter((g) => {
    const start = timeToUnixToday(g.startTime);
    return start !== null && start >= from && start < to;
  });
  if (!due.length) return;

  const staffIds = [...new Set(due.flatMap((g) => [g.teacher, g.assistant].filter(Boolean).map(String)))];
  const staffDocs = await Staff.find({ _id: { $in: staffIds }, isDeleted: false, blocked: false }).select("_id");
  const activeStaff = new Set(staffDocs.map((s) => String(s._id)));

  const subjectIds = [...new Set(due.map((g) => String(g.subject)))];
  const roomIds = [...new Set(due.filter((g) => g.room).map((g) => String(g.room)))];
  const [subjects, rooms] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds } }).select("name"),
    Room.find({ _id: { $in: roomIds } }).select("name"),
  ]);
  const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [String(r._id), r.name]));

  const date = todayString();
  for (const g of due) {
    const recipients = [...new Set([g.teacher, g.assistant].filter(Boolean).map(String))].filter((id) =>
      activeStaff.has(id),
    );
    if (!recipients.length) continue;

    const topic = await getTodayTopic(g.client, g._id, g.lessonOffset);

    for (const staffId of recipients) {
      await notificationService.create({
        clientId: g.client,
        centerId: g.center,
        recipient: { id: staffId, kind: "staff" },
        type: "lesson:reminder",
        title: "notification.lessonReminderTitle",
        body: "notification.lessonReminderBody",
        data: {
          groupId: String(g._id),
          activeId: g.activeId,
          startTime: g.startTime,
          minutes: LEAD_MINUTES,
        },
        // Bitta dars uchun bitta eslatma (unique index), lekin o'qituvchi VA
        // yordamchisi alohida-alohida olishi kerak — kalitga staff ID ham kiradi.
        dedupKey: `lesson:${g._id}:${date}:${staffId}`,
      });

      // Telegram — faqat shu hodim shaxsiy chatini ulagan bo'lsa (jimgina
      // o'tkazib yuboriladi, xato emas).
      telegramService
        .sendIfLinked("staff", staffId, (lang) => {
          const lines = [
            `${t(lang, "reminderHeader")}`,
            "",
            `<b>${escapeHtml(subjectMap[String(g.subject)] || "?")} - ${g.activeId}</b>`,
            `⏰ ${g.startTime}`,
          ];
          if (g.room) lines.push(`🏠 ${escapeHtml(roomMap[String(g.room)] || "")}`);
          lines.push(`📘 ${topic ? escapeHtml(topic) : t(lang, "reminderNoTopic")}`);
          return lines.join("\n");
        })
        .catch(() => {});
    }
  }
};

// Har daqiqada. Xato butun serverni yiqitmasligi uchun ichida yutiladi.
const start = () => {
  const tickMs = TICK_MINUTES * 60 * 1000;
  const timer = setInterval(() => {
    run().catch((error) => console.error("lessonReminder:", error.message));
  }, tickMs);
  timer.unref?.();
  console.log(`Lesson reminder scheduler started (${LEAD_MINUTES} min oldin)`);
};

module.exports = { start, run };
