// YUTUQ NISHONLARI (badge) — sof hisob, bazaga tegmaydi
// (API_CONTRACT_badges_monthly_rank.md §C). Bazadan ma'lumot yig'ish va
// yozish `services/badge.service.js` da; bu yerda faqat qoidalar — job,
// qo'lda skript, client va ota-ona endpointlari AYNAN shu funksiyalarni
// ishlatadi (ikki joyda ikki xil shart bo'lib qolmasin).
const moment = require("moment-timezone");

const TZ = "Asia/Tashkent";

// Tartib frontend constantlari bilan BIR XIL (ro'yxat/ikonkalar shu tartibda).
const BADGE_TYPES = [
  "perfectAttendance",
  "excellent",
  "perfect",
  "attendanceStreak",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
  "titleDefender",
  "phoenix",
  "punctual",
  "grandSlam",
  "comeback",
];

// Bahodan kelib chiqadigan nishonlar — markaz `showGrades: false` qilgan
// bo'lsa ota-onaga ko'rsatilmaydi.
// Reyting (StudentMedal / oylik o'rin) ham baholarga asoslangan.
const GRADE_BADGES = [
  "excellent",
  "perfect",
  "gradeStreak",
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
  "titleDefender",
  "phoenix",
  "grandSlam",
];

// Guruh ichidagi O'RINGA bog'liq nishonlar — individual (1 kishilik) guruhda
// ma'nosiz, u yerda ko'rsatilmaydi (API_CONTRACT_individual_students.md §0.6).
// `punctual` kirmaydi: reyting/bahoga bog'liq emas.
const RANK_BADGES = [
  "champion",
  "mostImproved",
  "podiumStreak",
  "goldCollection",
  "bigJump",
  "titleDefender",
  "phoenix",
  "grandSlam",
];

// Telegram xabaridagi belgi.
const BADGE_EMOJI = {
  perfectAttendance: "📅",
  excellent: "⭐",
  perfect: "👑",
  attendanceStreak: "🔥",
  gradeStreak: "⚡",
  champion: "🏆",
  mostImproved: "📈",
  podiumStreak: "🏅",
  goldCollection: "🥇",
  bigJump: "🚀",
  titleDefender: "🛡️",
  phoenix: "🦅",
  punctual: "⏰",
  grandSlam: "💎",
  comeback: "⚡",
};

// Tarif flagi (Tariff.allowedPermissions).
const BADGE_FEATURE = "gamification.badges";

const MIN_LESSONS = 4; // perfectAttendance: oyda kamida shuncha dars (present+absent)
const MIN_GRADES = 4; // excellent/perfect/mostImproved: oyda kamida shuncha baho
const EXCELLENT_MIN_VALUE = 8;
const MAX_GRADE = 10;
const ATTENDANCE_STREAK = 10; // ketma-ket "present"
const GRADE_STREAK = 5; // ketma-ket "10"
const PODIUM_STREAK = 3; // ketma-ket oylar top-3 da (StudentMedal)
const GOLD_COLLECTION = 3; // jami oltin medal (1-o'rin) — bir martalik
const TITLE_DEFENDER_MIN_RANKED = 3; // titleDefender: oyda kamida shuncha reytingli o'quvchi
const PHOENIX_MIN_RANKED = 6; // phoenix: M va M-1 da kamida shuncha reytingli o'quvchi
const PUNCTUAL_MIN_LESSONS = 6; // punctual: oyda kamida shuncha dars (present+absent)
const COMEBACK_PREV_ABSENT = 3; // comeback: o'tgan oyda kamida shuncha qoldirilgan dars (absent)
const COMEBACK_MIN_LESSONS = 6; // comeback: shu oyda kamida shuncha dars (present+absent), absent = 0
const BIG_JUMP = 5; // o'tgan oyga nisbatan reytingda kamida shuncha pog'ona ko'tarilish

const round2 = (n) => Math.round(n * 100) / 100;
const avgOf = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

const currentMonth = () => moment.tz(TZ).format("YYYY-MM");
const prevMonthOf = (month) => moment.tz(`${month}-01`, "YYYY-MM-DD", TZ).subtract(1, "month").format("YYYY-MM");
const inMonth = (date, month) => String(date).startsWith(`${month}-`);

