// "O'qishni boshlagan sana" (docs/API_CONTRACT_group_month_filter_and_start_date.md §B)
// uchun kun yordamchilari. Server kunni Asia/Tashkent bo'yicha talqin qiladi,
// shuning uchun brauzer timezone'idan qat'i nazar shu zonada formatlanadi.
const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Unix SONIYA (server `getNow()`) → "YYYY-MM-DD" (Asia/Tashkent). Berilmasa — bugun. */
export function tashkentDay(unixSeconds) {
  const date = unixSeconds === undefined ? new Date() : new Date(unixSeconds * 1000);
  return DAY_FMT.format(date);
}

/**
 * Sana chegaralarini tekshiradi — xato bo'lsa i18n kalitini tashlaydi
 * (server bilan bir xil kalitlar). Bo'sh qiymat — "bugun" degani, xato emas.
 */
export function assertStartDate(value, min) {
  if (!value) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("student.startDateInvalid");
  if (value > tashkentDay()) throw new Error("student.startDateFuture");
  if (min && value < min) throw new Error("student.startDateBeforeGroup");
}
