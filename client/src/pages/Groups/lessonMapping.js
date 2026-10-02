// DIQQAT: shu qoidaning SERVER nusxasi bor — server/src/utils/lessonSchedule.util.js
// (ota-ona/o'quvchi WebApp "Reja" tabi va Telegram eslatmalari). Birini
// o'zgartirsangiz, ikkinchisini ham o'zgartiring.
// Sana → dars mavzusi moslashuvi — SOF funksiya (React importisiz), shuning
// uchun node bilan to'g'ridan-to'g'ri unit-test qilinadi
// (API_CONTRACT_teaching_plans.md §6). `useLessonSchedule` shu yerdan oladi.
//
// Qoida (API_CONTRACT_syllabus.md §3):
//   1) O'tilgan darslar — HAQIQIY davomat sanalari bo'yicha:
//        attendanceDates[i]  ↔  lessons[lessonOffset + i]
//      `lessonOffset` manfiy bo'lishi mumkin (reja guruh boshlanganidan
//      keyin import qilingan): manfiy indeksli sanalar = rejadan OLDINGI
//      darslar → xaritaga umuman qo'shilmaydi (mavzu ko'rsatilmaydi).
//   2) Bugundan boshlab (davomat hali yo'q) dars-kunlari ketma-ket davom
//      ettiriladi; dam olish kunlari va `finishedAt`dan keyingi kunlar
//      tashlab ketiladi. Dastur tugasa — `null` ("Mavzu biriktirilmagan").

export const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * @param {Object} p
 * @param {number} p.activatedAt - unix soniya
 * @param {string} p.status - guruh holati ("pending" bo'lsa bo'sh xarita)
 * @param {number} [p.finishedAt] - unix soniya
 * @param {string[]} p.days - ["mon","wed",...]
 * @param {Object} p.holidays - { "YYYY-MM-DD": {...} }
 * @param {Array} p.lessons - yoyilgan darslar ro'yxati
 * @param {number} p.lessonOffset
 * @param {Date} p.horizon - qaysi sanagacha hisoblanadi
 * @param {string[]} p.attendanceDates - xronologik "YYYY-MM-DD"[]
 * @param {string} [p.todayKey] - test uchun almashtiriladi (default: bugun)
 * @returns {Object} { "YYYY-MM-DD": lesson | null }
 */
export function buildLessonByDate({
  activatedAt,
  status,
  finishedAt,
  days = [],
  holidays = {},
  lessons = [],
  lessonOffset = 0,
  horizon,
  attendanceDates = [],
  todayKey = dateKey(new Date()),
}) {
  if (!activatedAt || status === "pending") return {};
  const start = new Date(activatedAt * 1000);
  const finishKey = finishedAt ? dateKey(new Date(finishedAt * 1000)) : null;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const map = {};
  // Davomati bor sanalar — xaritada bo'lmasa ham (manfiy indeks) "band":
  // 2-qadam ularga kelgusi darsni yopishtirmasligi kerak.
  const attended = new Set(attendanceDates);

  // 1-qadam: haqiqiy o'tilgan darslar (backend Attendance yozuvlaridan).
  attendanceDates.forEach((date, i) => {
    const idx = lessonOffset + i;
    if (idx < 0) return; // rejadan oldingi dars — mavzu yo'q
    map[date] = lessons[idx] || null;
  });

  // 2-qadam: bugundan boshlab kelgusi dars-kunlari.
  let nextIdx = lessonOffset + attendanceDates.length;
  while (horizon && cursor <= horizon) {
    const key = dateKey(cursor);
    const isLessonWeekday = days.includes(JS_DAY_TO_CODE[cursor.getDay()]);
    const isHoliday = !!holidays[key];
    const afterFinish = finishKey && key > finishKey;
    const alreadyKnown = attended.has(key);
    if (isLessonWeekday && !isHoliday && !afterFinish && !alreadyKnown && key >= todayKey) {
      map[key] = (nextIdx >= 0 && lessons[nextIdx]) || null; // null → "Mavzu biriktirilmagan"
      nextIdx += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return map;
}