// "Podium seriyasi": `month` dan oldingi uzluksiz top-3 oylar soni (StudentMedal
// tarixi bo'yicha), PODIUM_STREAK-1 gacha. Shu nishon berilgan oy seriyani
// yopadi (counter = 0 — runStreak bilan bir xil semantika), u oy sanalmaydi.
const podiumRunBefore = (month, medalMonths, podiumEarnedMonths) => {
  let run = 0;
  let m = prevMonthOf(month);
  while (run < PODIUM_STREAK - 1 && medalMonths.has(m) && !podiumEarnedMonths.has(m)) {
    run++;
    m = prevMonthOf(m);
  }
  return run;
};

// Seriya algoritmi (oy chegarasidan o'tadi, butun tarix, sana tartibida):
// `hit === true` → counter++, `false` → counter = 0, `null` → o'tkazib
// yuboriladi (sababli dars seriyani uzmaydi). `counter === target` bo'lgan
// yozuvning oyi "berilgan oylar"ga qo'shiladi va counter = 0.
// Qaytaradi: { months: Set<"YYYY-MM">, current } — current = oxirgi counter.
const runStreak = (events, target) => {
  let counter = 0;
  const months = new Set();
  for (const e of events) {
    if (e.hit === null) continue;
    if (!e.hit) {
      counter = 0;
      continue;
    }
    counter++;
    if (counter === target) {
      months.add(String(e.date).slice(0, 7));
      counter = 0;
    }
  }
  return { months, current: counter };
};

