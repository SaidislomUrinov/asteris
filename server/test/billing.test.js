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

describe("computeBilling — a'zolik tugagach hisob to'xtaydi", () => {
  const P = 300000;
  const base = (extra) => ({ price: P, priceHistory: [{ price: P, from: 0 }], credits: [], payments: [], ...extra });

  test("guruhdan chiqqan o'quvchiga keyingi oylar yozilmaydi, oxirgi oy prorata", () => {
    const group = activeGroup(d("2026-05-10"));
    const r = computeBilling(base({ joinedAt: d("2026-05-10"), status: "left", leftAt: d("2026-07-15") }), group, "anchor");
    // may + iyun to'liq, 10.07–14.07 = 5 kun × 300000/31
    assert.equal(r.debt, 600000 + Math.round((300000 / 31) * 5));
    assert.deepEqual(r.debtBreakdown.map((x) => x.month), ["2026-05", "2026-06", "2026-07"]);
    assert.equal(r.nextDueDate, null);
  });

  test("arxivlangan a'zolik qarzi arxivlangan kunda muzlaydi", () => {
    const group = activeGroup(d("2026-05-10"));
    const r = computeBilling(
      base({ joinedAt: d("2026-05-10"), status: "archived", statusBeforeArchive: "active", archivedAt: d("2026-06-10") }),
      group,
      "anchor",
    );
    assert.equal(r.debt, 300000);
  });
});

describe("buildCycles — o'rtada qo'shilganda oy yorlig'i", () => {
  test("25-sanali guruhga 20-oktabrda qo'shilgan: qisqa sikl ham, to'liq sikl ham 'Oktabr'", () => {
    const group = activeGroup(d("2026-09-25"));
    const entry = { price: 300000, joinedAt: d("2026-10-20") };
    const cycles = buildCycles(entry, group, "anchor", d("2026-11-01"));
    assert.deepEqual(
      cycles.map((c) => [c.month, formatDay(c.cycleStart)]),
      [
        ["2026-10", "2026-09-25"],
        ["2026-10", "2026-10-25"],
      ],
    );
  });

  test("forMonth to'lovi bir oydagi ikkala siklni tartib bilan yopadi", () => {
    const group = finishedGroup(d("2026-09-25"), d("2026-11-01"));
    const credits = [];
    for (let t = d("2026-09-25"); t < d("2026-10-20"); t += 86400) credits.push({ date: formatDay(t) });
    const entry = {
      price: 300000,
      priceHistory: [{ price: 300000, from: 0 }],
      joinedAt: d("2026-10-20"),
      credits,
      payments: [{ status: "paid", amount: 350000, forMonth: "2026-10" }],
    };
    assert.equal(computeBilling(entry, group, "anchor").debt, 0);
  });
});

describe("salaryMonth.util — yopilgan oy orqaga o'zgarmaydi", () => {
  const { paymentSalaryDelta, rolloverSalaryDelta } = require("../src/utils/salaryMonth.util");
  const p = (extra) => ({ amount: 100, status: "paid", date: d("2026-10-03"), ...extra });

  test("o'tgan oy uchun kech to'lov — qabul qilingan oyga", () => {
    assert.equal(paymentSalaryDelta(p({ forMonth: "2026-09" }), "2026-09"), 0);
    assert.equal(paymentSalaryDelta(p({ forMonth: "2026-09" }), "2026-10"), 100);
  });

  test("oldindan to'lov — o'sha keyingi oyga", () => {
    assert.equal(paymentSalaryDelta(p({ forMonth: "2026-11" }), "2026-11"), 100);
    assert.equal(paymentSalaryDelta(p({ forMonth: "2026-11" }), "2026-10"), 0);
  });

  test("keyingi oyda bekor qilish — asl oy saqlanadi, bekor qilingan oyda ayiriladi", () => {
    const x = p({ forMonth: "2026-10", status: "cancelled", cancelledAt: d("2026-11-05") });
    assert.equal(paymentSalaryDelta(x, "2026-10"), 100);
    assert.equal(paymentSalaryDelta(x, "2026-11"), -100);
    const same = p({ forMonth: "2026-10", status: "cancelled", cancelledAt: d("2026-10-20") });
    assert.equal(paymentSalaryDelta(same, "2026-10"), 0);
  });

  test("oy ko'chirish yopilgan oyni o'zgartirmaydi", () => {
    const x = p({
      forMonth: "2026-12",
      forMonthHistory: [{ from: "2026-10", to: "2026-12", at: d("2026-11-10") }],
    });
    assert.equal(paymentSalaryDelta(x, "2026-10"), 100);
    assert.equal(paymentSalaryDelta(x, "2026-11"), -100);
    assert.equal(paymentSalaryDelta(x, "2026-12"), 100);
  });

  test("rollover: yaratilgan oydan oldinga surilmaydi, bekor qilish teskari yozadi", () => {
    const r = { amount: 50, fromMonth: "2026-09", toMonth: "2026-10", status: "active", createdAt: d("2026-10-02") };
    assert.equal(rolloverSalaryDelta(r, "2026-09"), 0); // yopilgan oy tegilmaydi
    assert.equal(rolloverSalaryDelta(r, "2026-10"), 0); // shu oyda −50 +50
    const ok = { ...r, fromMonth: "2026-10", toMonth: "2026-11", createdAt: d("2026-10-20") };
    assert.equal(rolloverSalaryDelta(ok, "2026-10"), -50);
    assert.equal(rolloverSalaryDelta(ok, "2026-11"), 50);
    const cancelled = { ...ok, status: "cancelled", cancelledAt: d("2026-12-01") };
    assert.equal(rolloverSalaryDelta(cancelled, "2026-10"), -50);
    assert.equal(rolloverSalaryDelta(cancelled, "2026-11"), 50);
    assert.equal(rolloverSalaryDelta(cancelled, "2026-12"), 0); // +50 −50
  });
});
