// src/utils/ dagi sof funksiyalar. DB/Redis kerak emas (ba'zi util'lar
// model'larni require qiladi, lekin ulanish ochmaydi).
require("./helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const date = require("../src/utils/date.util");
const { listLessonDates, countLessonDays } = require("../src/utils/lessonDays.util");
const rollover = require("../src/utils/rollover.util");
const grade = require("../src/utils/gradeScore.util");
const pricing = require("../src/utils/subscriptionPricing.util");
const phone = require("../src/utils/phone.util");
const tg = require("../src/utils/telegramPhone.util");
const { sourceWindowsOf, transferredAttendance, transferredGrades } = require("../src/utils/transferOverlay.util");

const d = date.dateStringToUnix;

describe("date.util", () => {
  test("getNow() — butun son, unix SONIYA (ms emas)", () => {
    const now = date.getNow();
    assert.equal(typeof now, "number");
    assert.ok(Number.isInteger(now));
    // ms qaytarsa ~1000 marta katta bo'lardi (prod'dagi "soniya" bugi).
    assert.ok(Math.abs(now - Math.floor(Date.now() / 1000)) <= 2, `getNow=${now}`);
  });

  test("dateStringToUnix — Asia/Tashkent 00:00 (UTC+5)", () => {
    assert.equal(d("2026-01-01"), Date.UTC(2025, 11, 31, 19, 0, 0) / 1000);
    assert.equal(date.formatDay(d("2026-03-15")), "2026-03-15");
    assert.equal(date.formatMonth(d("2026-03-15")), "2026-03");
  });

  test("addMonths — oy oxiri qisqa oyga qisqaradi", () => {
    assert.equal(date.formatDay(date.addMonths(d("2026-01-31"), 1)), "2026-02-28");
    assert.equal(date.formatDay(date.addMonths(d("2026-01-31"), 2)), "2026-03-31");
    assert.equal(date.formatDay(date.addDays(d("2026-02-28"), 1)), "2026-03-01");
  });

  test("monthsBetween — kun-oyni hisobga oladi, calendarMonthsBetween — yo'q", () => {
    assert.equal(date.monthsBetween(d("2026-07-14"), d("2026-08-13")), 0);
    assert.equal(date.monthsBetween(d("2026-07-14"), d("2026-08-14")), 1);
    assert.equal(date.monthsBetween(d("2026-08-14"), d("2026-07-14")), 0); // manfiy emas
    assert.equal(date.calendarMonthsBetween(d("2026-07-31"), d("2026-08-01")), 1);
    assert.equal(date.calendarMonthsBetween(d("2025-11-15"), d("2026-02-01")), 3);
  });

  test("startOfMonth / daysInMonth / dayOfMonth", () => {
    assert.equal(date.formatDay(date.startOfMonth(d("2026-03-17"))), "2026-03-01");
    assert.equal(date.daysInMonth(d("2028-02-10")), 29);
    assert.equal(date.daysInMonth(d("2026-02-10")), 28);
    assert.equal(date.dayOfMonth(d("2026-03-17")), 17);
  });
});

describe("lessonDays.util", () => {
  // 2026-03-02 — dushanba.
  test("[from, to) oralig'idagi dars sanalari, `to` kirmaydi", () => {
    assert.deepEqual(listLessonDates(["mon", "wed"], d("2026-03-02"), d("2026-03-09")), [
      "2026-03-02",
      "2026-03-04",
    ]);
    assert.equal(countLessonDays(["mon", "wed"], d("2026-03-02"), d("2026-03-10")), 3);
  });

  test("excludeDates (massiv yoki Set) chetlab o'tiladi", () => {
    assert.deepEqual(listLessonDates(["mon", "wed"], d("2026-03-02"), d("2026-03-09"), ["2026-03-04"]), [
      "2026-03-02",
    ]);
    assert.equal(countLessonDays(["mon", "wed"], d("2026-03-02"), d("2026-03-09"), new Set(["2026-03-02"])), 1);
  });

  test("bo'sh kunlar yoki teskari oraliq → []", () => {
    assert.deepEqual(listLessonDates([], d("2026-03-02"), d("2026-03-09")), []);
    assert.deepEqual(listLessonDates(["mon"], d("2026-03-09"), d("2026-03-02")), []);
  });
});

describe("rollover.util", () => {
  const absent = (s) => s === "absent";

  test("ketma-ket 3 ta kelmaslik → bitta yangi blok (4-chisi yangi blok boshlaydi)", () => {
    const history = [
      { date: "2026-03-01", status: "absent" },
      { date: "2026-03-03", status: "absent" },
      { date: "2026-03-05", status: "absent" },
      { date: "2026-03-07", status: "absent" },
    ];
    const { cancel, create } = rollover.planRollovers(history, [], absent);
    assert.deepEqual(cancel, []);
    assert.deepEqual(create, [["2026-03-01", "2026-03-03", "2026-03-05"]]);
  });

  test("kelgan kun ketma-ketlikni uzadi", () => {
    const history = [
      { date: "2026-03-01", status: "absent" },
      { date: "2026-03-02", status: "absent" },
      { date: "2026-03-03", status: "present" },
      { date: "2026-03-04", status: "absent" },
    ];
    assert.deepEqual(rollover.planRollovers(history, [], absent).create, []);
  });

  test("davomat tuzatilsa mavjud rollover bekor qilinadi; amal qilayotgani qayta yaratilmaydi", () => {
    const history = [
      { date: "2026-03-01", status: "absent" },
      { date: "2026-03-02", status: "present" }, // tuzatilgan
      { date: "2026-03-03", status: "absent" },
      { date: "2026-03-10", status: "absent" },
      { date: "2026-03-11", status: "absent" },
      { date: "2026-03-12", status: "absent" },
    ];
    const rollovers = [
      { _id: "r1", status: "active", dates: ["2026-03-01", "2026-03-02", "2026-03-03"] },
      { _id: "r2", status: "active", dates: ["2026-03-10", "2026-03-11", "2026-03-12"] },
      { _id: "r3", status: "cancelled", dates: ["2026-02-01"] },
    ];
    const { cancel, create } = rollover.planRollovers(history, rollovers, absent);
    assert.deepEqual(cancel, ["r1"]);
    assert.deepEqual(create, []);
  });

  test("cycleRolloverDiscount — faqat sikl ichidagi faol yozuvlar", () => {
    const entry = {
      rollovers: [
        { status: "active", applyAt: 100, amount: 30000 },
        { status: "active", applyAt: 200, amount: 5000 }, // sikl oxiri — kirmaydi
        { status: "cancelled", applyAt: 150, amount: 99999 },
      ],
    };
    assert.equal(rollover.cycleRolloverDiscount(entry, 100, 200), 30000);
    assert.equal(rollover.cycleRolloverDiscount({}, 0, 1000), 0);
  });

  test("monthRolloverAdjustment — fromMonth'dan ayiriladi, toMonth'ga qo'shiladi", () => {
    const students = [
      {
        groups: [
          {
            group: "g1",
            rollovers: [
              { status: "active", amount: 30000, fromMonth: "2026-03", toMonth: "2026-04" },
              { status: "cancelled", amount: 1000, fromMonth: "2026-03", toMonth: "2026-04" },
            ],
          },
          { group: "g2", rollovers: [{ status: "active", amount: 7000, fromMonth: "2026-03", toMonth: "2026-04" }] },
        ],
      },
    ];
    assert.equal(rollover.monthRolloverAdjustment(students, null, "2026-03"), -37000);
    assert.equal(rollover.monthRolloverAdjustment(students, null, "2026-04"), 37000);
    assert.equal(rollover.monthRolloverAdjustment(students, new Set(["g1"]), "2026-04"), 30000);
  });
});

describe("gradeScore.util", () => {
  test("Bayes o'rtachasi: (sum + 5·5.5) / (count + 5), 2 xona", () => {
    assert.equal(grade.gradeScore(0, 0), 5.5);
    assert.equal(grade.gradeScore(20, 2), 6.79); // 47.5 / 7
    assert.equal(grade.gradeScore(237.5, 25), 8.83); // 265 / 30
    // Kam baholi "10"lar ko'p baholi 9.5 dan yuqori chiqmaydi.
    assert.ok(grade.gradeScore(20, 2) < grade.gradeScore(237.5, 25));
  });

  test("rankInSummary — dense rank, teng ball → davomat, bahosizlar reytingda emas", () => {
    const summary = {
      a: { gradeScore: 8, attendanceRate: 90 },
      b: { gradeScore: 8, attendanceRate: 90 },
      c: { gradeScore: 8, attendanceRate: 70 },
      d: { gradeScore: 9, attendanceRate: 10 },
      e: { gradeScore: null, attendanceRate: 100 },
    };
    assert.deepEqual(grade.rankInSummary(summary, "d"), { total: 5, ranked: 4, position: 1 });
    assert.equal(grade.rankInSummary(summary, "a").position, 2);
    assert.equal(grade.rankInSummary(summary, "b").position, 2);
    assert.equal(grade.rankInSummary(summary, "c").position, 3);
    assert.equal(grade.rankInSummary(summary, "e").position, null);
    assert.deepEqual(grade.positionsInSummary(summary), { a: 2, b: 2, c: 3, d: 1 });
  });

  test("MONTH_RE / monthDateRange", () => {
    assert.ok(grade.MONTH_RE.test("2026-09"));
    assert.ok(!grade.MONTH_RE.test("2026-13"));
    assert.ok(!grade.MONTH_RE.test("2026-9"));
    assert.deepEqual(grade.monthDateRange("2026-02"), { $gte: "2026-02-01", $lte: "2026-02-31" });
  });
});

describe("subscriptionPricing.util", () => {
  const table = pricing.DEFAULT_DURATION_DISCOUNTS;

  test("muddat chegirmalari (default jadval)", () => {
    assert.equal(pricing.calcAmount(100000, 1, table), 100000);
    assert.equal(pricing.calcAmount(100000, 3, table), 285000);
    assert.equal(pricing.calcAmount(100000, 6, table), 558000);
    assert.equal(pricing.calcAmount(100000, 9, table), 810000);
    assert.equal(pricing.calcAmount(100000, 12, table), 1056000);
  });

  test("jadvalda yo'q muddat → null", () => {
    for (const m of [0, 2, 24, -1]) assert.equal(pricing.calcAmount(100000, m, table), null);
  });

  test("discountsOf — sozlama bo'lmasa default, bo'lsa saralangan jadval", () => {
    assert.deepEqual(pricing.discountsOf(null), table);
    assert.deepEqual(pricing.discountsOf({ subscription: { durationDiscounts: [] } }), table);
    assert.deepEqual(
      pricing.discountsOf({ subscription: { durationDiscounts: [{ months: 6, percent: 20 }, { months: 1 }] } }),
      [{ months: 1, percent: 0 }, { months: 6, percent: 20 }],
    );
  });

  test("normalizeDiscounts — validatsiya", () => {
    assert.deepEqual(
      pricing.normalizeDiscounts([{ months: 3, percent: 5.04 }, { months: 1, percent: 0 }]),
      [{ months: 1, percent: 0 }, { months: 3, percent: 5 }],
    );
    assert.throws(() => pricing.normalizeDiscounts([]), /tariff\.discountsEmpty/);
    assert.throws(() => pricing.normalizeDiscounts([{ months: 0, percent: 5 }]), /tariff\.discountsInvalid/);
    assert.throws(() => pricing.normalizeDiscounts([{ months: 1, percent: 95 }]), /tariff\.discountsInvalid/);
    assert.throws(
      () => pricing.normalizeDiscounts([{ months: 1, percent: 0 }, { months: 1, percent: 5 }]),
      /tariff\.discountsDuplicate/,
    );
  });
});

describe("phone.util", () => {
  test("normalizePhone — O'zbekiston formatlari", () => {
    for (const raw of ["998901234567", "90 123 45 67", "+998 (90) 123-45-67", "8 90 123 45 67", " +998901234567 "]) {
      assert.equal(phone.normalizePhone(raw), "+998901234567", raw);
    }
  });

  test("normalizePhone — tanib bo'lmasa trim qilingan holda qaytadi", () => {
    assert.equal(phone.normalizePhone(null), "");
    assert.equal(phone.normalizePhone("   "), "");
    assert.equal(phone.normalizePhone("  abc  "), "abc");
    assert.equal(phone.normalizePhone("+7 999 123 45 67"), "+7 999 123 45 67");
  });

  test("normalizeTelegramPhone — xorijiy E.164, noto'g'ri → null", () => {
    assert.equal(phone.normalizeTelegramPhone("90 123 45 67"), "+998901234567");
    assert.equal(phone.normalizeTelegramPhone("+7 999 123 45 67"), "+79991234567");
    assert.equal(phone.normalizeTelegramPhone("12345"), null);
    assert.equal(phone.normalizeTelegramPhone("abc"), null);
    assert.equal(phone.normalizeTelegramPhone(""), "");
    assert.equal(phone.setTelegramPhone(" abc "), "abc");
    assert.equal(phone.setTelegramPhone("998901234567"), "+998901234567");
  });
});

describe("telegramPhone.util", () => {
  test("applyTelegramFields — yangi hujjat: default `*Same: true`, telefondan hisoblanadi", () => {
    const doc = { phone: "+998901234567", parentPhone: "+998911112233" };
    tg.applyTelegramFields(doc, {}, { isNew: true });
    assert.equal(doc.telegramSame, true);
    assert.equal(doc.telegramPhone, "+998901234567");
    assert.equal(doc.parentTelegramSame, true);
    assert.equal(doc.parentTelegramPhone, "+998911112233");
  });

  test("applyTelegramFields — `false` + alohida raqam normalizatsiya qilinadi", () => {
    const doc = { phone: "+998901234567", parentPhone: "" };
    tg.applyTelegramFields(doc, { telegramSame: "false", telegramPhone: "+7 999 123 45 67" }, { isNew: true });
    assert.equal(doc.telegramSame, false);
    assert.equal(doc.telegramPhone, "+79991234567");
  });

  test("applyTelegramFields — noto'g'ri raqam INVALID_TELEGRAM_PHONE", () => {
    assert.throws(
      () => tg.applyTelegramFields({ phone: "+998901234567" }, { telegramSame: false, telegramPhone: "12" }, { isNew: true }),
      (err) => err.message === "student.invalidTelegramPhone" && err.code === "INVALID_TELEGRAM_PHONE",
    );
  });

  test("applyTelegramFields — update'da yuborilmagan maydon saqlanadi", () => {
    const doc = {
      phone: "+998901234567",
      telegramSame: false,
      telegramPhone: "+79991234567",
      parentPhone: "",
      parentTelegramSame: true,
      parentTelegramPhone: "",
    };
    tg.applyTelegramFields(doc, {});
    assert.equal(doc.telegramSame, false);
    assert.equal(doc.telegramPhone, "+79991234567");
  });

  test("telegramFieldsOf — eski hujjat (maydon yo'q) → telefondan", () => {
    assert.deepEqual(tg.telegramFieldsOf({ phone: "901234567", parentPhone: "" }), {
      telegramSame: true,
      telegramPhone: "+998901234567",
      parentTelegramSame: true,
      parentTelegramPhone: "",
    });
  });

  test("telegramFieldsFromImportRow — bo'sh / teng / farqli", () => {
    assert.deepEqual(tg.telegramFieldsFromImportRow({ phone: "901234567" }), {
      telegramSame: true,
      parentTelegramSame: true,
    });
    assert.deepEqual(tg.telegramFieldsFromImportRow({ phone: "901234567" }, { isNew: false }), {});
    assert.deepEqual(
      tg.telegramFieldsFromImportRow({ phone: "901234567", telegramPhone: "+998 90 123 45 67" }).telegramSame,
      true,
    );
    assert.deepEqual(tg.telegramFieldsFromImportRow({ phone: "901234567", telegramPhone: "+7 999 1234567" }), {
      telegramSame: false,
      telegramPhone: "+7 999 1234567",
      parentTelegramSame: true,
    });
  });

  test("hasTelegramFields / pickTelegramFields", () => {
    assert.equal(tg.hasTelegramFields({ fullName: "x" }), false);
    assert.equal(tg.hasTelegramFields({ parentTelegramSame: false }), true);
    assert.deepEqual(tg.pickTelegramFields({ fullName: "x", telegramSame: true, telegramPhone: "1" }), {
      telegramSame: true,
      telegramPhone: "1",
    });
  });
});

describe("transferOverlay.util", () => {
  test("sourceWindowsOf — faqat shu guruh a'zoligidagi transferredFrom oynalari", () => {
    const students = [
      {
        _id: "s1",
        groups: [
          { group: "new", transferredFrom: [{ group: "old", from: d("2026-01-10"), until: d("2026-02-05") }] },
          { group: "other", transferredFrom: [{ group: "x", from: 0, until: d("2026-01-01") }] },
        ],
      },
      { _id: "s2", groups: [{ group: "new" }] },
    ];
    const map = sourceWindowsOf(students, "new");
    assert.equal(map.size, 1);
    assert.deepEqual(map.get("s1"), [{ group: "old", from: "2026-01-10", until: "2026-02-05" }]);
  });

  test("bo'sh oynalar xaritasi — DB'ga bormasdan bo'sh Map", async () => {
    assert.equal((await transferredAttendance(new Map())).size, 0);
    assert.equal((await transferredGrades(new Map())).size, 0);
  });
});