// Bitta o'quvchining `month` oyi bo'yicha shartlari.
//   attendance — [{ date, status }], grades — [{ date, value }] (guruh
//   bo'yicha butun tarix, sana o'sish tartibida; `month` dan keyingilari
//   e'tiborsiz qoldiriladi — natija takrorlanuvchi/idempotent).
//   position/rankedTotal — `month` oylik reytingidagi o'rin (gradeScore.util).
//   prevPosition — o'tgan oy reytingidagi o'rin (bigJump).
//   prevRankedTotal — o'tgan oy reytingli o'quvchilar soni (phoenix).
//   attendance elementlari: { date, status, late } (late — faqat present'da sanaladi).
//   medals — `month` dan OLDINGI oylar medallari [{ month, position }] (StudentMedal).
//   earnedBefore — `month` dan oldin berilgan podiumStreak/goldCollection
//   nishonlari [{ type, month }] (seriya yopilishi va bir martalik shart uchun).
// Qaytaradi: { earned: { [type]: meta }, progress: { [type]: {...} }, delta }.
// `mostImproved` bu yerda BERILMAYDI — u guruh darajasida (`applyMostImproved`).
const evaluateStudent = ({
  attendance = [],
  grades = [],
  month,
  position = null,
  rankedTotal = 0,
  prevPosition = null,
  prevRankedTotal = 0,
  medals = [],
  earnedBefore = [],
}) => {
  const endDate = `${month}-31`;
  const att = attendance.filter((a) => a.date <= endDate);
  const gr = grades.filter((g) => g.date <= endDate);
  const prevMonth = prevMonthOf(month);

  let present = 0;
  let absent = 0;
  let late = 0; // oydagi kechikkan present yozuvlari
  for (const a of att) {
    if (!inMonth(a.date, month)) continue;
    if (a.status === "present") {
      present++;
      if (a.late === true) late++;
    } else if (a.status === "absent") absent++;
  }
  const held = present + absent; // `excused` sanalmaydi
  // comeback: o'tgan oydagi qoldirilgan darslar (excused sanalmaydi).
  let prevAbsent = 0;
  for (const a of att) if (inMonth(a.date, prevMonth) && a.status === "absent") prevAbsent++;

  const monthGrades = gr.filter((g) => inMonth(g.date, month)).map((g) => g.value);
  const prevGrades = gr.filter((g) => inMonth(g.date, prevMonth)).map((g) => g.value);
  const gradeCount = monthGrades.length;
  const tensCount = monthGrades.filter((v) => v === MAX_GRADE).length;
  const average = avgOf(monthGrades);
  const prevAverage = avgOf(prevGrades);

  const attStreak = runStreak(
    att.map((a) => ({ date: a.date, hit: a.status === "present" ? true : a.status === "absent" ? false : null })),
    ATTENDANCE_STREAK,
  );
  const grStreak = runStreak(
    gr.map((g) => ({ date: g.date, hit: g.value === MAX_GRADE })),
    GRADE_STREAK,
  );

  const delta =
    gradeCount >= MIN_GRADES && prevGrades.length >= MIN_GRADES ? round2(average - prevAverage) : null;

  // Reyting nishonlari — oylik o'rin va medal tarixi bo'yicha.
  const pastMedals = medals.filter((m) => m.month < month);
  const podiumNow = position !== null && position <= 3;
  const podiumEarned = new Set(earnedBefore.filter((b) => b.type === "podiumStreak").map((b) => b.month));
  const podiumRun = podiumRunBefore(month, new Set(pastMedals.map((m) => m.month)), podiumEarned);
  const goldCount = pastMedals.filter((m) => m.position === 1).length + (position === 1 ? 1 : 0);
  const goldDone = earnedBefore.some((b) => b.type === "goldCollection" && b.month < month);
  const jump = position !== null && prevPosition !== null ? prevPosition - position : null;

  // Raqobat nishonlari (API_CONTRACT_competition_badges.md §1).
  const wasBottomHalf = prevPosition !== null && prevRankedTotal > 0 && prevPosition > prevRankedTotal / 2;

  const cond = {
    perfectAttendance: held >= MIN_LESSONS && absent === 0,
    excellent: gradeCount >= MIN_GRADES && monthGrades.every((v) => v >= EXCELLENT_MIN_VALUE),
    perfect: gradeCount >= MIN_GRADES && tensCount === gradeCount,
    attendanceStreak: attStreak.months.has(month),
    gradeStreak: grStreak.months.has(month),
    champion: position === 1,
    podiumStreak: podiumNow && podiumRun >= PODIUM_STREAK - 1,
    goldCollection: !goldDone && goldCount >= GOLD_COLLECTION,
    bigJump: jump !== null && jump >= BIG_JUMP,
    titleDefender: position === 1 && prevPosition === 1 && rankedTotal >= TITLE_DEFENDER_MIN_RANKED,
    phoenix:
      wasBottomHalf &&
      position !== null &&
      position <= 3 &&
      rankedTotal >= PHOENIX_MIN_RANKED &&
      prevRankedTotal >= PHOENIX_MIN_RANKED,
    punctual: held >= PUNCTUAL_MIN_LESSONS && absent === 0 && late === 0,
    comeback: prevAbsent >= COMEBACK_PREV_ABSENT && held >= COMEBACK_MIN_LESSONS && absent === 0,
  };
  cond.grandSlam = cond.perfectAttendance && (cond.excellent || cond.perfect) && position !== null && position <= 3;

  const earned = {};
  if (cond.perfectAttendance) earned.perfectAttendance = { present, held };
  if (cond.excellent) earned.excellent = { gradeCount, average: round2(average) };
  if (cond.perfect) earned.perfect = { gradeCount };
  if (cond.attendanceStreak) earned.attendanceStreak = { target: ATTENDANCE_STREAK };
  if (cond.gradeStreak) earned.gradeStreak = { target: GRADE_STREAK };
  if (cond.champion) earned.champion = { position, total: rankedTotal };
  if (cond.podiumStreak) earned.podiumStreak = { target: PODIUM_STREAK, position };
  if (cond.goldCollection) earned.goldCollection = { golds: goldCount };
  if (cond.bigJump) earned.bigJump = { from: prevPosition, to: position, jump };
  if (cond.titleDefender) earned.titleDefender = { position: 1, total: rankedTotal };
  if (cond.phoenix) earned.phoenix = { from: prevPosition, to: position, total: rankedTotal };
  if (cond.punctual) earned.punctual = { held };
  if (cond.grandSlam)
    earned.grandSlam = { position, present, held, gradeCount, average: average === null ? null : round2(average) };
  if (cond.comeback) earned.comeback = { prevAbsent, held };

  // `achieved`/`broken` — kontraktdan tashqari qulaylik: UI "shartni hozircha
  // bajaryapti / bu oy buzildi" holatini qayta hisoblamasin.
  const progress = {
    perfectAttendance: { current: present, target: held, min: MIN_LESSONS, absent, achieved: cond.perfectAttendance },
    // `broken` — shu oyda shartni buzuvchi baho bor (<8 / ≠10): bu oy endi olinmaydi.
    excellent: {
      current: gradeCount,
      min: MIN_GRADES,
      minValue: EXCELLENT_MIN_VALUE,
      broken: monthGrades.some((v) => v < EXCELLENT_MIN_VALUE),
      achieved: cond.excellent,
    },
    perfect: {
      current: tensCount,
      target: gradeCount,
      min: MIN_GRADES,
      broken: tensCount !== gradeCount,
      achieved: cond.perfect,
    },
    attendanceStreak: { current: attStreak.current, target: ATTENDANCE_STREAK, achieved: cond.attendanceStreak },
    gradeStreak: { current: grStreak.current, target: GRADE_STREAK, achieved: cond.gradeStreak },
    champion: { position, total: rankedTotal, achieved: cond.champion },
    // current — shu oy ham top-3 da qolsa seriya qanchaga yetadi.
    podiumStreak: {
      current: podiumRun + (podiumNow ? 1 : 0),
      target: PODIUM_STREAK,
      podiumNow,
      achieved: cond.podiumStreak,
    },
    // done — avval olingan (bir martalik), UI progressda ko'rsatmaydi.
    goldCollection: {
      current: Math.min(goldCount, GOLD_COLLECTION),
      target: GOLD_COLLECTION,
      done: goldDone,
      achieved: cond.goldCollection,
    },
    bigJump: { prevPosition, position, jump, target: BIG_JUMP, achieved: cond.bigJump },
    titleDefender: {
      prevPosition,
      position,
      total: rankedTotal,
      min: TITLE_DEFENDER_MIN_RANKED,
      achieved: cond.titleDefender,
    },
    phoenix: {
      prevPosition,
      prevTotal: prevRankedTotal,
      position,
      min: PHOENIX_MIN_RANKED,
      wasBottomHalf,
      achieved: cond.phoenix,
    },
    punctual: {
      held,
      absent,
      late,
      min: PUNCTUAL_MIN_LESSONS,
      broken: absent > 0 || late > 0,
      achieved: cond.punctual,
    },
    grandSlam: {
      attendance: cond.perfectAttendance,
      grades: cond.excellent || cond.perfect,
      podium: podiumNow,
      done: [cond.perfectAttendance, cond.excellent || cond.perfect, podiumNow].filter(Boolean).length,
      target: 3,
      achieved: cond.grandSlam,
    },
    comeback: {
      prevAbsent,
      held,
      absent,
      min: COMEBACK_MIN_LESSONS,
      needPrev: COMEBACK_PREV_ABSENT,
      eligible: prevAbsent >= COMEBACK_PREV_ABSENT,
      broken: absent > 0,
      achieved: cond.comeback,
    },
    mostImproved: {
      delta,
      prevAverage: prevAverage === null ? null : round2(prevAverage),
      average: average === null ? null : round2(average),
      achieved: false, // guruh bilan solishtirish faqat oy yakunida
    },
  };

  return { earned, progress, delta };
};

