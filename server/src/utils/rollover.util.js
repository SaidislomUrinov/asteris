// "Percent + davomat rollover" (CLAUDE.md "Ish haqi"): o'quvchi to'lov qilib
// ketma-ket ROLLOVER_ABSENCE_DAYS ta darsga kelmasa va filial sozlamasida
// "keyingi oyga o'tkazish" yoqilgan bo'lsa, shu kunlarning summasi:
//  - shu oy o'qituvchi percent oyligi va markaz tushumidan AYIRILADI,
//  - keyingi oyga QO'SHILADI,
//  - o'quvchining keyingi sikl to'lovidan CHEGIRMA qilinadi.
// Yozuv `Student.groups[].rollovers[]` da saqlanadi va HECH QACHON
// o'chirilmaydi — davomat tuzatilsa `status: "cancelled"` bo'ladi.

const ROLLOVER_ABSENCE_DAYS = 3;

/**
 * Sof funksiya: davomat tarixidan qaysi rollover bekor qilinishi va qaysi
 * yangi blok yaratilishi kerakligini aniqlaydi.
 * @param {{date:string,status:string}[]} history - sana bo'yicha o'sish tartibida
 * @param {{_id:any,dates:string[],status:string}[]} rollovers - mavjud yozuvlar
 * @param {(status:string)=>boolean} isEligible
 * @returns {{ cancel: any[], create: string[][] }}
 */
const planRollovers = (history, rollovers, isEligible, days = ROLLOVER_ABSENCE_DAYS) => {
  const eligibleDates = new Set(history.filter((h) => isEligible(h.status)).map((h) => h.date));

  const cancel = [];
  const covered = new Set();
  for (const r of rollovers || []) {
    if (r.status !== "active") continue;
    if (r.dates.every((d) => eligibleDates.has(d))) {
      r.dates.forEach((d) => covered.add(d));
    } else {
      cancel.push(r._id);
    }
  }

  const create = [];
  let run = [];
  for (const h of [...history].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (!isEligible(h.status) || covered.has(h.date)) {
      run = [];
      continue;
    }
    run.push(h.date);
    if (run.length === days) {
      create.push(run);
      run = [];
    }
  }

  return { cancel, create };
};

// Berilgan sikl oralig'iga tushadigan (keyingi siklga o'tkazilgan) faol
// rollover summalari — computeBilling chegirmasi uchun.
const cycleRolloverDiscount = (entry, cycleStart, cycleEnd) =>
  (entry.rollovers || [])
    .filter((r) => r.status === "active" && r.applyAt >= cycleStart && r.applyAt < cycleEnd)
    .reduce((sum, r) => sum + r.amount, 0);

// Oy bo'yicha tushum/percent tuzatmasi: `fromMonth` dan ayiriladi,
// `toMonth` ga qo'shiladi. `idSet` berilsa faqat shu guruhlar hisoblanadi,
// `entryFilter` — qo'shimcha a'zolik filtri (masalan dashboard qamrovi).
const monthRolloverAdjustment = (students, idSet, month, entryFilter = null) => {
  let adj = 0;
  for (const student of students) {
    for (const entry of student.groups || []) {
      if (idSet && !idSet.has(String(entry.group))) continue;
      if (entryFilter && !entryFilter(entry)) continue;
      for (const r of entry.rollovers || []) {
        if (r.status !== "active") continue;
        if (r.fromMonth === month) adj -= r.amount;
        if (r.toMonth === month) adj += r.amount;
      }
    }
  }
  return adj;
};

module.exports = {
  ROLLOVER_ABSENCE_DAYS,
  planRollovers,
  cycleRolloverDiscount,
  monthRolloverAdjustment,
};
