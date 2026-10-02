// Pul summasi (UZS) — butun, musbat, aqlli yuqori chegara bilan.
//
// Avval `!amount || amount <= 0` tekshiruvi ishlatilardi: `true` → 1 so'm,
// `"abc"`, `[5]`, `1e300` kabi qiymatlar o'tib ketardi (QA 2026-10-02).
// Raqamli satr ("150000") qabul qilinadi — formalar ba'zan satr yuboradi.
const MAX_AMOUNT = 1e12; // 1 trillion so'm — har qanday real to'lovdan katta

/**
 * @param {*} value
 * @returns {number|null} yaroqli bo'lsa butun son, aks holda null
 */
const parseAmount = (value) => {
  let n = value;
  if (typeof n === "string" && /^\d+$/.test(n.trim())) n = Number(n.trim());
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  if (n < 1 || n > MAX_AMOUNT) return null;
  return n;
};

module.exports = { parseAmount, MAX_AMOUNT };
