const moment = require("moment-timezone");
const TZ = "Asia/Tashkent";
const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// [fromUnix, toUnix) oralig'ida (Asia/Tashkent kalendar kunlari bo'yicha,
// `toUnix` chetlab o'tiladi) `days` (haftalik kunlar kodlari) ga mos
// barcha sanalarni "YYYY-MM-DD" ro'yxati sifatida qaytaradi. `excludeDates`
// (Set yoki massiv) — dam olish kuni deb belgilangan sanalarni (GroupHoliday,
// chargeable=false) yoki allaqachon kredit olingan sanalarni chetlab
// o'tish uchun.
function listLessonDates(days, fromUnix, toUnix, excludeDates) {
  if (!days?.length || toUnix <= fromUnix) return [];

  const exclude = excludeDates instanceof Set ? excludeDates : new Set(excludeDates || []);
  const result = [];
  const cursor = moment.unix(fromUnix).tz(TZ).startOf("day");
  const end = moment.unix(toUnix).tz(TZ).startOf("day");
  while (cursor.isBefore(end)) {
    const dateStr = cursor.format("YYYY-MM-DD");
    if (days.includes(JS_DAY_TO_CODE[cursor.day()]) && !exclude.has(dateStr)) {
      result.push(dateStr);
    }
    cursor.add(1, "day");
  }
  return result;
}

// [fromUnix, toUnix) oralig'ida `days`ga mos (va `excludeDates`da bo'lmagan)
// necha kun borligini hisoblaydi. Attendance statistikasi (necha dars kuni
// o'tgan) va to'lov hisob-kitobi (necha dars kuni uchun to'lov kerak) —
// ikkalasi ham shu bitta funksiyaga tayanadi.
function countLessonDays(days, fromUnix, toUnix, excludeDates) {
  return listLessonDates(days, fromUnix, toUnix, excludeDates).length;
}

module.exports = { countLessonDays, listLessonDates, JS_DAY_TO_CODE };
