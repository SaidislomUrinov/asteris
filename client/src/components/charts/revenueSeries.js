// Oylik tushum seriyasi (docs/API_CONTRACT_monthly_charts.md): to'lovlarni
// Toshkent kunlariga bo'lib, tanlangan oy va o'tgan oy bo'yicha jamg'arma
// qatorlarini quradi. Oy — QAYSI OY UCHUN to'langani (`forMonth`, bo'lmasa
// to'lov sanasi oyi) — ilovadagi "Oylik tushum" bilan bir xil qoida. Kun —
// to'lov sanasi; oldindan to'lov oyning 1-kuniga, kechikkani oxirgi kuniga. Toshkent — UTC+5, yozgi vaqt yo'q, shuning uchun
// qat'iy siljish yetarli (brauzer vaqt zonasiga bog'liq emas).
const TZ_OFFSET = 5 * 60 * 60;
const pad = (n) => String(n).padStart(2, "0");

const tashkentDay = (unix) => {
  const d = new Date((unix + TZ_OFFSET) * 1000);
  return { month: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`, day: d.getUTCDate() };
};

export const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

const daysIn = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const cumulative = (arr) => {
  let sum = 0;
  return arr.map((v) => (sum += v));
};

/**
 * @param {Array<{date:number, amount:number, status?:string, forMonth?:string}>} payments - `date` unix soniyalarda
 * @param {string} month - "YYYY-MM" (tanlangan oy)
 * @returns {{ rows: Array<{day:number,current:number|null,previous:number|null}>, lastIndex:number,
 *   upto:number, total:number, prevSameDay:number, delta:number|null, month:string, prevMonth:string, isCurrent:boolean }}
 */
export function buildMonthRevenue(payments = [], month) {
  const prevMonth = shiftMonth(month, -1);
  const today = tashkentDay(Math.floor(Date.now() / 1000));
  const isCurrent = month === today.month;
  // Joriy oy — bugungacha; o'tgan oylar — to'liq; kelajak — bo'sh.
  const upto = isCurrent ? today.day : month < today.month ? daysIn(month) : 0;

  const cur = Array(daysIn(month)).fill(0);
  const prev = Array(daysIn(prevMonth)).fill(0);
  for (const p of payments) {
    if (p.status && p.status !== "paid") continue;
    const paidAt = tashkentDay(p.date);
    const m = p.forMonth || paidAt.month;
    const target = m === month ? cur : m === prevMonth ? prev : null;
    if (!target) continue;
    const day = paidAt.month === m ? paidAt.day : paidAt.month < m ? 1 : target.length;
    target[day - 1] += p.amount || 0;
  }

  const curCum = cumulative(cur);
  const prevCum = cumulative(prev);
  // X o'qi — 31 kungacha (eng uzun oy), shunda ikkala oy bir shkalada.
  const axis = Math.max(cur.length, prev.length);
  const rows = Array.from({ length: axis }, (_, i) => ({
    day: i + 1,
    current: i < upto ? curCum[i] : null,
    previous: i < prev.length ? prevCum[i] : null,
  }));

  const total = upto ? curCum[upto - 1] : 0;
  // O'tgan oyning AYNAN SHU KUNIGACHA (masalan 31-mart → 28-fevral).
  const prevSameDay = upto ? prevCum[Math.min(upto, prev.length) - 1] : 0;
  const delta = prevSameDay > 0 ? (total - prevSameDay) / prevSameDay : null;

  return { rows, lastIndex: upto - 1, upto, total, prevSameDay, delta, month, prevMonth, isCurrent };
}

export const currentMonthTashkent = () => tashkentDay(Math.floor(Date.now() / 1000)).month;
