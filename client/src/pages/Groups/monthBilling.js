// Guruh detali "Umumiy" tabidagi oy filtri uchun moliya hisobi
// (docs/API_CONTRACT_group_month_filter_and_start_date.md §A.3).

/**
 * Tanlangan oy bo'yicha a'zolikning `{ paid, due, debt }` qiymati.
 *
 * - Joriy oy — AVVALGI mantiq bilan aynan bir xil: joriy sikl
 *   (`currentCyclePrice`/`paidForCurrentCycle`). Sanadan-sanaga rejimida
 *   joriy sikl o'tgan oy yorlig'ida bo'lishi mumkin — shuning uchun joriy
 *   oy `billingMonths` dan emas, shu maydonlardan olinadi.
 * - O'tgan oy — server `entry.billingMonths` dan; shu oyda a'zolik
 *   bo'lmasa (yoki backend hali `billingMonths` bermasa) `null` → UI'da "—".
 */
export function monthBilling(entry, month, currentMonth) {
  if (!entry) return null;
  if (!month || month === currentMonth) {
    const due = entry.currentCyclePrice || 0;
    const paid = entry.paidForCurrentCycle || 0;
    return {
      paid,
      due,
      debt: Math.max(0, due - paid),
      isCurrent: true,
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
  };
}

/** "YYYY-MM" ni [min, max] oralig'iga siqadi; noto'g'ri format → `max`. */
export function clampMonth(month, min, max) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return max;
  if (max && month > max) return max;
  if (min && month < min) return min;
  return month;
}
