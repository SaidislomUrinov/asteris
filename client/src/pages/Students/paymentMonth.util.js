// To'lovni boshqa oyga o'tkazish (API_CONTRACT_payment_move_month.md) —
// MovePaymentMonthDialog va StudentDetail uchun umumiy yordamchilar.

// Joriy sikl oyidan keyin qancha oy oldinga taklif qilinadi.
const FUTURE_MONTHS = 3;

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Unix (soniya) sanadan Asia/Tashkent bo'yicha "YYYY-MM".
export function monthOfUnix(unix) {
  if (!unix) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(unix * 1000));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

// To'lov hozir qaysi oyga biriktirilgan — `forMonth` bo'sh bo'lsa sana oyi
// (server ham shunday talqin qiladi).
export function paymentEffectiveMonth(payment) {
  return payment?.forMonth || monthOfUnix(payment?.date);
}

// Maqsad oy variantlari (server qoidasi bilan bir xil): opening qarz oylari +
// courseStartMonth..(currentCycleMonth + 3). Hozirgi oy chiqarib tashlanadi.
// Natija: [{ month, debt }] — o'sish tartibida, `debt` debtBreakdown'dan.
export function moveMonthOptions(entry, payment) {
  const set = new Set();
  (entry?.openingDebts || []).forEach((r) => r.month && set.add(r.month));

  const start = entry?.courseStartMonth;
  if (start) {
    const end = shiftMonth(entry.currentCycleMonth || start, FUTURE_MONTHS);
    for (let m = start; m <= end; m = shiftMonth(m, 1)) set.add(m);
  }

  const current = paymentEffectiveMonth(payment);
  set.delete(current);

  const debtByMonth = {};
  (entry?.debtBreakdown || []).forEach((item) => {
    if (item.month && item.debt > 0) debtByMonth[item.month] = (debtByMonth[item.month] || 0) + item.debt;
  });

  return [...set].sort().map((month) => ({ month, debt: debtByMonth[month] || 0 }));
}

// Unix (soniya) sanadan Asia/Tashkent bo'yicha "DD.MM".
export function formatDayMonth(unix) {
  if (!unix) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date(unix * 1000));
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${day}.${month}`;
}

// Qarz qatori oralig'i (`from` — to'lov boshlangan kun, `to` — sikl oxiri) — "20.10 – 25.10".
// Ikkalasi bo'lmasa bo'sh satr.
export function formatCycleRange(from, to) {
  if (!from || !to) return "";
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}
