// Billing/qarz regressiya testlari — student.service.js `buildCycles` va
// `computeBilling`. Sof hisob: DB kerak emas (guruh `finished` holatda
// berilib, `effectiveNow = finishedAt` bilan vaqt muzlatiladi).
require("./helpers/env");
const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const studentService = require("../src/services/student.service");
const { dateStringToUnix, formatDay } = require("../src/utils/date.util");

const { buildCycles } = studentService._internal;
const { computeBilling } = studentService;

// Har kuni dars — dars kunlari soni = kalendar kunlari (hisob oson tekshiriladi).
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const d = dateStringToUnix;

const activeGroup = (activatedAt, days = ALL_DAYS) => ({ status: "active", activatedAt, days });
const finishedGroup = (activatedAt, finishedAt, days = ALL_DAYS) => ({
  status: "finished",
  activatedAt,
  finishedAt,
  days,
});

after(async () => {
  // student.service require qilinganda Redis ulanishi ochiladi — yopilmasa
  // `node --test` osilib qoladi.
  const redis = require("../src/configs/redis.config");
  await redis.quit().catch(() => redis.disconnect());
});

describe("buildCycles — joinedAt (kurs o'rtasida qo'shilgan o'quvchi)", () => {
  test("qo'shilishdan OLDIN tugagan sikllar ro'yxatga kirmaydi", () => {
    const group = activeGroup(d("2026-01-10"));
    const entry = { price: 300000, joinedAt: d("2026-03-20") };
    const cycles = buildCycles(entry, group, "anchor", d("2026-04-15"));
    assert.deepEqual(
      cycles.map((c) => c.month),
      ["2026-03", "2026-04"],
    );
    assert.equal(cycles.at(-1).isCurrent, true);
  });

  test("joinedAt bo'lmasa guruh faollashgandan beri barcha sikllar", () => {
    const group = activeGroup(d("2026-01-10"));
    const cycles = buildCycles({ price: 300000 }, group, "anchor", d("2026-04-15"));
    assert.deepEqual(
      cycles.map((c) => c.month),
      ["2026-01", "2026-02", "2026-03", "2026-04"],
    );
  });

  test("joinedAt aynan sikl oxiriga teng bo'lsa o'sha sikl ham chetlab o'tiladi", () => {
    const group = activeGroup(d("2026-01-10"));
    const cycles = buildCycles({ price: 300000, joinedAt: d("2026-02-10") }, group, "anchor", d("2026-02-15"));
    assert.deepEqual(
      cycles.map((c) => formatDay(c.cycleStart)),
      ["2026-02-10"],
    );
  });

  test("computeBilling: o'rtada qo'shilgan o'quvchi oldingi oylar uchun qarzdor bo'lmaydi", () => {
    const group = finishedGroup(d("2026-01-10"), d("2026-04-15"));
    const base = { price: 300000, payments: [] };
    const late = computeBilling({ ...base, joinedAt: d("2026-03-20") }, group, "anchor");
    // Faqat mart sikli (to'liq) + joriy aprel sikli (to'liq summa).
    assert.equal(late.debt, 600000);
    assert.deepEqual(
      late.debtBreakdown.map((r) => r.month),
      ["2026-03", "2026-04"],
    );
    // Taqqoslash: guruh boshidan bo'lgan o'quvchi — 4 sikl.
    const fromStart = computeBilling({ ...base, joinedAt: d("2026-01-01") }, group, "anchor");
    assert.equal(fromStart.debt, 1200000);
  });
});

describe("buildCycles — anchor rejimi (31-kun langari)", () => {
  test("31-kuni faollashgan guruh sikli 28-kunga siljib qolmaydi", () => {
    const group = activeGroup(d("2026-01-31"));
    const cycles = buildCycles({ price: 100000 }, group, "anchor", d("2026-06-15"));
    assert.deepEqual(
      cycles.map((c) => formatDay(c.cycleStart)),
      ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"],
    );
    // Sikllar uzluksiz: har sikl oxiri = keyingisining boshi.
    for (let i = 1; i < cycles.length; i++) assert.equal(cycles[i].cycleStart, cycles[i - 1].cycleEnd);
    assert.equal(formatDay(cycles.at(-1).cycleEnd), "2026-06-30");
  });

  test("har to'liq sikl narxi aynan oylik narx (kun soniga bog'liq emas)", () => {
    const group = activeGroup(d("2026-01-31"));
    const cycles = buildCycles({ price: 100000 }, group, "anchor", d("2026-06-15"));
    for (const c of cycles) assert.equal(c.fullDue, 100000);
  });
});

