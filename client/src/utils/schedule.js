const WEEKDAY_TO_CODE = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

// Brauzer qaysi timezone'da bo'lishidan qat'iy nazar, doim Asia/Tashkent
// bo'yicha joriy kun kodi ("mon"..."sun") va "HH:mm" vaqtini qaytaradi —
// Group.days/startTime/endTime shu formatda saqlanadi (server TZ=Asia/Tashkent).
export function getTashkentNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { day: WEEKDAY_TO_CODE[map.weekday], time: `${map.hour}:${map.minute}` };
}

// Guruh hozir aynan shu daqiqada dars vaqtida turibdimi (kun + soat oralig'i).
export function isGroupInLessonNow(group) {
  if (group.status !== "active") return false;
  if (!group.days?.length || !group.startTime || !group.endTime) return false;

  const { day, time } = getTashkentNow();
  if (!group.days.includes(day)) return false;

  return time >= group.startTime && time <= group.endTime;
}

// Bugun shu guruh uchun dars kunimi (soatidan qat'iy nazar) — kunlik
// davomat tugmasini yoqish/o'chirish uchun ("bugun N kun, dars X kuni bo'lsa
// tugma o'chiq turadi"). Guruh hali faollashtirilmagan yoki bugun hali
// darslar boshlangan sanadan oldin bo'lsa ham false qaytadi.
export function isTodayLessonDay(group) {
  if (group.status !== "active") return false;
  if (!group.days?.length) return false;

  const { day } = getTashkentNow();
  if (!group.days.includes(day)) return false;

  if (group.activatedAt) {
    const fmt = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(ms);
    const todayStr = fmt(new Date());
    const activatedStr = fmt(new Date(group.activatedAt * 1000));
    if (todayStr < activatedStr) return false;
  }

  return true;
}

// "HH:mm" <-> kun ichidagi daqiqa — WeeklyRoomSchedule/GroupScheduleDialog
// haftalik jadval blok/bo'sh joylarini hisoblashda ishlatadi.
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Dars tugashiga qolgan vaqt — umumiy daqiqada emas, soat + daqiqa ko'rinishida
 * ("1 s. 45 d. qoldi"). Bir soatdan kam qolsa faqat daqiqa ("59 d. qoldi").
 * Xona va Guruh kartalari ikkalasi ham shu yerdan foydalanadi.
 */
export function formatRemaining(t, mins) {
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours
    ? t("room.remainingHm", { hours, minutes })
    : t("room.remainingMin", { count: minutes });
}
