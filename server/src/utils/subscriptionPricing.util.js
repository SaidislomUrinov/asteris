// Obuna muddati tanlanganda qo'llaniladigan chegirma jadvali. client'dagi
// `pages/Subscription/durationOptions.js` bilan AYNAN mos bo'lishi shart —
// ikkalasi alohida ilova (server/client) bo'lgani uchun bu yerda takrorlanadi.
const DURATION_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.07, 9: 0.1, 12: 0.12 };

module.exports = {
  DURATION_DISCOUNTS,
  isValidDuration: (months) =>
    Object.prototype.hasOwnProperty.call(DURATION_DISCOUNTS, months),
  calcAmount: (monthlyPrice, months) =>
    Math.round(monthlyPrice * months * (1 - DURATION_DISCOUNTS[months])),
};