describe("buildCycles — calendarMonth rejimi", () => {
  test("birinchi sikl oy oxirigacha prorata, keyingilar 1-sanadan 1-sanagacha", () => {
    const group = activeGroup(d("2026-01-20"));
    const cycles = buildCycles({ price: 310000 }, group, "calendarMonth", d("2026-03-05"));
    assert.deepEqual(
      cycles.map((c) => [formatDay(c.cycleStart), formatDay(c.cycleEnd)]),
      [
        ["2026-01-20", "2026-02-01"],
        ["2026-02-01", "2026-03-01"],
        ["2026-03-01", "2026-04-01"],
      ],
    );
    // Yanvar: 12/31 kun → round(310000 * 12 / 31) = 120000.
    assert.equal(cycles[0].fullDue, 120000);
    assert.equal(cycles[1].fullDue, 310000);
    assert.equal(cycles[2].fullDue, 310000);
    // Joriy (mart) sikl: 1–4 mart o'tgan = 4 kun × 10000.
    assert.equal(cycles[2].isCurrent, true);
    assert.equal(cycles[2].elapsedDue, 40000);
  });

  test("calendarMonth + joinedAt: qo'shilishdan oldingi oy sikli chiqmaydi", () => {
    const group = activeGroup(d("2026-01-20"));
    const cycles = buildCycles(
      { price: 310000, joinedAt: d("2026-02-10") },
      group,
      "calendarMonth",
      d("2026-03-05"),
    );
    assert.deepEqual(
      cycles.map((c) => c.month),
      ["2026-02", "2026-03"],
    );
  });
});

describe("computeBilling — to'lovlar", () => {
  // Bitta sikl: 10-yanvardan, 20-yanvarda yakunlangan (joriy sikl hali tugamagan).
  const group = finishedGroup(d("2026-01-10"), d("2026-01-20"));

  test("qisman to'lov → qoldiq qarz", () => {
    const r = computeBilling(
      { price: 300000, joinedAt: 0, payments: [{ amount: 120000, status: "paid" }] },
      group,
      "anchor",
    );
    assert.equal(r.paidAmount, 120000);
    assert.equal(r.currentCyclePrice, 300000);
    assert.equal(r.paidForCurrentCycle, 120000);
    assert.equal(r.debt, 180000);
    assert.deepEqual(
      r.debtBreakdown.map(({ month, due, paid, debt }) => ({ month, due, paid, debt })),
      [{ month: "2026-01", due: 300000, paid: 120000, debt: 180000 }],
    );
  });

  test("cancelled/refunded to'lovlar qarzni kamaytirmaydi", () => {
    const r = computeBilling(
      {
        price: 300000,
        joinedAt: 0,
        payments: [
          { amount: 300000, status: "cancelled" },
          { amount: 300000, status: "refunded" },
          { amount: 100000, status: "paid" },
        ],
      },
      group,
      "anchor",
    );
    assert.equal(r.paidAmount, 100000);
    assert.equal(r.debt, 200000);
  });

  test("to'lovlar FIFO: eng eski sikl birinchi yopiladi", () => {
    const twoCycles = finishedGroup(d("2026-01-10"), d("2026-02-20"));
    const r = computeBilling(
      { price: 300000, joinedAt: 0, payments: [{ amount: 400000, status: "paid" }] },
      twoCycles,
      "anchor",
    );
    assert.equal(r.debt, 200000);
    assert.deepEqual(
      r.debtBreakdown.map(({ month, debt }) => ({ month, debt })),
      [{ month: "2026-02", debt: 200000 }],
    );
    assert.equal(r.paidForCurrentCycle, 100000);
  });

  test("ortiqcha to'lov manfiy qarz bermaydi", () => {
    const r = computeBilling(
      { price: 300000, joinedAt: 0, payments: [{ amount: 500000, status: "paid" }] },
      group,
      "anchor",
    );
    assert.equal(r.debt, 0);
    assert.deepEqual(r.debtBreakdown, []);
  });

  test("ko'chirishdan oldingi (opening) qarz sikldan oldin yopiladi", () => {
    const r = computeBilling(
      {
        price: 300000,
        joinedAt: 0,
        openingDebts: [{ month: "2025-12", amount: 50000 }],
        payments: [{ amount: 50000, status: "paid" }],
      },
      group,
      "anchor",
    );
    assert.equal(r.openingDebtTotal, 50000);
    assert.equal(r.openingDebtRemaining, 0);
    assert.equal(r.debt, 300000);
  });

  test("pending guruhda sikl qarzi yo'q", () => {
    const r = computeBilling({ price: 300000, payments: [] }, { status: "pending" }, "anchor");
    assert.equal(r.debt, 0);
    assert.equal(r.currentCycleMonth, null);
  });

  test("boshqa guruhga o'tkazilgan a'zolik qarzi 0 (ikki marta hisoblanmaydi)", () => {
    const r = computeBilling(
      { price: 300000, joinedAt: 0, payments: [], transferredTo: { group: "x", entry: "y", at: 1 } },
      group,
      "anchor",
    );
    assert.equal(r.debt, 0);
  });
});
