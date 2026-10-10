import i18n from "../i18n";
import { money } from "../utils/format";

const TZ = "Asia/Tashkent";

// Toshkent vaqti bo'yicha "HH:mm" va "YYYY-MM-DD" (qurilma soat mintaqasidan
// qat'i nazar — server vaqtlari ham Toshkentda, §3.2).
const parts = (d = new Date()) => {
  const out = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  })
    .formatToParts(d)
    .forEach((p) => { out[p.type] = p.value; });
  return out;
};
export const tashkentHHmm = (d) => {
  const p = parts(d);
  return `${p.hour}:${p.minute}`;
};
export const tashkentDate = (d) => {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
};
export const tashkentDateShift = (days) => tashkentDate(new Date(Date.now() + days * 86400000));
export const tashkentMonth = () => tashkentDate().slice(0, 7);

// KPI uchun ixcham summa: 6 400 000 → "6,4 mln", 850 000 → "850 ming".
export const compactMoney = (v) => {
  const n = Math.round(v || 0);
  const abs = Math.abs(n);
  const dec = i18n.language === "en" ? "." : ",";
  const fmt = (x) => {
    const s = (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return s.replace(".", dec);
  };
  if (abs >= 1e9) return `${fmt(n / 1e9)} ${i18n.t("worker.unit.bln")}`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} ${i18n.t("worker.unit.mln")}`;
  if (abs >= 1e4) return `${fmt(n / 1e3)} ${i18n.t("worker.unit.k")}`;
  return money(n);
};

// Guruh yorlig'i — client panelidagi bilan bir xil: nom bo'lsa nom,
// aks holda "Fan - №".
export const groupLabel = (g) => {
  if (!g) return "—";
  if (g.name) return g.name;
  const no = g.status === "pending" ? g.pendingId : g.activeId;
  return [g.subjectName, no].filter((x) => x != null && x !== "").join(" - ") || "—";
};

// Server xato kodi → matn. Avval `worker.errors.*`, keyin umumiy kalit.
export const errKey = (e) => {
  const code = e?.code || e?.message || "error.unknown";
  return i18n.exists(`worker.errors.${code}`) ? `worker.errors.${code}` : code;
};
// Bildirishnoma sarlavha/matni: server hodim xabarlarini tarjima KALITI sifatida
// saqlaydi (`notification.lessonReminderTitle` + `data`) — client panelidagi
// NotificationItem bilan bir xil qoida; qolganlari tayyor matn.
export const notifText = (value, data) =>
  typeof value === "string" && value.startsWith("notification.") ? i18n.t(value, { ...(data || {}), defaultValue: value }) : value;

export const errText = (e) => i18n.t(errKey(e), { defaultValue: i18n.t("error.unknown") });
// ErrorState `error.code` ni t() bilan o'qiydi — worker kalitiga moslab beramiz.
export const asErr = (e) => (e ? { code: errKey(e) } : null);

// Summa maskasi: faqat raqamlar, 3 xonali guruhlar ("1 250 000").
export const digitsOnly = (s) => String(s || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
export const maskMoney = (s) => {
  const d = digitsOnly(s);
  return d ? money(Number(d)) : "";
};

// Telegram ichidami (brauzerda `telegram-web-app.js` bo'lsa ham platforma
// "unknown" bo'ladi) — tashqarida sahifa ichidagi "orqaga" tugmasi ko'rinadi.
export const isInTelegram = () => {
  const p = window.Telegram?.WebApp?.platform;
  return !!p && p !== "unknown";
};

// Qo'ng'iroq — Leads sahifasidagi bilan bir xil `tel:` havola.
export const callPhone = (phone) => {
  if (phone) window.location.href = `tel:${String(phone).replace(/[^\d+]/g, "")}`;
};

// Guruh bo'yicha FAOL a'zolik (bitta o'quvchida shu guruhda chiqib-qaytgan
// bir nechta a'zolik bo'lishi mumkin) — client GroupDetail `entryOf` bilan bir xil.
export const activeEntryOf = (student, groupId) =>
  (student?.groups || []).find((g) => String(g.group) === String(groupId) && g.status === "active") || null;

// Ism bo'yicha tartib (o'quvchilar ro'yxatlari).
export const byName = (a, b) => (a.fullName || "").localeCompare(b.fullName || "");

// Oy filtri (docs/API_CONTRACT_group_month_filter_and_start_date.md §D):
// unix soniya → Toshkent "YYYY-MM-DD".
const ymdOfUnix = (u) => tashkentDate(new Date(u * 1000));
export const tashkentMonthOfUnix = (u) => (u ? ymdOfUnix(u).slice(0, 7) : null);

// "YYYY-MM" ni [min, max] oralig'iga siqadi; noto'g'ri format → max.
export const clampMonth = (month, min, max) => {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return max;
  if (max && month > max) return max;
  if (min && month < min) return min;
  return month;
};

// Sikl davri `25.09 – 24.10` (§C) — FAQAT kalendar oyiga to'g'ri kelmasa
// (from oy 1-kuni emas yoki to keyingi oy 1-kuni emas). `to` eksklyuziv —
// ko'rsatishda bir kun oldingi sana. Aks holda null.
export const cyclePeriodLabel = (from, to) => {
  if (from == null || to == null) return null;
  const a = ymdOfUnix(from);
  const b = ymdOfUnix(to);
  const [ay, am] = a.split("-").map(Number);
  const next = am === 12 ? `${ay + 1}-01` : `${ay}-${String(am + 1).padStart(2, "0")}`;
  if (a.endsWith("-01") && b === `${next}-01`) return null;
  const last = ymdOfUnix(to - 86400);
  const dm = (ymd) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
  return `${dm(a)} – ${dm(last)}`;
};

// Guruh "O'quvchilar" tabidagi tanlangan oy bo'yicha qator holati (§D).
// Joriy oy — avvalgi xatti-harakat: umumiy `entry.debt` (o'zgarmaydi), davr
// joriy sikldan (`priceCycles` → `isCurrent`). O'tgan oy — `billingMonths[M]`;
// shu oyda a'zolik bo'lmasa null (pill yo'q).
export const monthRowOf = (entry, month, currentMonth) => {
  if (!entry) return null;
  if (!month || month === currentMonth) {
    const cur = (entry.priceCycles || []).find((c) => c.isCurrent);
    return {
      isCurrent: true,
      debt: Math.max(0, entry.debt || 0),
      due: null,
      period: cur ? cyclePeriodLabel(cur.from, cur.to) : null,
    };
  }
  const row = (entry.billingMonths || []).find((m) => m.month === month);
  if (!row) return null;
  const due = row.due || 0;
  return {
    isCurrent: false,
    debt: row.debt ?? Math.max(0, due - (row.paid || 0)),
    due,
    period: cyclePeriodLabel(row.from, row.to),
  };
};

// `student:updated` payload'i (server `emitStudentUpdated`) — o'zgarishi
// mumkin bo'lgan BARCHA maydonlar shu yerda keladi, shuning uchun refetchsiz
// birlashtirish yetarli. Rasm olib tashlanganda `photo: ""` — `in` bilan.
const STUDENT_PATCH_FIELDS = [
  "fullName", "phone", "parentPhone", "telegramSame", "telegramPhone",
  "parentTelegramSame", "parentTelegramPhone", "parentTelegram", "studentTelegram",
];
export const mergeStudentUpdate = (student, payload) => {
  if (!student || !payload) return student;
  const next = { ...student };
  STUDENT_PATCH_FIELDS.forEach((k) => {
    if (payload[k] !== undefined) next[k] = payload[k];
  });
  if ("photo" in payload) next.photo = payload.photo || "";
  return next;
};
