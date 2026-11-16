const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Subject = require("../models/Subject");
const Room = require("../models/Room");
const { getTodayLesson } = require("../utils/lessonSchedule.util");
const GroupHoliday = require("../models/GroupHoliday");
const CenterHoliday = require("../models/CenterHoliday");
const Center = require("../models/Center");
const parentNotification = require("../services/parentNotification.service");
const notificationService = require("../services/notification.service");
const telegramService = require("../services/telegram.service");
const clientService = require("../services/client.service");
const { t } = require("../bot/i18n");
const { richTable } = require("../bot/format");
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

// Bugungi dars mavzusi — dastur tuzilmagan/tugagan bo'lsa `null`.
// Mavzu — o'qituvchi paneli va ota-ona WebApp'idagi bilan AYNAN bir xil
// sana→dars moslashuvi (utils/lessonSchedule.util.js): dam olish kunlari
// darsni surgan bo'lsa ham to'g'ri mavzu chiqadi.
const getTodayTopic = async (group, date) => (await getTodayLesson(group, date))?.title || null;

// O'QUVCHI ROLI eslatmasi (API_CONTRACT_student_role_homework.md §5) —
// hodim eslatmasi bilan bir xil vaqtda. Bayram/dam olish kuni (markaz
// kalendari yoki guruh kalendari) bo'lsa yuborilmaydi. Dedup parentNotification
// ichida (`lessonReminder:{entryId}:{date}`).
const remindStudents = async (due, date) => {
  const groupIds = due.map((g) => g._id);
  const centerIds = [...new Set(due.map((g) => String(g.center)))];
  const [groupOff, centerOff] = await Promise.all([
    GroupHoliday.find({ group: { $in: groupIds }, date }).select("group").lean(),
    CenterHoliday.find({ center: { $in: centerIds }, date }).select("center").lean(),
  ]);
  const offGroups = new Set(groupOff.map((h) => String(h.group)));
  const offCenters = new Set(centerOff.map((h) => String(h.center)));
  // Mavzu faqat tarifda dars rejalash bo'lsa (WebApp "Dars rejasi" tabi
  // bilan bir xil qoida) — mijoz boshiga bitta tekshiruv.
  const planningByClient = new Map();
  for (const g of due) {
    if (offGroups.has(String(g._id)) || offCenters.has(String(g.center))) continue;
    const clientKey = String(g.client);
    if (!planningByClient.has(clientKey)) {
      planningByClient.set(clientKey, await clientService.hasPermission(g.client, "lesson.planning"));
    }
    const topic = planningByClient.get(clientKey) ? await getTodayTopic(g, date) : null;
    await parentNotification.onLessonReminder({ groupId: g._id, date, topic });
  }
};

const run = async () => {
  const now = getNow();
  const tick = Math.floor(now / (TICK_MINUTES * 60));
  if (!(await acquireLock(tick))) return;

  const dayCode = todayDayCode();
  const allGroups = await Group.find({
    status: "active",
    isDeleted: false,
    days: dayCode,
  }).select("client center teacher assistant subject room startTime activeId lessonOffset days activatedAt finishedAt status");
  if (!allGroups.length) return;

  const from = now + LEAD_MINUTES * 60;
  const to = from + TICK_MINUTES * 60;

  const dueAll = allGroups.filter((g) => {
    const start = timeToUnixToday(g.startTime);
    return start !== null && start >= from && start < to;
  });
  if (!dueAll.length) return;

  // O'quvchilarga — o'qituvchisi bor-yo'qligidan qat'i nazar. Fonda (kutilmaydi):
  // ko'p o'quvchili soatda fan-out tick'dan uzoq cho'zilishi mumkin — hodim
  // eslatmasi kechikmasin. Takroriy tick'da dedupKey qayta yuborishni to'xtatadi.
  remindStudents(dueAll, todayString()).catch((error) =>
    console.error("lessonReminder students:", error?.message || error),
  );

  // O'qituvchi VA yordamchi o'qituvchi — ikkalasi ham eslatma oladi
  // (avval faqat `teacher` edi, `assistant` chetda qolib ketgan edi).
  const due = dueAll.filter((g) => g.teacher || g.assistant);
  if (!due.length) return;

  // Tarif "teacher.notifications" flagi — client bo'yicha keshlab
  // tekshiramiz (bir tick ichida bir nechta guruh bir clientga tegishli
  // bo'lishi mumkin).
  const clientIds = [...new Set(due.map((g) => String(g.client)))];
  const featureByClient = new Map(
    await Promise.all(
      clientIds.map(async (id) => [id, await clientService.hasPermission(id, "teacher.notifications")]),
    ),
  );

  const staffIds = [...new Set(due.flatMap((g) => [g.teacher, g.assistant].filter(Boolean).map(String)))];
  const staffDocs = await Staff.find({ _id: { $in: staffIds }, isDeleted: false, blocked: false }).select(
    "_id center centers",
  );
  const activeStaff = new Set(staffDocs.map((s) => String(s._id)));
  // Ko'p filialli hodimga eslatmada filial nomi ham yoziladi (qaysi binoga borish).
  const multiCenterStaff = new Set(staffDocs.filter((s) => Staff.centersOf(s).length > 1).map((s) => String(s._id)));
  const centerNames = multiCenterStaff.size
    ? Object.fromEntries(
        (await Center.find({ _id: { $in: [...new Set(due.map((g) => String(g.center)))] } }).select("name")).map((c) => [
          String(c._id),
          c.name,
        ]),
      )
    : {};

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
    if (!featureByClient.get(String(g.client))) continue;

    const recipients = [...new Set([g.teacher, g.assistant].filter(Boolean).map(String))].filter((id) =>
      activeStaff.has(id),
    );
    if (!recipients.length) continue;

    const topic = await getTodayTopic(g, date);

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
      // o'tkazib yuboriladi, xato emas). Rich message (InputRichMessage):
      // heading + haqiqiy list bloki, plain HTML "• " workaroundsiz.
      telegramService
        .sendRichIfLinked("staff", staffId, (lang) => {
          const rows = [[t(lang, "reminderTimeLabel"), g.startTime]];
          if (multiCenterStaff.has(staffId) && centerNames[String(g.center)]) {
            rows.push([t(lang, "reminderCenterLabel"), centerNames[String(g.center)]]);
          }
          if (g.room) rows.push([t(lang, "reminderRoomLabel"), roomMap[String(g.room)] || ""]);
          rows.push([t(lang, "reminderTopicLabel"), topic || t(lang, "reminderNoTopic")]);

          return {
            blocks: [
              { type: "heading", size: 3, text: t(lang, "reminderHeader") },
              {
                type: "paragraph",
                text: { type: "bold", text: `${subjectMap[String(g.subject)] || "?"} - ${g.activeId}` },
              },
              richTable(null, rows),
            ],
          };
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
