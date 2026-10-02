import i18n from "../i18n";

export const money = (v) => String(Math.round(v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// unix soniya yoki "YYYY-MM-DD" → Date
export const toDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const months = (kind) => i18n.t(`months.${kind}`, { returnObjects: true }) || [];

// Chromium/Telegram WebView'ning ICU'sida uz oy nomlari yo'q — shuning uchun
// Intl.DateTimeFormat ishlatilmaydi, oy nomlari o'z lug'atimizdagi
// `months.genitive` massivdan olinadi ("1-sentabr" / "1 сентября" / "September 1").
export const fmtDate = (v) => {
  const d = toDate(v);
  if (!d) return "";
  const day = d.getDate();
  const m = months("genitive")[d.getMonth()] || "";
  const lng = i18n.language;
  if (lng === "ru") return `${day} ${m}`;
  if (lng === "en") return `${m} ${day}`;
  return `${day}-${m}`;
};
export const fmtDateFull = (v) => {
  const d = toDate(v);
  return d ? `${fmtDate(v)} ${d.getFullYear()}` : "";
};
export const fmtTime = (v) => {
  const d = toDate(v);
  return d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
};
// "YYYY-MM" → "Sentabr 2026"
export const fmtMonth = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return `${months("long")[m - 1] || ym} ${y}`;
};
// "YYYY-MM" → oy nomi jumla ichida ("Sentabr reytingi" / "Рейтинг за сентябрь").
// Rus tilida oy nomi jumla o'rtasida kichik harf bilan yoziladi.
export const monthName = (ym) => {
  if (!ym) return "";
  const n = months("long")[Number(ym.split("-")[1]) - 1] || ym;
  return i18n.language === "ru" ? n.toLowerCase() : n;
};
export const ymOf = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  return ymOf(new Date(y, m - 1 + delta, 1));
};
export const todayStr = () => {
  const d = new Date();
  return `${ymOf(d)}-${String(d.getDate()).padStart(2, "0")}`;
};
export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
// "YYYY-MM-DD" + n kun (mahalliy kalendar bo'yicha)
export const shiftDay = (ymd, delta) => {
  const d = toDate(ymd);
  d.setDate(d.getDate() + delta);
  return `${ymOf(d)}-${String(d.getDate()).padStart(2, "0")}`;
};
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// "YYYY-MM-DD" → "mon" | ... (days.* i18n kaliti uchun)
export const weekdayKey = (ymd) => WEEKDAY_KEYS[toDate(ymd)?.getDay() ?? 0];
// "YYYY-MM-DD" → "Payshanba" (days.full.* i18n kaliti orqali, gapdagi shakl)
export const weekdayFull = (ymd) => i18n.t(`days.full.${weekdayKey(ymd)}`);
