const moment = require("moment-timezone");
const Syllabus = require("../models/Syllabus");
const Attendance = require("../models/Attendance");
const GroupHoliday = require("../models/GroupHoliday");
const CenterHoliday = require("../models/CenterHoliday");
const { flattenLessons, buildProgress, clampDone } = require("./syllabusProgress.util");

const TZ = "Asia/Tashkent";
const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const dayKey = (m) => m.format("YYYY-MM-DD");
const todayKey = () => dayKey(moment.tz(TZ));

// SANA → DARS MOSLASHUVI — client/src/pages/Groups/lessonMapping.js
// #buildLessonByDate bilan AYNAN BIR XIL qoida (parity testi bilan
// tekshirilgan). Ikki joyda ikki xil natija chiqmasligi uchun shu
// qoidani o'zgartirsangiz, o'sha faylni ham o'zgartiring.
//
//   1) O'tgan darslar: attendanceDates[i] ↔ lessons[lessonOffset + i]
//      (manfiy indeks — rejadan oldingi dars, xaritaga kirmaydi).
//   2) Bugundan boshlab: guruh hafta kunlari bo'yicha, dam olish kunlari
//      va yakunlangan sanadan keyingi kunlar tashlab, davomati hali yo'q
//      kunlarga ketma-ket. Dars tugasa — `null` ("Mavzu biriktirilmagan").
//
// Shu sabab fors-major (dam olish) kuni darsni "yemaydi": o'sha kunning
// mavzusi keyingi dars kuniga, undan keyingilari ham shu tartibda suriladi.
//
// `holidays` — Set("YYYY-MM-DD"), `horizonKey` — qaysi sanagacha (shu kun ham).
const buildLessonByDate = ({
  activatedAt,
  status,
  finishedAt,
  days = [],
  holidays = new Set(),
  lessons = [],
  lessonOffset = 0,
  horizonKey,
  attendanceDates = [],
  today = todayKey(),
}) => {
  if (!activatedAt || status === "pending") return {};
  const finishKey = finishedAt ? dayKey(moment.unix(finishedAt).tz(TZ)) : null;
  const map = {};
  const attended = new Set(attendanceDates);

  attendanceDates.forEach((date, i) => {
    const idx = lessonOffset + i;
    if (idx < 0) return;
    map[date] = lessons[idx] || null;
  });

  let nextIdx = lessonOffset + attendanceDates.length;
  const cursor = moment.unix(activatedAt).tz(TZ).startOf("day");
  while (horizonKey && dayKey(cursor) <= horizonKey) {
    const key = dayKey(cursor);
    const isLessonWeekday = days.includes(JS_DAY_TO_CODE[cursor.day()]);
    const afterFinish = finishKey && key > finishKey;
    if (isLessonWeekday && !holidays.has(key) && !afterFinish && !attended.has(key) && key >= today) {
      map[key] = (nextIdx >= 0 && lessons[nextIdx]) || null;
      nextIdx += 1;
    }
    cursor.add(1, "day");
  }
  return map;
};

// Guruhning to'liq dars jadvali — bitta joyda yig'iladi (parent WebApp
// "Dars rejasi" tabi, o'quvchiga Telegram eslatmasi, o'qituvchi eslatmasi).
//
// Dam olish kunlari: guruh kalendari (GroupHoliday) + markaz kalendari
// (CenterHoliday). Markaz bayrami odatda har guruhga GroupHoliday bo'lib
// ham yoziladi; bayram belgilangandan KEYIN faollashgan guruhda esa faqat
// CenterHoliday bo'ladi — shuning uchun ikkalasi birlashtiriladi.
//
// `horizonDays` — bugundan necha kun oldinga hisoblash.
const getGroupSchedule = async (group, { horizonDays = 120, today = todayKey() } = {}) => {
  const syllabus = await Syllabus.findOne({ group: group._id, isDeleted: false }).select("modules").lean();
  const modules = syllabus?.modules || [];
  const lessons = flattenLessons(modules);
  const horizonKey = dayKey(moment.tz(today, "YYYY-MM-DD", TZ).add(horizonDays, "days"));

  const [attendanceRows, groupHolidays, centerHolidays] = await Promise.all([
    Attendance.find({ group: group._id }, { date: 1, _id: 0 }).sort({ date: 1 }).lean(),
    GroupHoliday.find({ group: group._id, date: { $lte: horizonKey } }, { date: 1, note: 1, _id: 0 }).lean(),
    group.center
      ? CenterHoliday.find({ center: group.center, date: { $lte: horizonKey } }, { date: 1, note: 1, _id: 0 }).lean()
      : [],
  ]);

  const attendanceDates = attendanceRows.map((r) => r.date);
  const holidayNotes = {};
  for (const h of [...centerHolidays, ...groupHolidays]) holidayNotes[h.date] = h.note || holidayNotes[h.date] || "";
  const holidays = new Set(Object.keys(holidayNotes));

  const lessonByDate = buildLessonByDate({
    activatedAt: group.activatedAt,
    status: group.status,
    finishedAt: group.finishedAt,
    days: group.days || [],
    holidays,
    lessons,
    lessonOffset: group.lessonOffset || 0,
    horizonKey,
    attendanceDates,
    today,
  });

  const doneCount = clampDone(attendanceDates.length + (group.lessonOffset || 0));
  return {
    modules,
    lessons,
    lessonByDate,
    holidayNotes,
    attendanceDates,
    progress: buildProgress(lessons, doneCount, modules.length),
    today,
    horizonKey,
  };
};

// Bugungi dars mavzusi (yoki null) — Telegram eslatmalari uchun.
const getTodayLesson = async (group, today = todayKey()) => {
  const { lessonByDate } = await getGroupSchedule(group, { horizonDays: 0, today });
  return lessonByDate[today] || null;
};

module.exports = { buildLessonByDate, getGroupSchedule, getTodayLesson, todayKey, JS_DAY_TO_CODE };
