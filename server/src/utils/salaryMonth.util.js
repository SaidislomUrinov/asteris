const { formatMonth } = require("./date.util");

// Foizli oylik uchun "oy tugagach yopiladi" qoidasi. O'tgan oy oyligi
// (hodimga allaqachon berilgan bo'lishi mumkin) keyin kelgan voqealar
// sababli ORQAGA o'zgarmasligi kerak:
//  - o'tgan oy uchun KECH qilingan to'lov → qabul qilingan oyga yoziladi;
//  - to'lov keyinroq bekor qilinsa → asl oyda qoladi, bekor qilingan oyda
//    ayiriladi (shu oyning o'zida bekor qilinsa — umuman hisobga kirmaydi);
//  - "3 kun kelmadi" o'tkazmasi (rollover) ham xuddi shunday.
// Oldindan to'lov (keyingi oy uchun) o'sha keyingi oyga yoziladi.
// Tushum hisobotlari (dashboard) bu qoidaga tegmaydi — ular `forMonth`
// bo'yicha qoladi; qulf faqat oylik hisobi uchun.

const laterMonth = (a, b) => (a > b ? a : b);

// Voqea oyi: `month` (qaysi oy uchun) yoki voqea sodir bo'lgan oy — qaysi
// biri KEYIN bo'lsa. `atUnix` bo'lmasa (eski yozuvlar) — `month` o'zi.
const lockMonth = (month, atUnix) => (atUnix ? laterMonth(month, formatMonth(atUnix)) : month);

/**
 * Bitta to'lovning berilgan oy oyligiga hissasi (+/−). "Qaysi oy uchun"
 * keyinroq ko'chirilgan bo'lsa (`forMonthHistory`), har ko'chirish o'z
 * paytidan oldinga surilgan oylar orasida o'tkaziladi.
 * @param {{amount:number,status:string,date:number,forMonth?:string,
 *   cancelledAt?:number,forMonthHistory?:{from:string,to:string,at:number}[]}} p
 * @param {string} month - "YYYY-MM"
 */
const paymentSalaryDelta = (p, month) => {
  const dateMonth = formatMonth(p.date);
  const history = p.forMonthHistory || [];
  const firstFor = history.length ? history[0].from || dateMonth : p.forMonth || dateMonth;
  let current = lockMonth(firstFor, p.date);
  const events = [[current, p.amount]];
  for (const h of history) {
    const next = lockMonth(lockMonth(h.to || dateMonth, p.date), h.at);
    const leave = lockMonth(current, h.at);
    if (leave !== next) events.push([leave, -p.amount], [next, p.amount]);
    current = next;
  }
  if (p.status !== "paid") {
    // Bekor qilingan/qaytarilgan: vaqti noma'lum (eski yozuv) — hech qachon
    // hisobga kirmagan deb olinadi (avvalgi xatti-harakat).
    if (!p.cancelledAt) return 0;
    events.push([lockMonth(current, p.cancelledAt), -p.amount]);
  }
  return events.reduce((sum, [m, v]) => (m === month ? sum + v : sum), 0);
};

/**
 * Bitta rollover'ning berilgan oy oyligiga hissasi: `fromMonth`dan ayiriladi,
 * `toMonth`ga qo'shiladi — ikkalasi ham yaratilgan oydan oldinga surilmaydi.
 * Bekor qilingan bo'lsa, bekor qilingan oyda teskari yozuv.
 */
const rolloverSalaryDelta = (r, month) => {
  const apply = (from, to, sign) => (from === month ? -sign * r.amount : 0) + (to === month ? sign * r.amount : 0);
  const from = lockMonth(r.fromMonth, r.createdAt);
  const to = lockMonth(r.toMonth, r.createdAt);
  let delta = apply(from, to, 1);
  if (r.status === "cancelled") {
    if (!r.cancelledAt) return 0;
    delta += apply(lockMonth(from, r.cancelledAt), lockMonth(to, r.cancelledAt), -1);
  }
  return delta;
};

module.exports = { lockMonth, paymentSalaryDelta, rolloverSalaryDelta };
