// Obuna muddati chegirmalari — endi Admin paneldan sozlanadi
// (SystemSetting.subscription.durationDiscounts, docs/API_CONTRACT_tariff_discounts.md).
// Bu yerda faqat default jadval va sof hisob/validatsiya funksiyalari.
const DEFAULT_DURATION_DISCOUNTS = [
  { months: 1, percent: 0 },
  { months: 3, percent: 5 },
  { months: 6, percent: 7 },
  { months: 9, percent: 10 },
  { months: 12, percent: 12 },
];
const MAX_ROWS = 12;
const MAX_MONTHS = 36;
const MAX_PERCENT = 90;

// Kiruvchi `items`ni tekshiradi va saqlashga tayyor (saralangan) ko'rinishda qaytaradi.
const normalizeDiscounts = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error("tariff.discountsEmpty");
  if (items.length > MAX_ROWS) throw new Error("tariff.discountsInvalid");
  const seen = new Set();
  const rows = items.map((it) => {
    const months = Number(it?.months);
    const percent = Math.round(Number(it?.percent) * 10) / 10;
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) throw new Error("tariff.discountsInvalid");
    if (!Number.isFinite(percent) || percent < 0 || percent > MAX_PERCENT) throw new Error("tariff.discountsInvalid");
    if (seen.has(months)) throw new Error("tariff.discountsDuplicate");
    seen.add(months);
    return { months, percent };
  });
  return rows.sort((a, b) => a.months - b.months);
};

// Saqlangan jadval (yo'q/bo'sh bo'lsa default) — `{ months, percent }[]`.
const discountsOf = (setting) => {
  const list = setting?.subscription?.durationDiscounts;
  return Array.isArray(list) && list.length
    ? list.map((d) => ({ months: d.months, percent: d.percent || 0 })).sort((a, b) => a.months - b.months)
    : DEFAULT_DURATION_DISCOUNTS;
};

module.exports = {
  DEFAULT_DURATION_DISCOUNTS,
  normalizeDiscounts,
  discountsOf,
  // Jadvalda bo'lmagan muddat → null.
  calcAmount: (monthlyPrice, months, discounts) => {
    const row = discounts.find((d) => d.months === months);
    if (!row) return null;
    return Math.round(monthlyPrice * months * (1 - row.percent / 100));
  },
};
