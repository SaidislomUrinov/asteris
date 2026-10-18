const moment = require("moment-timezone");
const TZ = "Asia/Tashkent";
module.exports = {
  getNow: () => moment.tz(TZ).unix(),
  formatDate: (unix) => moment.unix(unix).tz(TZ).format("DD.MM.YYYY | HH:mm"),
  addDays: (unix, days) => moment.unix(unix).tz(TZ).add(days, "days").unix(),
  addMonths: (unix, months) => moment.unix(unix).tz(TZ).add(months, "months").unix(),
  // `from`dan `to`gacha o'tgan TO'LIQ oylar soni, kun-oyni hisobga olgan
  // holda (masalan 14-iyuldan 13-avgustgacha = 0, 14-avgustdan = 1) — oylik
  // to'lov siklini "necha oy o'tdi" deb hisoblash uchun (langar sana = `from`).
  monthsBetween: (fromUnix, toUnix) =>
    Math.max(0, moment.unix(toUnix).tz(TZ).diff(moment.unix(fromUnix).tz(TZ), "months")),
  // Berilgan unix vaqtni "YYYY-MM" ko'rinishida (Asia/Tashkent) qaytaradi.
  formatMonth: (unix) => moment.unix(unix).tz(TZ).format("YYYY-MM"),
  // "YYYY-MM-DD" sana matnini (frontend date input'idan) shu kunning
  // Asia/Tashkent bo'yicha 00:00'iga mos unix vaqtga aylantiradi — guruh
  // faollashtirilganda "darslar qachon boshlanishi" sanasini belgilash uchun.
  dateStringToUnix: (dateStr) => moment.tz(dateStr, "YYYY-MM-DD", TZ).startOf("day").unix(),
  // Bugungi kun "YYYY-MM-DD" ko'rinishida (Asia/Tashkent) — davomat sessiyasi
  // shu kalit bilan saqlanadi (attendance.service.js).
  todayString: () => moment.tz(TZ).format("YYYY-MM-DD"),
  // Bugungi hafta kuni kodi ("mon"..."sun", Asia/Tashkent) — Group.days bilan
  // solishtirish uchun.
  todayDayCode: () => moment.tz(TZ).format("ddd").toLowerCase(),
  // Joriy oy "YYYY-MM" (Asia/Tashkent) — davomat statistikasida "keyingi
  // oyga o'tib bo'lmaydi" chegarasi uchun.
  currentMonthString: () => moment.tz(TZ).format("YYYY-MM"),
  // "YYYY-MM" oyining 1-kuni 00:00 (Toshkent), `shift` oy siljitilgan holda.
  monthStartUnix: (month, shift = 0) => moment.tz(month, "YYYY-MM", TZ).add(shift, "months").unix(),
  // Berilgan unix vaqtni "YYYY-MM-DD" ko'rinishida (Asia/Tashkent) qaytaradi
  // (`todayString`dan farqi — istalgan unix uchun, faqat bugun uchun emas).
  formatDay: (unix) => moment.unix(unix).tz(TZ).format("YYYY-MM-DD"),
  // Berilgan unix'ning oy boshi (1-kun, 00:00, Asia/Tashkent) unix vaqti.
  startOfMonth: (unix) => moment.unix(unix).tz(TZ).startOf("month").unix(),
  // Berilgan unix qaysi oyda joylashgan bo'lsa, o'sha oyda necha kun bor.
  daysInMonth: (unix) => moment.unix(unix).tz(TZ).daysInMonth(),
  // Berilgan unix oyning nechinchi kuni (1-31, Asia/Tashkent).
  dayOfMonth: (unix) => moment.unix(unix).tz(TZ).date(),
  // Ikki unix orasidagi TO'LIQ kalendar oylar soni (kun-oyni hisobga
  // olmay, faqat oy-yil farqi) — "oy boshidan oy boshiga" to'lov sikli
  // uchun (monthsBetween'dan farqi: bu kun-oyga qaramaydi).
  calendarMonthsBetween: (fromUnix, toUnix) => {
    const a = moment.unix(fromUnix).tz(TZ);
    const b = moment.unix(toUnix).tz(TZ);
    return Math.max(0, (b.year() - a.year()) * 12 + (b.month() - a.month()));
  },
};