// "Eng ko'p o'sgan" — guruhda eng katta musbat delta (tenglar hammasi oladi).
// `results` — { [studentId]: evaluateStudent natijasi }, joyida o'zgartiradi.
const applyMostImproved = (results) => {
  const deltas = Object.values(results)
    .map((r) => r.delta)
    .filter((d) => d !== null && d > 0);
  if (!deltas.length) return results;
  const best = Math.max(...deltas);
  for (const r of Object.values(results)) {
    if (r.delta !== best) continue;
    const { prevAverage, average } = r.progress.mostImproved;
    r.earned.mostImproved = { delta: r.delta, prevAverage, average };
  }
  return results;
};

// Olingan nishonlar ro'yxati → [{ type, count, months (desc) }] (BADGE_TYPES tartibida).
const summarizeEarned = (badges) =>
  BADGE_TYPES.map((type) => {
    const months = badges
      .filter((b) => b.type === type)
      .map((b) => b.month)
      .sort((a, b) => (a < b ? 1 : -1));
    return { type, count: months.length, months };
  }).filter((x) => x.count > 0);

// Markaz baholarni yashirgan bo'lsa baho nishonlarini chiqarib tashlaydi.
const filterHiddenGrades = (types, gradesHidden) =>
  gradesHidden ? types.filter((t) => !GRADE_BADGES.includes(t)) : types;

module.exports = {
  BADGE_TYPES,
  GRADE_BADGES,
  RANK_BADGES,
  BADGE_EMOJI,
  BADGE_FEATURE,
  MIN_LESSONS,
  MIN_GRADES,
  EXCELLENT_MIN_VALUE,
  ATTENDANCE_STREAK,
  GRADE_STREAK,
  PODIUM_STREAK,
  GOLD_COLLECTION,
  BIG_JUMP,
  TITLE_DEFENDER_MIN_RANKED,
  PHOENIX_MIN_RANKED,
  PUNCTUAL_MIN_LESSONS,
  COMEBACK_PREV_ABSENT,
  COMEBACK_MIN_LESSONS,
  currentMonth,
  prevMonthOf,
  runStreak,
  evaluateStudent,
  applyMostImproved,
  summarizeEarned,
  filterHiddenGrades,
};
