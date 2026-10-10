// Guruh detali "Umumiy" tabidagi oy filtri uchun moliya hisobi
// (docs/API_CONTRACT_group_month_filter_and_start_date.md §A.3).

/**
 * Tanlangan oy bo'yicha a'zolikning `{ paid, due, debt }` qiymati.
 *
 * - Joriy oy — AVVALGI mantiq bilan aynan bir xil: joriy sikl
 *   (`currentCyclePrice`/`paidForCurrentCycle`). Sanadan-sanaga rejimida
 *   joriy sikl o'tgan oy yorlig'ida bo'lishi mumkin — shuning uchun joriy
 *   oy `billingMonths` dan emas, shu maydonlardan olinadi.
 * - Davr (`from`/`to`, `period` matni — §C): joriy oyda `priceCycles` dagi
 *   joriy sikl, o'tgan oyda `billingMonths[M]`.
 * - O'tgan oy — server `entry.billingMonths` dan; shu oyda a'zolik
 *   bo'lmasa (yoki backend hali `billingMonths` bermasa) `null` → UI'da "—".
 */
export function monthBilling(entry, month, currentMonth) {
  if (!entry) return null;
  if (!month || month === currentMonth) {
    const due = entry.currentCyclePrice || 0;
    const paid = entry.paidForCurrentCycle || 0;
    const cycle = (entry.priceCycles || []).find((c) => c.isCurrent);
    return {
      paid,
      due,
      debt: Math.max(0, due - paid),
      isCurrent: true,
      from: cycle?.from ?? null,
      to: cycle?.to ?? null,
      period: cycle ? periodLabel(cycle.from, cycle.to) : null,
    };
  }
  const row = (entry.billingMonths || []).find((m) => m.month === month);
  if (!row) return null;
  const due = row.due || 0;
  const paid = row.paid || 0;
  return {
    paid,
    due,
    debt: row.debt ?? Math.max(0, due - paid),
    isCurrent: false,
    from: row.from ?? null,
    to: row.to ?? null,
    period: periodLabel(row.from, row.to),
  };
}

/** "YYYY-MM" ni [min, max] oralig'iga siqadi; noto'g'ri format → `max`. */
export function clampMonth(month, min, max) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return max;
  if (max && month > max) return max;
  if (min && month < min) return min;
  return month;
}

// Asia/Tashkent kun komponentlari — brauzer zonasidan qat'i nazar.
const PERIOD_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  day: "2-digit",
  month: "2-digit",
});

const dayParts = (unixSeconds) => {
  const parts = PERIOD_FMT.formatToParts(new Date(unixSeconds * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return { day: get("day"), month: get("month") };
};

/**
 * Oy qatori davri `25.09 – 24.10` (§C). `to` eksklyuziv — bir kun oldingisi
 * ko'rsatiladi. Davr kalendar oyiga to'g'ri kelsa (from — oyning 1-kuni VA
 * to — keyingi oyning 1-kuni) yoki chegaralar noma'lum bo'lsa `null`.
 */
export function periodLabel(from, to) {
  if (!from || !to || to <= from) return null;
  const start = dayParts(from);
  const endExclusive = dayParts(to);
  if (start.day === "01" && endExclusive.day === "01") return null;
  const end = dayParts(to - 1);
  return `${start.day}.${start.month} – ${end.day}.${end.month}`;
}

