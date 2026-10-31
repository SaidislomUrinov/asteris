// "2026-10-30 14:05" — unix soniya → Toshkent vaqti.
export const fmtUnix = (unix) => {
  if (!unix) return "—";
  return new Date(unix * 1000)
    .toLocaleString("sv-SE", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" })
    .replace("T", " ");
};

export const TOPIC_COLOR = { debt: "red", absent: "orange", payment: "emerald", lesson: "blue", info: "slate" };
export const STATUS_COLOR = {
  queued: "slate",
  sent: "blue",
  delivered: "emerald",
  failed: "red",
  skipped: "orange",
  sending: "blue",
  done: "emerald",
};

export const TX_COLOR = { topup: "emerald", spend: "blue", refund: "orange", expire: "slate" };
export const PURCHASE_COLOR = { pending: "orange", paid: "emerald", cancelled: "slate", failed: "red" };

// "1 234 567" — UZS va SMS sonlari uchun.
export const fmtNum = (n) => Number(n || 0).toLocaleString("uz-UZ");

// "2026-10-30" — faqat sana (muddat uchun).
export const fmtUnixDate = (unix) => (unix ? fmtUnix(unix).slice(0, 10) : "—");
