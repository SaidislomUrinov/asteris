const { Types } = require("mongoose");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Client = require("../models/Client");
const Group = require("../models/Group");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const BillingSetting = require("../models/BillingSetting");
const ImportBatch = require("../models/ImportBatch");
const Attendance = require("../models/Attendance");
const { generateUniqueShortCode } = require("../utils/shortCode.util");
const parentNotification = require("./parentNotification.service");
const {
  getNow,
  monthsBetween,
  formatMonth,
  addMonths,
  dateStringToUnix,
  addDays,
  startOfMonth,
  daysInMonth,
  dayOfMonth,
  calendarMonthsBetween,
} = require("../utils/date.util");
const { countLessonDays, listLessonDates } = require("../utils/lessonDays.util");
const billingSettingService = require("./billingSetting.service");
const { cycleRolloverDiscount } = require("../utils/rollover.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { emitArchiveChanged } = require("../utils/archive.util");
const { attachTelegramStatus, emitParentTelegramChanged } = require("../utils/parentTelegram.util");
const {
  applyTelegramFields,
  telegramFieldsOf,
  hasTelegramFields,
  pickTelegramFields,
  telegramFieldsFromImportRow,
} = require("../utils/telegramPhone.util");
const groupHolidayService = require("./groupHoliday.service");

const PAGE_SIZE = 50;

// O'quvchining samarali Telegram raqami(lar)i o'zgargan bo'lsa — ESKI va YANGI
// raqamlar bo'yicha `student:telegram` badge holati qayta hisoblanadi
// (API_CONTRACT_telegram_phone.md §3). `before` null (yangi hujjat) → hech narsa.
const emitTelegramDiff = (before, after) => {
  if (!before || !after) return;
  const phones = [];
  for (const k of ["telegramPhone", "parentTelegramPhone"]) {
    if ((before[k] || "") !== (after[k] || "")) phones.push(before[k], after[k]);
  }
  const list = phones.filter(Boolean);
  if (list.length) void emitParentTelegramChanged(list);
};
// Guruh detali uchun (butun guruh bir so'rovda) — xavfsizlik chegarasi.
const GROUP_PAGE_SIZE_MAX = 1000;

// Client'ning faol obunasidan `studentLimit`ni aniqlaydi — center.service.js
// dagi `getCenterLimit` bilan bir xil naqsh.
const getStudentLimit = async (clientId) => {
  const client = await Client.findOne({ _id: clientId, isDeleted: false }).populate({
    path: "subscription",
    populate: { path: "tariff" },
  });
  if (!client || !client.subscription) throw new Error("client.noActiveSubscription");

  const sub = client.subscription;
  const tariffDoc = sub.tariff?._id ? sub.tariff : null;
  return tariffDoc ? tariffDoc.studentLimit : sub.tariffSnapshot?.studentLimit;
};

// Guruh+narx+sikl rejimidan kelib chiqib "hozir qaysi sikldamiz" (boshlanish/
// tugash sanasi, shu siklning narxi, undan oldingi sikllar jami qarzi)ni
// hisoblaydi — computeBilling VA yangi o'quvchi proration'i (create())
// ikkalasi ham shu yerga tayanadi, ikki joyda mantiq takrorlanmasligi uchun.
// `priceHistory`dan berilgan sikl BOSHLANGAN paytda amalda bo'lgan narxni
// tanlaydi (shu sanadan oldingi/teng eng so'nggi yozuv). Tarix bo'sh bo'lsa
// yoki hali hech qanday yozuv shu sanadan oldin bo'lmasa — joriy `price`ga
// tushib qoladi (eski, tarixsiz yozuvlar bilan orqaga moslik uchun).
const priceAt = (priceHistory, unix, fallbackPrice) => {
  if (!priceHistory || priceHistory.length === 0) return fallbackPrice;
  let result = null;
  for (const entry of priceHistory) {
    if (entry.from <= unix && (result === null || entry.from >= result.from)) result = entry;
  }
  return result ? result.price : fallbackPrice;
};

// Guruh faollashtirilgan kundan HOZIRGI siklgacha (jumladan) — anchor
// ("sanadan-sanaga") yoki calendarMonth ("oy boshidan oy boshiga")
// rejimiga mos — barcha sikllar ro'yxatini tuzadi. Har bir sikl o'z narxiga
// (priceHistory'ga mos, narx tarixi bo'yicha o'sha payt amalda bo'lgan
// narx) va shu sikldagi bayram/davomat kreditlariga ega. computeBilling
// (umumiy raqamlar) VA getDebtBreakdown (oy-oy qarzdorlik ro'yxati)
// ikkalasi ham shu YAGONA ro'yxatga tayanadi — ikki xil formula ikki xil
// natija bermasligi uchun.
const MAX_CYCLES = 1200; // ~100 yil — cheksiz sikl hosil bo'lmasligi uchun xavfsizlik chegarasi
const buildCycles = (entry, group, cycleMode, effectiveNow) => {
  const price = entry.price || 0;
  const priceHistory = entry.priceHistory || [];
  const credits = entry.credits || [];
  const cycles = [];

  // O'quvchi guruhga QO'SHILGUNGA QADAR TUGAGAN sikllar unga umuman
  // tegishli emas — u o'sha oylarda bu guruhda o'qimagan. Avval sikllar
  // faqat `group.activatedAt` dan qurilgani uchun kurs o'rtasida qo'shilgan
  // (yoki eski bazadan ko'chirilgan) o'quvchi darhol o'zi qatnashmagan
  // oylar uchun qarzdor bo'lib chiqardi.
  //
  // Sikl CHEGARALARI o'zgarmaydi (ular hamon `activatedAt` ga langarlangan —
  // pastdagi izohga qara), faqat allaqachon tugab bo'lgan sikllar
  // ro'yxatga QO'SHILMAYDI. O'quvchi qo'shilgan SIKLNING o'zi qoladi va
  // undagi prorata mavjud `credits` mexanizmi orqali ishlaydi (`create`
  // qo'shilish paytida o'tkazib yuborilgan har bir dars kuni uchun kredit
  // yozadi) — shuning uchun bu yerda ikki marta hisoblash yuz bermaydi.
  const joinedAt = entry.joinedAt || 0;

  const addCycle = (cycleStart, cycleEnd, cyclePrice) => {
    // Sikl o'quvchi qo'shilishidan OLDIN tugagan → o'tkazib yuboriladi.
    // `false` qaytariladi: bu "joriy sikl emas" degani, ya'ni tashqi
    // sikl davom etadi va keyingi sikllarga o'tadi.
    if (cycleEnd <= joinedAt) return false;

    const nominalDays = countLessonDays(group.days, cycleStart, cycleEnd);
    const dailyRate = nominalDays > 0 ? cyclePrice / nominalDays : 0;
    const creditCount = credits.filter((c) => {
      const u = dateStringToUnix(c.date);
      return u >= cycleStart && u < cycleEnd;
    }).length;
    const isCurrent = effectiveNow < cycleEnd;
    const elapsedDaysNominal = isCurrent
      ? countLessonDays(group.days, cycleStart, Math.min(effectiveNow, cycleEnd))
      : nominalDays;
    const elapsedChargeable = Math.max(0, elapsedDaysNominal - creditCount);
    const fullChargeable = Math.max(0, nominalDays - creditCount);
    // Oldingi sikldan "3 kun ketma-ket kelmadi" bilan o'tkazilgan summa —
    // shu siklda chegirma (utils/rollover.util.js).
    const rolloverDiscount = cycleRolloverDiscount(entry, cycleStart, cycleEnd);
    cycles.push({
      month: formatMonth(cycleStart),
      cycleStart,
      cycleEnd,
      fullDue: Math.max(0, Math.round(dailyRate * fullChargeable) - rolloverDiscount), // shu sikl uchun JAMI to'lanishi kerak summa
      elapsedDue: Math.max(0, Math.round(dailyRate * elapsedChargeable) - rolloverDiscount), // shu paytgacha HAQIQATDA to'lash SHART bo'lgan qism
      isCurrent,
      dailyRate,
      rolloverDiscount,
    });
    return isCurrent;
  };

  if (cycleMode === "calendarMonth") {
    const daysInActMonth = daysInMonth(group.activatedAt);
    const firstCycleDays = daysInActMonth - dayOfMonth(group.activatedAt) + 1;
    const firstCyclePriceBase = priceAt(priceHistory, group.activatedAt, price);
    const firstCyclePrice = Math.round((firstCyclePriceBase * firstCycleDays) / daysInActMonth);
    const firstCycleEnd = addMonths(startOfMonth(group.activatedAt), 1);
    if (addCycle(group.activatedAt, firstCycleEnd, firstCyclePrice)) return cycles;

    let cursor = firstCycleEnd;
    for (let i = 0; i < MAX_CYCLES; i++) {
      const cycleEnd = addMonths(cursor, 1);
      if (addCycle(cursor, cycleEnd, priceAt(priceHistory, cursor, price))) break;
      cursor = cycleEnd;
    }
    return cycles;
  }

  // Har bir sikl chegarasi ASL `activatedAt` dan hisoblanadi (oldingi
  // siklning oxiridan emas). Sabab: qisqa oy langarni qisqartiradi
  // (31-yanvar → 28-fevral), va agar keyingi sikl o'sha qisqargan sanadan
  // olinsa, langar 28-kunda MANGU qolib ketardi (31 → 28 → 28 → 28...).
  // Asl sanadan hisoblanganda esa langar o'zini tiklaydi: 31 → 28 → 31.
  // Bu `currentCycleStartOf` bilan ham mos keladi — u allaqachon
  // `addMonths(activatedAt, n)` naqshini ishlatadi, ikkalasi bir xil
  // sikl chegarasini bermasa yangi o'quvchi proratasi noto'g'ri chiqardi.
  for (let i = 0; i < MAX_CYCLES; i++) {
    const cycleStart = addMonths(group.activatedAt, i);
    const cycleEnd = addMonths(group.activatedAt, i + 1);
    if (addCycle(cycleStart, cycleEnd, priceAt(priceHistory, cycleStart, price))) break;
  }
  return cycles;
};

// Guruh+sikl rejimidan kelib chiqib hozir qaysi sikl davom etayotganini
// (boshlanish sanasini) topadi — faqat student.service.js "create"dagi
// mid-sikl proration uchun kerak (to'liq sikl ro'yxati emas, bitta sana).
const currentCycleStartOf = (group, cycleMode, effectiveNow) => {
  if (cycleMode === "calendarMonth") {
    const calMonthsElapsed = calendarMonthsBetween(startOfMonth(group.activatedAt), effectiveNow);
    return calMonthsElapsed === 0
      ? group.activatedAt
      : addMonths(startOfMonth(group.activatedAt), calMonthsElapsed);
  }
  const monthsElapsed = monthsBetween(group.activatedAt, effectiveNow);
  return addMonths(group.activatedAt, monthsElapsed);
};

// Sikl o'rtasida guruhga qo'shilish — shu sikldan hozirgacha o'tgan HAR BIR
// dars kuni uchun bitta kredit (computeBilling joriy sikl to'lovidan shu
// kunlarni ayiradi). `create` va `transferGroup` ikkalasi ishlatadi.
const joinCreditsOf = async (group, cycleMode) => {
  if (group.status !== "active" || !group.activatedAt) return [];
  const now = getNow();
  const holidayDates = await groupHolidayService.getNonChargeableDates(group._id);
  const currentCycleStart = currentCycleStartOf(group, cycleMode, now);
  return listLessonDates(group.days, currentCycleStart, now, holidayDates).map((date) => ({ date }));
};

// Ko'chirishdan oldingi qarz (API_CONTRACT_opening_debts.md §1) — chegaralar.
const OPENING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const OPENING_MAX_ITEMS = 36;
const OPENING_MAX_AMOUNT = 1_000_000_000;
const OPENING_MIN_MONTH = "2000-01";

// Opening qarzlar tartibi: oyi noma'lum (null) BIRINCHI (eng eski deb
// qaraladi), keyin oy bo'yicha o'sish tartibida.
const compareOpeningMonth = (a, b) => {
  if (a.month === b.month) return 0;
  if (a.month === null) return -1;
  if (b.month === null) return 1;
  return a.month < b.month ? -1 : 1;
};

// A'zolikning ko'chirishdan oldingi qarz/avansini YAGONA normallashtirilgan
// ko'rinishga keltiradi — computeBilling, groupEntryDTO, PUT .../opening va
// addPayment forMonth tekshiruvi SHU yordamchini ishlatadi. Eski data
// migratsiyasiz ishlaydi: manfiy `openingBalance` (eski import) →
// `{ _id: null, month: null, amount: -openingBalance }` qarz qatori;
// avans = max(0, openingBalance).
const openingItemsOf = (entry) => {
  const raw = Number(entry?.openingBalance) || 0;
  const items = (entry?.openingDebts || []).map((d) => ({
    _id: d._id || null,
    month: d.month || null,
    amount: Number(d.amount) || 0,
    note: d.note || "",
  }));
  if (raw < 0) items.push({ _id: null, month: null, amount: -raw, note: "" });
  items.sort(compareOpeningMonth);
  return { items, advance: Math.max(0, raw) };
};

// "Qaysi oy uchun" (`forMonth`) qoidasi — addPayment VA moveMonth (to'lovni
// boshqa oyga o'tkazish) SHU yagona yordamchini ishlatadi
// (API_CONTRACT_payment_move_month.md, API_CONTRACT_opening_debts.md §3.3).
// Sof funksiya: ruxsat, agar oy shu a'zolikning opening qarz oylaridan biri
// YOKI `>= courseStartMonth` (guruh faollashgan oy) bo'lsa. Guruh
// faollashmagan (`courseStartMonth` null) bo'lsa faqat opening oylari.
// Bo'sh qiymat bu yerda tekshirilmaydi (addPayment'da ixtiyoriy, moveMonth
// o'zi majburiy qiladi). Kelajak oy cheklanmaydi.
const checkPayableMonth = (forMonth, openingMonths = [], courseStartMonth = null) => {
  if (typeof forMonth !== "string" || !OPENING_MONTH_RE.test(forMonth)) {
    throw new Error("student.openingMonthInvalid");
  }
  if (openingMonths.includes(forMonth)) return;
  if (!courseStartMonth || forMonth < courseStartMonth) throw new Error("student.forMonthBeforeStart");
};

// Yuqoridagi qoidaning a'zolik bilan ishlaydigan qobig'i: opening oylari
// entry'dan, `courseStartMonth` guruhdan (faqat kerak bo'lsagina DB'ga boriladi).
const assertPayableMonth = async (entry, forMonth) => {
  const openingMonths = openingItemsOf(entry).items.map((o) => o.month).filter(Boolean);
  if (typeof forMonth === "string" && openingMonths.includes(forMonth)) return;
  const group = await Group.findById(entry.group).select("activatedAt");
  checkPayableMonth(forMonth, openingMonths, group?.activatedAt ? formatMonth(group.activatedAt) : null);
};

// Kiruvchi `{ openingDebts, openingBalance }`ni tekshiradi va saqlashga tayyor
// ko'rinishda qaytaradi (API_CONTRACT_opening_debts.md §1 "Validatsiya").
// server/ da zod ulanmagan (calendar.controller.js izohiga qara) — repo
// konvensiyasiga mos qo'lda tekshiruv, xato kaliti bilan `throw`.
// Joriy oy Asia/Tashkent bo'yicha (`formatMonth(getNow())`).
const validateOpening = ({ openingDebts, openingBalance } = {}) => {
  const list = openingDebts == null ? [] : openingDebts;
  if (!Array.isArray(list)) throw new Error("student.openingMonthInvalid");
  if (list.length > OPENING_MAX_ITEMS) throw new Error("student.openingTooMany");

  const currentMonth = formatMonth(getNow());
  const seen = new Set();
  const debts = list.map((item) => {
    if (!item || typeof item !== "object") throw new Error("student.openingMonthInvalid");
    const month = item.month === undefined || item.month === null || item.month === "" ? null : item.month;
    if (month !== null) {
      if (typeof month !== "string" || !OPENING_MONTH_RE.test(month) || month < OPENING_MIN_MONTH) {
        throw new Error("student.openingMonthInvalid");
      }
      if (month > currentMonth) throw new Error("student.openingMonthFuture");
    }
    const key = month === null ? "__null__" : month;
    if (seen.has(key)) throw new Error("student.openingMonthDuplicate");
    seen.add(key);

    const amount = Number(item.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > OPENING_MAX_AMOUNT) {
      throw new Error("student.invalidAmount");
    }
    if (item.note != null && typeof item.note !== "string") throw new Error("student.openingMonthInvalid");
    return { month, amount, note: (item.note || "").trim().slice(0, 500) };
  });

  const advance = openingBalance == null || openingBalance === "" ? 0 : Number(openingBalance);
  if (!Number.isInteger(advance) || advance < 0 || advance > OPENING_MAX_AMOUNT) {
    throw new Error("student.invalidAmount");
  }

  debts.sort(compareOpeningMonth);
  return { openingDebts: debts, openingBalance: advance };
};

// To'lovlarni taqsimlaydi. Itemlar = ko'chirishdan oldingi qarzlar
// (`kind: "opening"`, eskidan) + sikllar (`kind: "cycle"`). Havza (pool)
// boshlang'ich qiymati = avans (ko'chirishdan oldin to'langan summa).
// 1) `forMonth` belgilangan to'lov: avval shu oydagi SIKLga, qolgani shu
//    oydagi OPENING qatoriga, yana qolgani umumiy havzaga — foydalanuvchi
//    "aynan shu oy uchun" to'lasa, o'sha oy ustuvor qoplanadi.
// 2) Havza FIFO tartibida (opening → sikllar, eng eskisidan) qolgan
//    qoldiqlarga taqsimlanadi — eski qarz birinchi yopiladi.
// Opening yo'q bo'lsa natija avvalgi (faqat sikllar) mantiq bilan aynan bir xil.
const allocatePayments = (cycles, payments, openingItems = [], advance = 0) => {
  const items = [
    ...openingItems.map((o) => ({
      kind: "opening",
      _id: o._id || null,
      month: o.month,
      note: o.note || "",
      fullDue: o.amount,
      paid: 0,
    })),
    ...cycles.map((c) => ({ ...c, kind: "cycle", paid: 0 })),
  ];

  const cycleByMonth = new Map();
  const openingByMonth = new Map();
  for (const item of items) {
    if (item.kind === "cycle" && !cycleByMonth.has(item.month)) cycleByMonth.set(item.month, item);
    if (item.kind === "opening" && item.month && !openingByMonth.has(item.month)) {
      openingByMonth.set(item.month, item);
    }
  }

  const applyTo = (item, amount) => {
    if (!item || amount <= 0) return amount;
    const take = Math.min(amount, Math.max(0, item.fullDue - item.paid));
    item.paid += take;
    return amount - take;
  };

  let pool = Math.max(0, advance || 0);
  for (const p of payments || []) {
    if (p.status !== "paid") continue;
    let left = p.amount;
    if (p.forMonth) {
      left = applyTo(cycleByMonth.get(p.forMonth), left);
      left = applyTo(openingByMonth.get(p.forMonth), left);
    }
    pool += left;
  }

  for (const item of items) {
    if (pool <= 0) break;
    pool = applyTo(item, pool);
  }

  return items;
};

// Oylik to'lov sikli — CLAUDE.md "Ish haqi"dagi kabi, `entry.price` oylik
// to'lov summasi sifatida qaraladi. Ikki xil sikl rejimi bor (Sozlamalar
// sahifasida tanlanadi, BillingSetting.cycleMode):
// - "anchor" ("sanadan-sanaga"): sikl guruh faollashtirilgan kun-oyga
//   langar (14-sanadan boshlansa, har sikl 14-dan 14-gacha).
// - "calendarMonth" ("oy boshidan oy boshiga"): birinchi sikl faollashgan
//   kundan o'sha kalendar oy oxirigacha (kun soniga prorata), keyingi har
//   bir sikl 1-sanadan 1-sanagacha, to'liq narxda.
// To'lovlar FIFO tartibida eng eski sikldan boshlab yopiladi.
const computeBilling = (entry, group, cycleMode = "anchor") => {
  const payments = entry.payments || [];
  const paidAmount = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  // Ko'chirishdan oldingi qarzlar + avans (API_CONTRACT_opening_debts.md §2).
  // Opening qarzlar sikllardan OLDIN taqsimot ro'yxatiga qo'shiladi, avans esa
  // havzaning boshlang'ich qiymati — shu bilan opening qarzni to'lov bilan
  // yopish mumkin (avval u yakuniy qarzga alohida qo'shilib, abadiy qolardi).
  const { items: openingItems, advance } = openingItemsOf(entry);
  const openingDebtTotal = openingItems.reduce((sum, o) => sum + o.amount, 0);

  const openingRowsOf = (allocated) =>
    allocated
      .filter((i) => i.kind === "opening")
      .map((o) => ({
        kind: "opening",
        month: o.month,
        due: o.fullDue,
        paid: o.paid,
        debt: Math.max(0, o.fullDue - o.paid),
        note: o.note,
      }));
  const sumDebt = (rows) => rows.reduce((sum, r) => sum + r.debt, 0);
  const openingFields = (openingRows) => ({
    openingBalance: advance, // endi faqat avans (≥ 0)
    openingDebtTotal,
    openingDebtRemaining: sumDebt(openingRows),
  });

  // Sikllarsiz holat (guruh pending/faollashmagan yoki darslar kelajakda
  // boshlanadi): qarz faqat opening qoldig'i, lekin opening itemlar HAM
  // to'lovlar (havza) bilan taqsimlanadi.
  const withoutCycles = (extra) => {
    const openingRows = openingRowsOf(allocatePayments([], payments, openingItems, advance));
    return {
      paidAmount,
      ...openingFields(openingRows),
      debt: sumDebt(openingRows),
      currentMonthDue: 0,
      paidForCurrentCycle: 0,
      debtBreakdown: openingRows.filter((r) => r.debt > 0),
      ...extra,
    };
  };

  // Boshqa guruhga O'TKAZILGAN a'zolik — hisob-kitobi o'tkazish paytida
  // yopilgan: qolgan qarz/avans yangi a'zolikka ko'chgan
  // (API_CONTRACT_student_transfer.md §3). Bu yerda yana qarz ko'rsatilsa,
  // u ikki marta (eski va yangi guruhda) hisoblanib qolardi.
  if (entry.transferredTo) {
    return {
      paidAmount,
      openingBalance: 0,
      openingDebtTotal: 0,
      openingDebtRemaining: 0,
      debt: 0,
      currentMonthDue: 0,
      paidForCurrentCycle: 0,
      debtBreakdown: [],
      currentCyclePrice: 0,
      courseStartMonth: group?.activatedAt ? formatMonth(group.activatedAt) : null,
      currentCycleMonth: null,
      nextDueDate: null,
    };
  }

  // Guruh hali yig'ilmoqda (pending) yoki hali faollashtirilmagan bo'lsa
  // hech qanday sikl boshlanmagan.
  if (group?.status === "pending" || !group?.activatedAt) {
    return withoutCycles({
      currentCyclePrice: 0,
      courseStartMonth: null,
      currentCycleMonth: null,
      nextDueDate: null,
    });
  }

  // Yakunlangan guruhda hisoblash "finishedAt" paytida to'xtaydi — kurs
  // tugagach yangi sikl boshlanavermaydi.
  const effectiveNow = group.status === "finished" && group.finishedAt ? group.finishedAt : getNow();

  // Faollashtirilgan, lekin darslar boshlanishi kelajakdagi sanaga
  // belgilangan bo'lsa — o'sha sana kelmagunicha sikl qarzdorligi yo'q.
  if (effectiveNow < group.activatedAt) {
    return withoutCycles({
      currentCyclePrice: entry.price || 0,
      courseStartMonth: formatMonth(group.activatedAt),
      currentCycleMonth: formatMonth(group.activatedAt),
      nextDueDate: addMonths(group.activatedAt, 1),
    });
  }

  const allocated = allocatePayments(
    buildCycles(entry, group, cycleMode, effectiveNow),
    payments,
    openingItems,
    advance,
  );
  const openingRows = openingRowsOf(allocated);
  const cycles = allocated.filter((i) => i.kind === "cycle");
  const current = cycles[cycles.length - 1];

  // Joriy sikl uchun "hozir to'lash SHART bo'lgan" qism — faqat O'TGAN
  // kunlar uchun (PaymentDialog'dagi kichik eslatma matni shundan foydalanadi).
  const currentMonthDue = Math.max(0, current.elapsedDue - Math.min(current.elapsedDue, current.paid));

  // "Qarzdorliklar: Ko'rish" ro'yxati — qarzi bor HAR BIR qator: avval
  // ko'chirishdan oldingi qarzlar (eskidan), keyin sikllar (o'tganlar HAM,
  // joriy HAM — aks holda "Umumiy qarzdorlik" > 0 bo'lsa-yu ro'yxat bo'sh
  // chiqib qolardi).
  const cycleRows = cycles.map((c) => ({
    kind: "cycle",
    month: c.month,
    due: c.fullDue,
    paid: c.paid,
    debt: Math.max(0, c.fullDue - c.paid),
  }));
  const debtBreakdown = [...openingRows, ...cycleRows].filter((r) => r.debt > 0);

  // "Umumiy qarzdorlik" — barcha itemlar (opening + o'tgan sikllar + joriy
  // siklning TO'LIQ qoldig'i) bo'yicha. Joriy sikl to'liq qoldig'i bilan —
  // "Bu oy uchun: to'langan/jami" ustuni, qarzdorlik chip va donut chart
  // `currentCyclePrice - paidForCurrentCycle` asosida ishlagani uchun.
  // Havza (avans) qoldig'i salbiy qarz bo'lmaydi.
  const debt = sumDebt(openingRows) + sumDebt(cycleRows);

  return {
    paidAmount,
    ...openingFields(openingRows),
    debt,
    currentMonthDue,
    currentCyclePrice: current.fullDue, // joriy sikl uchun to'lanishi kerak bo'lgan JAMI summa
    paidForCurrentCycle: current.paid, // shundan qanchasi to'langan (oldindan to'lovlarni ham hisobga oladi)
    debtBreakdown, // [{kind, month, due, paid, debt, note?}] — faqat debt > 0 qatorlar, opening → sikllar
    courseStartMonth: formatMonth(group.activatedAt),
    currentCycleMonth: current.month,
    nextDueDate: current.cycleEnd,
  };
};

// O'tkazish paytidagi YAKUNIY hisob (API_CONTRACT_student_transfer.md §3.1):
// tugagan sikllar to'liq, joriy sikl esa faqat shu paytgacha O'TGAN dars
// kunlari bo'yicha (`elapsedDue`) — qolgan kunlarni yangi guruh o'z narxida
// hisoblaydi (`create`dagi credits proratsiyasi bilan bir xil). Natija:
// ortiqcha to'lov (`surplus`) va oy bo'yicha birlashtirilgan qolgan qarzlar.
const settleEntry = (entry, group, cycleMode) => {
  const { items: openingItems, advance } = openingItemsOf(entry);
  const payments = entry.payments || [];

  let cycles = [];
  if (group && group.status !== "pending" && group.activatedAt) {
    const effectiveNow = group.status === "finished" && group.finishedAt ? group.finishedAt : getNow();
    if (effectiveNow >= group.activatedAt) {
      cycles = buildCycles(entry, group, cycleMode, effectiveNow).map((c) =>
        c.isCurrent ? { ...c, fullDue: c.elapsedDue } : c,
      );
    }
  }

  const allocated = allocatePayments(cycles, payments, openingItems, advance);
  const paidIn = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const used = allocated.reduce((sum, i) => sum + i.paid, 0);
  const surplus = Math.max(0, advance + paidIn - used);

  const byMonth = new Map();
  for (const item of allocated) {
    const left = item.fullDue - item.paid;
    if (left <= 0) continue;
    const key = item.month || "__null__";
    const prev = byMonth.get(key);
    if (prev) prev.amount += left;
    else byMonth.set(key, { month: item.month || null, amount: left, note: item.note || "" });
  }
  const debts = [...byMonth.values()].sort(compareOpeningMonth);

  return { surplus, debts };
};

// Faqat SHU clientga tegishli guruh yozuvlari ko'rsatiladi — boshqa
// tenant'larning bog'lanishlari (Student hujjati umumiy bo'lgani uchun)
// hech qachon frontendga oqib chiqmaydi.
const groupEntryDTO = (entry, group, cycleMode) => {
  // Manba a'zoliklar (o'tkazish zanjiri) SHU hujjatning o'zida —
  // `parent()` orqali olinadi, shunda socket payload'lari ham
  // (groupEntryDTO'ni alohida chaqiradigan joylar) to'liq bo'ladi.
  const siblings = typeof entry.parent === "function" ? entry.parent()?.groups || [] : [];
  const transferredPayments = (entry.transferredFrom || []).flatMap((src) => {
    const source = siblings.find((g) => String(g._id) === String(src.entry));
    return (source?.payments || []).map((p) => ({
      _id: p._id,
      code: p.code || null,
      amount: p.amount,
      type: p.type,
      status: p.status,
      note: p.note,
      forMonth: p.forMonth,
      date: p.date,
      fromGroup: src.group,
      fromEntry: src.entry,
    }));
  });

  const billing = computeBilling(entry, group, cycleMode);
  const { items: openingItems } = openingItemsOf(entry);

  // PaymentDialog `forMonth` `min`i uchun: min(eng eski opening oyi,
  // kurs boshlangan oy). Oyi noma'lum (null) qatorlar hisobga olinmaydi.
  const payableMonths = [
    ...openingItems.map((o) => o.month).filter(Boolean),
    ...(billing.courseStartMonth ? [billing.courseStartMonth] : []),
  ].sort();

  return {
    _id: entry._id,
    group: entry.group,
    center: entry.center,
    subject: entry.subject,
    price: entry.price,
    status: entry.status,
    archivedAt: entry.archivedAt || null,
    archivedWithGroup: !!entry.archivedWithGroup,
    groupStatus: group?.status || null,
    joinedAt: entry.joinedAt,
    leftAt: entry.leftAt,
    ...billing,
    // Normallashtirilgan (legacy manfiy openingBalance ham shu yerda, `_id: null`).
    openingDebts: openingItems.map((o) => ({ _id: o._id, month: o.month, amount: o.amount, note: o.note })),
    earliestPayableMonth: payableMonths[0] || null,
    payments: (entry.payments || []).map((p) => ({
      _id: p._id,
      code: p.code || null,
      amount: p.amount,
      type: p.type,
      status: p.status,
      note: p.note,
      forMonth: p.forMonth,
      // "Qaysi oy uchun" o'tkazishlar tarixi (API_CONTRACT_payment_move_month.md).
      forMonthHistory: (p.forMonthHistory || []).map((h) => ({
        from: h.from || "",
        to: h.to || "",
        at: h.at,
        byId: h.byId || null,
        byKind: h.byKind || null,
      })),
      date: p.date,
    })),
    transferredFrom: (entry.transferredFrom || []).map((s) => ({
      group: s.group,
      from: s.from,
      until: s.until,
    })),
    transferredTo: entry.transferredTo
      ? { group: entry.transferredTo.group, entry: entry.transferredTo.entry, at: entry.transferredTo.at }
      : null,
    transferredPayments,
  };
};

// `centerId` berilsa (Staff kontekstida — tenantAuth `req.centerScope`ni
// o'rnatadi) faqat O'SHA filialdagi guruh-yozuvlari qaytadi. CLAUDE.md:
// "Har markaz faqat o'ziga tegishli o'quvchilarni ko'radi" — bir o'quvchi
// bir nechta filialda o'qishi mumkin, shuning uchun tenant filtri yetarli
// emas. Owner uchun bo'sh qoladi (barcha filiallar ko'rinadi).
// `includeArchived` — FAQAT Arxiv bo'limi uchun. Odatiy holda arxivlangan
// a'zolik (`status: "archived"`) O'quvchilar sahifasida, kartochkada,
// qarzdorlik chipida va Excel eksportida umuman ko'rinmaydi
// (API_CONTRACT_archive.md §3).
const DTO = async (student, clientId, centerId = "", { includeArchived = false } = {}) => {
  const groups = (student.groups || []).filter(
    (g) =>
      String(g.client) === String(clientId) &&
      (!centerId || String(g.center) === String(centerId)) &&
      (includeArchived || g.status !== "archived"),
  );

  const groupIds = [...new Set(groups.map((g) => String(g.group)))];
  const groupDocs = groupIds.length
    ? await Group.find({ _id: { $in: groupIds } }).select("status activatedAt finishedAt center days")
    : [];
  const groupMap = Object.fromEntries(groupDocs.map((g) => [String(g._id), g]));

  // Har guruh o'z FILIALI (Center) sozlamasidan foydalanadi — bir o'quvchi
  // bir nechta filialda o'qisa, har biri o'z qoidasi bilan hisoblanadi
  // (API_CONTRACT_center_settings.md). Mavjud bo'lmasa schema default'i
  // ("anchor") ishlatiladi — o'qish uchun yangi hujjat yaratilmaydi.
  const centerIds = [...new Set(groupDocs.map((g) => String(g.center)))];
  const billingDocs = centerIds.length
    ? await BillingSetting.find({ center: { $in: centerIds } }).select("center cycleMode")
    : [];
  const cycleModeMap = Object.fromEntries(billingDocs.map((b) => [String(b.center), b.cycleMode]));

  return {
    _id: student._id,
    phone: student.phone,
    fullName: student.fullName,
    photo: student.photo,
    parentPhone: student.parentPhone,
    ...telegramFieldsOf(student),
    groups: groups.map((g) => {
      const group = groupMap[String(g.group)];
      const cycleMode = (group && cycleModeMap[String(group.center)]) || "anchor";
      return groupEntryDTO(g, group, cycleMode);
    }),
    date: student.date,
    lastUpdate: student.lastUpdate,
  };
};

// "Tushumlar" uchun to'lov qatorlarini yig'adi (list va Excel export bir xil
// manbadan foydalanadi). Filtr `from`/`to` — "YYYY-MM-DD" (Asia/Tashkent).
async function buildRevenueRows(clientId, { from = "", to = "", center = "", type = "", collectedBy = "", search = "", status = "" }) {
  const clientOid = new Types.ObjectId(String(clientId));

  const entryMatch = { "groups.client": clientOid };
  if (center) entryMatch["groups.center"] = new Types.ObjectId(String(center));

  const paymentMatch = {};
  if (type) paymentMatch["groups.payments.type"] = type;
  if (status) paymentMatch["groups.payments.status"] = status;
  if (from) paymentMatch["groups.payments.date"] = { $gte: dateStringToUnix(from) };
  if (to) {
    paymentMatch["groups.payments.date"] = {
      ...(paymentMatch["groups.payments.date"] || {}),
      $lt: addDays(dateStringToUnix(to), 1),
    };
  }
  if (collectedBy) {
    paymentMatch["groups.payments.collectedBy"] =
      collectedBy === "unknown" ? null : new Types.ObjectId(String(collectedBy));
  }

  const pipeline = [
    { $match: { isDeleted: false, "groups.client": clientOid } },
    { $unwind: "$groups" },
    { $match: entryMatch },
    { $unwind: "$groups.payments" },
  ];
  if (Object.keys(paymentMatch).length) pipeline.push({ $match: paymentMatch });

  const trimmed = search?.trim();
  if (trimmed) {
    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    pipeline.push({ $match: { $or: [{ fullName: regex }, { phone: regex }] } });
  }

  pipeline.push({ $sort: { "groups.payments.date": -1 } });
  pipeline.push({
    $project: {
      _id: 0,
      paymentId: "$groups.payments._id",
      studentId: "$_id",
      studentName: "$fullName",
      phone: 1,
      center: "$groups.center",
      group: "$groups.group",
      amount: "$groups.payments.amount",
      type: "$groups.payments.type",
      paymentStatus: "$groups.payments.status",
      note: "$groups.payments.note",
      forMonth: "$groups.payments.forMonth",
      date: "$groups.payments.date",
      collectedBy: "$groups.payments.collectedBy",
      collectedByKind: "$groups.payments.collectedByKind",
    },
  });

  const raw = await Student.aggregate(pipeline);

  // Qabul qiluvchi va filial nomlarini bitta so'rovda yig'ib olamiz
  // (har qator uchun alohida populate qilinmaydi).
  const staffIds = raw.filter((r) => r.collectedByKind === "staff").map((r) => String(r.collectedBy));
  const centerIds = [...new Set(raw.map((r) => String(r.center)))];
  const [staffList, centers, owner] = await Promise.all([
    staffIds.length ? Staff.find({ _id: { $in: [...new Set(staffIds)] } }, { name: 1, role: 1 }) : [],
    Center.find({ _id: { $in: centerIds } }, { name: 1 }),
    Client.findById(clientId).select("name"),
  ]);
  const staffMap = Object.fromEntries(staffList.map((s) => [String(s._id), s]));
  const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

  const resolveCollector = (row) => {
    if (!row.collectedBy) return null;
    if (row.collectedByKind === "owner") {
      return { id: String(row.collectedBy), name: owner?.name || "", role: "owner" };
    }
    const staff = staffMap[String(row.collectedBy)];
    return { id: String(row.collectedBy), name: staff?.name || "", role: staff?.role || "staff" };
  };

  return raw.map((row) => ({
    paymentId: String(row.paymentId),
    studentId: String(row.studentId),
    studentName: row.studentName,
    phone: row.phone,
    centerName: centerMap[String(row.center)] || "",
    groupId: String(row.group),
    amount: row.amount,
    type: row.type,
    status: row.paymentStatus,
    note: row.note || "",
    forMonth: row.forMonth || "",
    date: row.date,
    collectedBy: resolveCollector(row),
  }));
}

const findClientGroupEntry = (student, clientId, groupEntryId) => {
  const entry = student.groups.id(groupEntryId);
  if (!entry || String(entry.client) !== String(clientId)) return null;
  return entry;
};

// Moliyaviy jamlanmalar — Center Detail'da bitta markaz uchun, Dashboard'da
// (centerId bo'sh bo'lsa) butun tenant bo'yicha. Har faol o'quvchi-guruh
// yozuvi computeBilling orqali hisoblanadi (xuddi DTO() dagi kabi, har
// guruh o'z markazining cycleMode'i bilan), so'ng uchta jamlanma yig'iladi:
//
// - `debt`             — BARCHA vaqt bo'yicha qarz (o'tgan sikllar + joriy
//                        sikl qoldig'i). "Umumiy qarzdorlik" kartochkasi.
// - `currentCyclePaid` — faqat JORIY sikl uchun to'langan summa.
// - `currentCycleDebt` — faqat JORIY sikl uchun qolgan summa.
//
// Oxirgi ikkitasi "To'lov holati" donut charti uchun: donut'ning ikkala
// segmenti ham BIR XIL davrga tegishli bo'lishi shart. Avval unga
// `monthRevenue` (joriy oy to'lovlari) va `debt` (barcha-vaqt qarzi)
// uzatilardi — taqqoslab bo'lmaydigan ikki raqam bo'lgani uchun yangi oy
// boshida donut har doim "0% to'langan" ko'rsatib qolardi
// (API_CONTRACT_dashboard_payment_donut.md). Bu yerdagi juftlik
// GroupDetail.jsx dagi hisob bilan bir xil semantikada.
// `preloaded` — chaqiruvchi o'quvchilarni ALLAQACHON yuklagan bo'lsa
// (dashboard.service shunday qiladi) o'shani qayta ishlatadi. Aks holda
// bitta dashboard so'rovi ayni hujjatlarni ikki marta bazadan tortadi —
// API_CONTRACT_performance.md §2.
const centerBillingTotals = async (clientId, centerId = "", preloaded = null) => {
  const empty = { debt: 0, currentCyclePaid: 0, currentCycleDebt: 0 };

  let students = preloaded;
  if (!students) {
    const entryFilter = { "groups.client": clientId, isDeleted: false };
    if (centerId) entryFilter["groups.center"] = centerId;
    students = await Student.find(entryFilter, { groups: 1 });
  }

  const entries = students.flatMap((s) =>
    s.groups.filter(
      (g) =>
        String(g.client) === String(clientId) &&
        (!centerId || String(g.center) === String(centerId)) &&
        g.status === "active",
    ),
  );
  if (!entries.length) return empty;

  const groupIds = [...new Set(entries.map((g) => String(g.group)))];
  const groupDocs = await Group.find({ _id: { $in: groupIds } }).select(
    "status activatedAt finishedAt center days",
  );
  const groupMap = Object.fromEntries(groupDocs.map((g) => [String(g._id), g]));

  const centerIds = [...new Set(groupDocs.map((g) => String(g.center)))];
  const billingDocs = await BillingSetting.find({ center: { $in: centerIds } }).select(
    "center cycleMode",
  );
  const cycleModeMap = Object.fromEntries(billingDocs.map((b) => [String(b.center), b.cycleMode]));

  return entries.reduce((acc, entry) => {
    const group = groupMap[String(entry.group)];
    const cycleMode = (group && cycleModeMap[String(group.center)]) || "anchor";
    const billing = computeBilling(entry, group, cycleMode);

    acc.debt += billing.debt;
    acc.currentCyclePaid += billing.paidForCurrentCycle || 0;
    acc.currentCycleDebt += Math.max(
      0,
      (billing.currentCyclePrice || 0) - (billing.paidForCurrentCycle || 0),
    );
    return acc;
  }, { ...empty });
};

// Rollover bloki (ketma-ket kelmagan `dates`) uchun summa va oylar:
// oxirgi sana tushgan sikl — `fromMonth`, keyingi sikl — `toMonth`/`applyAt`.
// Summa = kunlik narx × kunlar, lekin shu siklga HAQIQATDA to'langan va hali
// o'tkazilmagan qismdan oshmaydi (to'lanmagan pulni o'tkazib bo'lmaydi).
const rolloverAmountFor = (entry, group, cycleMode, dates) => {
  if (!group?.activatedAt || group.status === "pending" || !dates?.length) return null;
  const lastUnix = dateStringToUnix(dates[dates.length - 1]);
  const effectiveNow = Math.max(getNow(), lastUnix + 1);
  const { items: openingItems, advance } = openingItemsOf(entry);
  const cycles = allocatePayments(
    buildCycles(entry, group, cycleMode, effectiveNow),
    entry.payments || [],
    openingItems,
    advance,
  ).filter((i) => i.kind === "cycle");
  const cycle = cycles.find((c) => lastUnix >= c.cycleStart && lastUnix < c.cycleEnd);
  if (!cycle) return null;

  const alreadyRolled = (entry.rollovers || [])
    .filter((r) => r.status === "active" && r.fromMonth === cycle.month)
    .reduce((sum, r) => sum + r.amount, 0);
  const available = Math.max(0, (cycle.paid || 0) - alreadyRolled);
  const amount = Math.min(Math.round((cycle.dailyRate || 0) * dates.length), available);

  return {
    amount,
    fromMonth: cycle.month,
    toMonth: formatMonth(cycle.cycleEnd),
    applyAt: cycle.cycleEnd,
  };
};

module.exports = {
  DTO,
  centerBillingTotals,
  rolloverAmountFor,
  // paymentVerify.service.js chekni tekshirish/PDF uchun qarzdorlik
  // taqsimotini shu YAGONA formula orqali oladi — dublikat hisob-kitob
  // formulasi bo'lmasligi uchun.
  computeBilling,
  // Sof `forMonth` qoidasi — node sinov skriptlari uchun ham eksport qilinadi.
  checkPayableMonth,
  // Faqat regressiya testlari uchun (server/test/billing.test.js) — xatti-harakat o'zgarmaydi.
  _internal: { buildCycles },

  // Telefon raqam bo'yicha global directory qidiruvi — Student hujjati
  // tenant'lararo yagona bo'lgani uchun (CLAUDE.md "telefon asosida yagona
  // hujjat"), boshqa markaz/mijozda allaqachon mavjud odam bo'lsa ham ismi
  // topiladi. Faqat identifikatsiya maydonlari qaytadi — groups[] (boshqa
  // tenant'ning markaz/guruh/narx/to'lov ma'lumoti) hech qachon chiqmaydi.
  // Endi Student.phone UNIQUE emas (API_CONTRACT.md §2 — bitta ota-ona
  // raqami bir nechta farzand uchun ishlatilishi mumkin), shuning uchun
  // qidiruv BIRTA emas, mos kelgan hujjatlar RO'YXATINI qaytaradi. Frontend
  // bo'sh massivni "yangi o'quvchi" deb talqin qiladi.
  lookupByPhone: async (phone) => {
    const trimmed = (phone || "").trim();
    if (!trimmed) return [];

    const students = await Student.find({ phone: trimmed, isDeleted: false }).select(
      "fullName phone parentPhone photo telegramSame telegramPhone parentTelegramSame parentTelegramPhone",
    );

    return students.map((student) => ({
      _id: student._id,
      fullName: student.fullName,
      parentPhone: student.parentPhone,
      ...telegramFieldsOf(student),
      photo: student.photo,
    }));
  },

  // Yangi o'quvchi yaratadi YOKI (agar shu telefon raqam bilan hujjat
  // allaqachon mavjud bo'lsa) mavjud hujjatga yangi guruh bog'lanishini
  // qo'shadi — CLAUDE.md "O'quvchi — telefon raqam asosida yagona hujjat".
  create: async (clientId, body) => {
    const { fullName, phone, parentPhone, centerId, groupId, price, existingStudentId } = body;
    if (!phone || !centerId || !groupId) throw new Error("student.fillTheRows");

    // Ko'chirishdan oldingi qarz/avans (API_CONTRACT_opening_debts.md §3.1) —
    // yangi va `existingStudentId` oqimi uchun bir xil. Validatsiya HAR QANDAY
    // yozishdan (`student.save()`dan) OLDIN: xato bo'lsa o'quvchi yaratilmaydi.
    const opening = validateOpening({
      openingDebts: body.openingDebts,
      openingBalance: body.openingBalance,
    });

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const group = await Group.findOne({
      _id: groupId,
      client: clientId,
      center: center._id,
      isDeleted: false,
    });
    if (!group) throw new Error("group.notFound");
    if (group.status === "finished") throw new Error("student.groupFinished");

    // `group.maxStudents` — MO'LJAL, qat'iy cheklov EMAS. Avval bu yerda
    // limitga yetgan guruhga o'quvchi qo'shish `student.groupFull` xatosi
    // bilan bloklanardi, lekin amalda markazlar limitdan oshirib qabul
    // qiladi (xona sig'adi, ota-ona qattiq so'raydi va h.k.) va tizim bunga
    // to'sqinlik qilmasligi kerak. Maydon o'z o'rnida qoladi va UI'da
    // "17/20" ko'rinishida ko'rsatiladi (GroupCard/GroupDetail/Lesson) —
    // faqat endi u ogohlantiruvchi ma'lumot, to'siq emas.
    //
    // Tarif `studentLimit`i (pastda) — bu boshqa narsa va u QAT'IY bo'lib
    // qoladi: u obuna shartidan kelib chiqadi, guruh sig'imidan emas.

    const trimmedPhone = phone.trim();
    let student;

    // `existingStudentId` berilgan bo'lsa — aynan o'sha hujjatga yangi
    // guruh bog'lanishi qo'shiladi (bitta telefon raqamda bir nechta farzand
    // bo'lishi mumkin bo'lgani uchun endi telefon bo'yicha AVTOMATIK
    // moslashtirish YO'Q — API_CONTRACT.md §2, student.service.js eski
    // `findOne({ phone })` merge xatti-harakati olib tashlandi).
    if (existingStudentId) {
      if (!Types.ObjectId.isValid(existingStudentId)) throw new Error("student.notFound");
      student = await Student.findOne({ _id: existingStudentId, isDeleted: false });
      if (!student) throw new Error("student.notFound");

      const alreadyIn = student.groups.some(
        (g) => String(g.group) === String(group._id) && g.status === "active",
      );
      if (alreadyIn) throw new Error("student.alreadyEnrolled");
    } else {
      if (!fullName) throw new Error("student.fillTheRows");
      student = new Student({ phone: trimmedPhone, fullName: fullName.trim(), parentPhone: parentPhone || "" });
    }

    // Tarif `studentLimit`i — FAQAT shu client uchun hali faol bo'lmagan
    // (ya'ni bu qo'shilish bilan hisobga YANGI qo'shiladigan) o'quvchiga
    // tegishli. Agar o'quvchi shu clientda allaqachon boshqa guruhda faol
    // bo'lsa, qo'shimcha guruhga yozilishi hisobga ta'sir qilmaydi.
    const alreadyActiveForClient = student.groups.some(
      (g) => g.status === "active" && String(g.client) === String(clientId),
    );
    if (!alreadyActiveForClient) {
      const limit = await getStudentLimit(clientId);
      if (limit !== -1) {
        const activeStudents = await Student.countDocuments({
          groups: { $elemMatch: { client: clientId, status: "active" } },
        });
        if (activeStudents >= limit) throw new Error("student.limitReached");
      }
    }

    if (fullName && !student.isNew) student.fullName = fullName.trim();
    const telegramBefore = student.isNew ? null : telegramFieldsOf(student);
    if (parentPhone !== undefined) student.parentPhone = parentPhone || "";
    // Telegram raqamlari (API_CONTRACT_telegram_phone.md §1) — parentPhone
    // bilan bir xil siyosat: yuborilgan maydonlar mavjud hujjatga ham
    // qo'llanadi, `*Same` bo'lsa telefon o'zgarishi bilan qayta sinxronlanadi.
    applyTelegramFields(student, body, { isNew: student.isNew });

    const finalPrice = price != null ? price : (await Subject.findById(group.subject))?.price || 0;
    if (finalPrice < 0) throw new Error("student.invalidPrice");

    // Guruh allaqachon faol bo'lsa (sikl o'rtasida qo'shilmoqda) — shu
    // sikldan hozirgacha o'tkazib yuborilgan HAR BIR dars kuni uchun bitta
    // kredit yoziladi (computeBilling joriy sikl to'lovidan shu kunlar
    // sonini avtomatik ayiradi — "o'quvchi o'tgan darslar uchun to'lamaydi").
    // `billingSetting` har doim (nofaol guruh uchun ham) olinadi — pastda
    // socket payload'ini groupEntryDTO orqali to'liq (currentCyclePrice/
    // paidForCurrentCycle) qurish uchun kerak.
    const billingSetting = await billingSettingService.getOrCreate(group.center);
    const credits = await joinCreditsOf(group, billingSetting.cycleMode);

    student.groups.push({
      group: group._id,
      center: center._id,
      client: clientId,
      subject: group.subject,
      price: finalPrice,
      priceHistory: [{ price: finalPrice, from: 0 }],
      status: "active",
      credits,
      openingDebts: opening.openingDebts,
      openingBalance: opening.openingBalance,
    });
    const entry = student.groups[student.groups.length - 1];

    await student.save();

    // `maxStudents` — MO'LJAL (yuqoridagi izoh). Guruhdagi faol o'quvchilar
    // soni belgilangan limitdan oshib ketsa, limit jimgina YANGI songa
    // ko'tariladi: 10 talik guruhga 11-o'quvchi qo'shilsa max 11 bo'ladi,
    // 12-si qo'shilsa 12 — shu tartibda. Aks holda UI'da abadiy "11/10"
    // ko'rinib turardi. Limit hech qachon o'z-o'zidan PASAYMAYDI (o'quvchi
    // chiqib ketsa "9/11" qoladi) — kamaytirish faqat qo'lda tahrirlash
    // orqali bo'ladi.
    if (group.maxStudents != null) {
      const activeInGroup = await Student.countDocuments({
        isDeleted: false,
        groups: { $elemMatch: { group: group._id, status: "active" } },
      });
      if (activeInGroup > group.maxStudents) {
        group.maxStudents = activeInGroup;
        await group.save();
      }
    }

    // O'quvchi guruhga qo'shildi — GroupDetail.jsx refetch qilmasdan,
    // to'g'ridan-to'g'ri shu payloaddan o'z ro'yxatiga qo'shadi
    // (API_CONTRACT.md §3). `center:{centerId}` xonasiga (Staff) va
    // `client:{clientId}` xonasiga (Owner — socket.config.js Owner uchun
    // centerId'ni socket.data'ga yozmaydi, shuning uchun u hech qachon
    // `center:*` xonasiga qo'shilmaydi) yuboriladi; GroupDetail.jsx
    // groupId bo'yicha filtrlaganidan ikkalasi ham xavfsiz.
    const enrolledPayload = {
      groupId: String(group._id),
      center: String(center._id),
      // Yuqorida limit avtomatik ko'tarilgan bo'lishi mumkin — GroupDetail.jsx
      // "11/10" ko'rsatmasligi uchun yangi qiymat shu payloadda boradi.
      maxStudents: group.maxStudents ?? null,
      student: {
        _id: student._id,
        fullName: student.fullName,
        phone: student.phone,
        parentPhone: student.parentPhone,
        ...telegramFieldsOf(student),
        photo: student.photo,
      },
      entry: {
        ...groupEntryDTO(entry, group, billingSetting.cycleMode),
        client: entry.client,
      },
    };
    emit(`center:${String(center._id)}`, "student:enrolled", enrolledPayload);
    emit(`client:${String(clientId)}`, "student:enrolled", enrolledPayload);

    // Telegram raqami o'zgargan bo'lsa (yangi hujjat yoki mavjudida yangilandi)
    // — eski va yangi raqamlar bo'yicha badge holati qayta hisoblanadi.
    emitTelegramDiff(telegramBefore, telegramFieldsOf(student));

    return await DTO(student, clientId);
  },

  // Excel'dan (yoki qo'lda joylashtirilgan jadvaldan) guruhga ko'plab
  // o'quvchi bir yo'la kiritish (API_CONTRACT_student_import.md). Har
  // qator uchun MAVJUD `create()` qayta ishlatiladi — guruh/markaz
  // tekshiruvi, tarif limiti, sikl o'rtasida qo'shilgan o'quvchi uchun
  // `credits` proratsiyasi — hammasi allaqachon shu yerda. Yangi parallel
  // mantiq yozilmaydi.
  //
  // Ketma-ket (`for...of`) bajariladi, `Promise.all` EMAS — tarif limiti va
  // `maxStudents` tekshiruvi hisobga bog'liq (har `create()` chaqiruvi bazadan
  // joriy faol o'quvchilar sonini qayta o'qiydi), parallel bajarilsa limitdan
  // oshib ketishi mumkin.
  importBulk: async (clientId, body, actor = null) => {
    const { centerId, groupId, rows } = body;
    if (!Array.isArray(rows) || !rows.length) throw new Error("student.importEmptyRows");
    if (rows.length > 300) throw new Error("student.importTooManyRows");

    // Markaz va guruh BIR MARTA tekshiriladi (har qator uchun emas — 300 ta
    // qator uchun 300 marta bir xil so'rov yubormaslik uchun).
    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const group = await Group.findOne({
      _id: groupId,
      client: clientId,
      center: center._id,
      isDeleted: false,
    });
    if (!group) throw new Error("group.notFound");
    if (group.status === "finished") throw new Error("student.groupFinished");

    // Ayni faylni IKKI MARTA import qilish — ko'chirish paytida juda ehtimolli
    // ("ishladimi? yana bir bosay"). Himoyasiz holda har safar YANGI hujjat
    // yaratilardi va guruh jimgina dublikat o'quvchilarga to'lib ketardi.
    //
    // Faqat telefon bo'yicha bloklash MUMKIN EMAS: bu loyihada bitta telefon
    // raqami ataylab bir nechta o'quvchida bo'lishi mumkin (bir ota-onaning
    // farzandlari — Student.js izohi), va egizaklar bitta guruhda ham
    // o'qishi mumkin. Shuning uchun kalit sifatida telefon + ISM juftligi
    // olinadi: qayta import qilingan qatorda ikkalasi ham aynan bir xil
    // bo'ladi, aka-uka/opa-singilda esa ism farq qiladi.
    const normalizeName = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
    const existingInGroup = await Student.find({
      isDeleted: false,
      groups: { $elemMatch: { group: group._id, status: "active" } },
    }).select("phone fullName");
    const takenKeys = new Set(
      existingInGroup.map((s) => `${String(s.phone).trim()}|${normalizeName(s.fullName)}`),
    );

    const results = [];
    let created = 0;
    let enrolled = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      try {
        const action = row.existingStudentId ? "enrolled" : "created";

        // `existingStudentId` berilganda tekshiruv `create()` ning o'zida
        // bor (o'sha hujjat shu guruhda faolmi) — bu yerda faqat YANGI
        // hujjat yaratiladigan yo'l himoyalanadi.
        // Dublikat — XATO EMAS, o'tkazib yuboriladi ("qayta import qilinsa
        // avtomatik import qilinmaydi"). Foydalanuvchi qizil xato ro'yxatini
        // emas, "N ta o'tkazib yuborildi" xulosasini ko'radi.
        const rowKey = `${String(row.phone || "").trim()}|${normalizeName(row.fullName)}`;
        if (!row.existingStudentId && takenKeys.has(rowKey)) {
          skipped += 1;
          results.push({ index, ok: true, action: "skipped" });
          continue;
        }
        // `module.exports.create` — shu obyekt ichida `create` alohida
        // identifikator emas, faqat xususiyat nomi, shuning uchun eksport
        // orqali chaqiriladi (module to'liq yuklangach ishlaydi).
        // Boshlang'ich qoldiq (API_CONTRACT_opening_debts.md §3.4): MANFIY =
        // eski qarz → `openingDebts` qatori (oyi `row.openingDebtMonth` yoki
        // null), MUSBAT = avans. `create()`ning o'ziga uzatiladi — u
        // validatsiyani `save`dan OLDIN bajaradi, xato qatorda o'quvchi
        // yaratilmaydi (avval alohida, keyingi `save` bilan yozilardi).
        const openingRaw = Math.round(Number(row.openingBalance) || 0);
        const data = await module.exports.create(clientId, {
          fullName: row.fullName,
          phone: row.phone,
          parentPhone: row.parentPhone,
          // "O'quvchi Telegram" / "Ota-ona Telegram" ustunlari (ixtiyoriy).
          ...telegramFieldsFromImportRow(row, { isNew: !row.existingStudentId }),
          centerId,
          groupId,
          price: row.price,
          existingStudentId: row.existingStudentId || null,
          openingDebts:
            openingRaw < 0 ? [{ month: row.openingDebtMonth || null, amount: -openingRaw }] : [],
          openingBalance: openingRaw > 0 ? openingRaw : 0,
        });

        // Ayni faylning O'ZIDA takrorlangan qator ham ushlanishi uchun
        // (bitta o'quvchi ro'yxatda ikki marta yozilgan bo'lsa) yangi
        // qo'shilgan kalit ham darhol to'plamga kiritiladi.
        takenKeys.add(rowKey);

        if (action === "created") created += 1;
        else enrolled += 1;
        results.push({ index, ok: true, studentId: data._id, action });
      } catch (error) {
        // Mavjud hujjat (`existingStudentId`) shu guruhda allaqachon faol
        // bo'lsa `create()` shu xatoni beradi — bu ham dublikat, xato emas.
        if (error.message === "student.alreadyEnrolled") {
          skipped += 1;
          results.push({ index, ok: true, action: "skipped" });
          continue;
        }
        failed += 1;
        results.push({ index, ok: false, error: error.message });
      }
    }

    // Bekor qilish (undo) uchun — shu chaqiruv YARATGAN/QO'SHGAN hujjat va
    // a'zoliklar bir ImportBatch'ga belgilanadi (API_CONTRACT_import_undo.md
    // §1). Hech nima yaratilmagan/qo'shilmagan bo'lsa batch YARATILMAYDI
    // (bekor qilish uchun tegishli narsa yo'q).
    let batchId = null;
    if (created + enrolled > 0) {
      const batch = await ImportBatch.create({
        client: clientId,
        center: center._id,
        group: group._id,
        // `buildActor` kind sifatida "admin"/"staff"/"client" beradi —
        // bu marshrutga admin hech qachon kirmaydi, lekin ehtiyot uchun
        // "staff" bo'lmasa "client" deb olinadi (Owner).
        createdBy: { id: actor?.id, kind: actor?.kind === "staff" ? "staff" : "client" },
        counts: { created, enrolled, skipped, failed },
      });
      batchId = batch._id;

      // Har muvaffaqiyatli qatorning aynan O'ZI qo'shgan a'zolikni topib
      // (guruh+client bo'yicha ENG OXIRGI yozuv — `create()` uni ro'yxat
      // OXIRIGA qo'shadi) batch id bilan belgilaydi.
      for (const r of results) {
        if (!r.ok || !r.studentId || (r.action !== "created" && r.action !== "enrolled")) continue;
        const student = await Student.findById(r.studentId);
        if (!student) continue;
        const entry = [...student.groups]
          .reverse()
          .find((g) => String(g.group) === String(groupId) && String(g.client) === String(clientId));
        if (entry) entry.importBatch = batchId;
        // HUJJAT darajasi faqat YANGI yaratilgan o'quvchida — mavjud
        // hujjatga yangi a'zolik qo'shilganda bu maydon TEGILMAYDI.
        if (r.action === "created") student.importBatch = batchId;
        await student.save();
      }
    }

    return { batchId: batchId ? String(batchId) : null, created, enrolled, skipped, failed, results };
  },

  // Shu guruh bo'yicha bekor qilinishi mumkin bo'lgan ENG OXIRGI batch
  // ("2 soat oldin 15 ta o'quvchi import qilingan · Bekor qilish" eslatmasi
  // uchun). `canUndo: false` bo'lsa ham hujjat qaytadi — UI sababni
  // ko'rsatishi uchun (API_CONTRACT_import_undo.md).
  latestImportBatch: async (clientId, groupId) => {
    const batch = await ImportBatch.findOne({
      client: clientId,
      group: groupId,
      status: "applied",
    }).sort({ createdAt: -1 });
    if (!batch) return null;

    // `getNow()` SONIYA qaytaradi (date.util.js) — millisekund emas. Oyna
    // ham soniyada o'lchanadi, aks holda taqqoslash hech qachon ishlamaydi
    // (86 400 000 soniya ~ 2.7 yil). Bekor qilish oynasi (1 kun) o'tgach
    // eslatma umuman ko'rsatilmaydi — u faqat shu oyna uchun ma'noli,
    // aks holda guruh sahifasida abadiy osilib turardi.
    const ONE_DAY = 24 * 60 * 60;
    if (getNow() - batch.createdAt > ONE_DAY) return null;

    let canUndo = true;
    let undoBlockedReason = null;

    const { paymentsBlocked, attendanceBlocked } = await module.exports.__findImportBatchBlockers(batch);
    if (paymentsBlocked > 0) {
      canUndo = false;
      undoBlockedReason = "import.batchHasPayments";
    } else if (attendanceBlocked > 0) {
      canUndo = false;
      undoBlockedReason = "import.batchHasAttendance";
    }

    return {
      _id: batch._id,
      createdAt: batch.createdAt,
      counts: batch.counts,
      canUndo,
      undoBlockedReason,
    };
  },

  // Import batch qo'shgan a'zoliklarni (va ular orqali batafsil ma'lumot
  // olib kelinishi kerak bo'lgan Student hujjatlarini) topadi. Ikki
  // shartni ham tekshirish uchun ishlatiladi: to'lov bor-yo'qligi va
  // davomat bor-yo'qligi (`latestImportBatch` va `undoImportBatch`da
  // TAKRORLANMASLIGI uchun bitta joyga to'plangan).
  __findImportBatchBlockers: async (batch) => {
    const students = await Student.find({ "groups.importBatch": batch._id });
    const entries = [];
    students.forEach((student) => {
      student.groups.forEach((entry) => {
        if (String(entry.importBatch || "") === String(batch._id)) entries.push({ student, entry });
      });
    });

    const paymentsBlocked = entries.filter((e) => (e.entry.payments || []).length > 0).length;

    const studentIds = entries.map((e) => e.student._id);
    const attendanceBlocked = studentIds.length
      ? await Attendance.countDocuments({ group: batch.group, "records.student": { $in: studentIds } })
      : 0;

    return { entries, paymentsBlocked, attendanceBlocked };
  },

  // Xato importni ortga qaytaradi. A'zolik "archived" QILINMAYDI, `$pull`
  // orqali importdan OLDINGI holat aynan tiklanadi (Arxivni axlat yozuv
  // bilan to'ldirmaslik uchun — API_CONTRACT_import_undo.md §1). Hujjat
  // hard delete QILINMAYDI (CLAUDE.md) — faqat guruhi bo'shab qolgan
  // hujjatlar `isDeleted: true` qilinadi (arxivlanadi).
  undoImportBatch: async (clientId, batchId, actor) => {
    const batch = await ImportBatch.findOne({ _id: batchId, client: clientId });
    if (!batch) throw new Error("student.notFound");
    if (batch.status !== "applied") throw new Error("import.batchAlreadyUndone");

    // Soniyada — `latestImportBatch`dagi bilan bir xil sabab.
    const ONE_DAY = 24 * 60 * 60;
    if (getNow() - batch.createdAt > ONE_DAY) throw new Error("import.batchTooOld");

    // Faqat batch'ni YARATGAN shaxs yoki Client Owner bekor qila oladi.
    const isOwner = actor?.kind !== "staff";
    const isCreator = String(batch.createdBy?.id || "") === String(actor?.id || "");
    if (!isOwner && !isCreator) throw new Error("import.batchNotYours");

    const { entries, paymentsBlocked, attendanceBlocked } = await module.exports.__findImportBatchBlockers(batch);

    if (paymentsBlocked > 0) {
      const err = new Error("import.batchHasPayments");
      err.data = { blockedCount: paymentsBlocked };
      throw err;
    }
    if (attendanceBlocked > 0) {
      const err = new Error("import.batchHasAttendance");
      err.data = { blockedCount: attendanceBlocked };
      throw err;
    }

    const removedMemberships = entries.length;

    // 1) A'zoliklar $pull — importdan oldingi holatni AYNAN tiklaydi.
    await Student.updateMany(
      { "groups.importBatch": batch._id },
      { $pull: { groups: { importBatch: batch._id } } },
    );

    // 2) $pull'dan keyin guruhi BO'SHAB qolgan (shu batch YARATGAN, ya'ni
    // hujjat darajasida ham belgilangan) hujjatlar arxivlanadi — bironta
    // a'zoligi qolmagani uchun Arxivda ham ko'rinmaydi.
    const createdStudents = await Student.find({ importBatch: batch._id, isDeleted: false });
    let deletedStudents = 0;
    for (const student of createdStudents) {
      if (!student.groups.length) {
        student.isDeleted = true;
        student.deletedAt = getNow();
        await student.save();
        deletedStudents += 1;
      }
    }

    batch.status = "undone";
    batch.undoneAt = getNow();
    batch.undoneBy = { id: actor.id, kind: actor.kind === "staff" ? "staff" : "client" };
    await batch.save();

    const payload = {
      groupId: String(batch.group),
      batchId: String(batch._id),
      removedMemberships,
      deletedStudents,
    };
    // Ro'yxat ommaviy o'zgargani uchun (payload bilan yamash mantiqsiz)
    // GroupDetail.jsx/Students/index.jsx shu eventda to'liq refetch qiladi.
    emit(`center:${String(batch.center)}`, "student:importUndone", payload);
    emit(`client:${clientId}`, "student:importUndone", payload);

    void audit.log({
      actor,
      client: clientId,
      center: batch.center,
      action: "student:importUndone",
      entity: { type: "importBatch", id: batch._id, label: `${removedMemberships} o'quvchi` },
      meta: { groupId: String(batch.group), removedMemberships, deletedStudents },
    });

    return { removedMemberships, deletedStudents };
  },

  list: async (
    clientId,
    { page = 1, limit, search = "", center = "", group = "", status = "", debtStatus = "" },
  ) => {
    const elemMatch = { client: clientId };
    if (center) elemMatch.center = center;
    if (group) elemMatch.group = group;
    // Arxivlangan a'zolik hech qachon oddiy ro'yxatga tushmaydi — u faqat
    // Arxiv bo'limida ko'rinadi (API_CONTRACT_archive.md §3).
    elemMatch.status = status && ["active", "left"].includes(status) ? status : { $ne: "archived" };

    const filter = { isDeleted: false, groups: { $elemMatch: elemMatch } };

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: regex }, { phone: regex }];
    }

    // Qarzdorlik hujjatda saqlanmaydi — har guruh-yozuv uchun jonli
    // hisoblanadi (computeBilling). Shu sabab "Qarzdorlar"/"Qarzi yo'qlar"
    // filtri Mongo darajasida emas, DTO tayyor bo'lgach ilova darajasida
    // qo'llaniladi — boshqa list() metodlaridagi "qidiruv" tarmog'i kabi
    // (bularda ham sahifalash Mongo emas, xotirada bajariladi).
    if (debtStatus === "debtor" || debtStatus === "noDebt") {
      const all = await Student.find(filter).sort({ createdAt: -1 });
      const dtos = await Promise.all(all.map((s) => DTO(s, clientId, center)));

      // TO'LIQ qarz bo'yicha: o'tgan sikllar + joriy sikl qoldig'i
      // (`g.debt`). Faqat joriy sikl tekshirilsa, o'tgan oydan qarzi bor
      // o'quvchi "Qarzi yo'q" tarmog'iga tushib qolardi.
      const hasDebt = (s) => s.groups.some((g) => g.status === "active" && (g.debt || 0) > 0);
      const filtered = dtos.filter((s) => (debtStatus === "debtor" ? hasDebt(s) : !hasDebt(s)));
      await attachTelegramStatus(filtered);

      return {
        data: filtered,
        meta: { page: 1, limit: filtered.length, total: filtered.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    // Guruh detali butun guruhni BIR so'rovda oladi (API_CONTRACT_group_detail.md
    // §1) — aks holda 50+ o'quvchili guruhda ro'yxat, matritsalar va moliyaviy
    // yig'indilar faqat birinchi 50 kishi bo'yicha chiqardi. Kattaroq limit
    // faqat `group` filtri bilan: umumiy ro'yxat sahifalanganicha qoladi.
    const pageSize = group
      ? Math.min(GROUP_PAGE_SIZE_MAX, Math.max(1, Number(limit) || PAGE_SIZE))
      : PAGE_SIZE;
    const skip = (pageNum - 1) * pageSize;

    const [data, total] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Student.countDocuments(filter),
    ]);

    const dtos = await Promise.all(data.map((s) => DTO(s, clientId, center)));
    await attachTelegramStatus(dtos);

    return {
      data: dtos,
      meta: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  // Excel export uchun — list() bilan bir xil filtrlar, lekin sahifalashsiz
  // (FILTRGA mos BARCHA o'quvchilar) va Filial/Fan nomlari hal qilingan
  // holda (Excel'da ObjectId emas, o'qish mumkin nom chiqishi kerak).
  exportList: async (clientId, { search = "", center = "", group = "", status = "", debtStatus = "" }) => {
    const elemMatch = { client: clientId };
    if (center) elemMatch.center = center;
    if (group) elemMatch.group = group;
    // Arxivlangan a'zolik hech qachon oddiy ro'yxatga tushmaydi — u faqat
    // Arxiv bo'limida ko'rinadi (API_CONTRACT_archive.md §3).
    elemMatch.status = status && ["active", "left"].includes(status) ? status : { $ne: "archived" };

    const filter = { isDeleted: false, groups: { $elemMatch: elemMatch } };

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: regex }, { phone: regex }];
    }

    const all = await Student.find(filter).sort({ createdAt: -1 });
    let dtos = await Promise.all(all.map((s) => DTO(s, clientId, center)));

    if (debtStatus === "debtor" || debtStatus === "noDebt") {
      // TO'LIQ qarz bo'yicha: o'tgan sikllar + joriy sikl qoldig'i
      // (`g.debt`). Faqat joriy sikl tekshirilsa, o'tgan oydan qarzi bor
      // o'quvchi "Qarzi yo'q" tarmog'iga tushib qolardi.
      const hasDebt = (s) => s.groups.some((g) => g.status === "active" && (g.debt || 0) > 0);
      dtos = dtos.filter((s) => (debtStatus === "debtor" ? hasDebt(s) : !hasDebt(s)));
    }

    const centerIds = [...new Set(dtos.flatMap((s) => s.groups.map((g) => String(g.center))))];
    const subjectIds = [...new Set(dtos.flatMap((s) => s.groups.map((g) => String(g.subject))))];
    const [centerDocs, subjectDocs] = await Promise.all([
      Center.find({ _id: { $in: centerIds } }, { name: 1 }),
      Subject.find({ _id: { $in: subjectIds } }, { name: 1 }),
    ]);
    const centerMap = Object.fromEntries(centerDocs.map((c) => [String(c._id), c.name]));
    const subjectMap = Object.fromEntries(subjectDocs.map((s) => [String(s._id), s.name]));

    return dtos.map((s) => {
      const activeGroups = s.groups.filter((g) => g.status === "active");
      const debt = activeGroups.reduce((sum, g) => sum + (g.debt || 0), 0);
      return {
        fullName: s.fullName,
        phone: s.phone,
        groupLabels: activeGroups.map((g) => subjectMap[String(g.subject)] || "?").join(", "),
        centerNames: [...new Set(activeGroups.map((g) => centerMap[String(g.center)] || "—"))].join(", "),
        debt,
      };
    });
  },

  getOne: async (clientId, id, centerId = "") => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    // Staff kontekstida (centerId berilgan) o'quvchi SHU filialda o'qimasa
    // umuman ko'rinmaydi — boshqa filialning o'quvchisini ID orqali ochib
    // bo'lmaydi.
    const hasAccess = student.groups.some(
      (g) =>
        String(g.client) === String(clientId) &&
        (!centerId || String(g.center) === String(centerId)),
    );
    if (!hasAccess) throw new Error("student.notFound");

    return await attachTelegramStatus(await DTO(student, clientId, centerId));
  },

  // Excel export — bitta o'quvchi: guruhlar (Filial/Fan nomi hal qilingan) +
  // barcha to'lovlar tarixi (2 varaq uchun tayyor ma'lumot).
  exportOne: async (clientId, id) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");
    const hasAccess = student.groups.some((g) => String(g.client) === String(clientId));
    if (!hasAccess) throw new Error("student.notFound");

    const dto = await DTO(student, clientId);

    const centerIds = [...new Set(dto.groups.map((g) => String(g.center)))];
    const subjectIds = [...new Set(dto.groups.map((g) => String(g.subject)))];
    const [centerDocs, subjectDocs] = await Promise.all([
      Center.find({ _id: { $in: centerIds } }, { name: 1 }),
      Subject.find({ _id: { $in: subjectIds } }, { name: 1 }),
    ]);
    const centerMap = Object.fromEntries(centerDocs.map((c) => [String(c._id), c.name]));
    const subjectMap = Object.fromEntries(subjectDocs.map((s) => [String(s._id), s.name]));

    const groupRows = dto.groups.map((g) => ({
      subjectName: subjectMap[String(g.subject)] || "?",
      centerName: centerMap[String(g.center)] || "—",
      price: g.price,
      status: g.status,
      paid: g.paidForCurrentCycle || 0,
      due: g.currentCyclePrice || 0,
      debt: g.debt || 0,
    }));

    const paymentRows = dto.groups.flatMap((g) =>
      (g.payments || []).map((p) => ({
        subjectName: subjectMap[String(g.subject)] || "?",
        amount: p.amount,
        type: p.type,
        status: p.status,
        forMonth: p.forMonth || "",
        date: p.date,
      })),
    );

    return { student: { fullName: dto.fullName, phone: dto.phone }, groupRows, paymentRows };
  },

  // PATCH /students/:id — Reception/Owner tomonidan asosiy ma'lumotlarni
  // tahrirlash (API_CONTRACT.md §1). fullName/phone/parentPhone/photo dan
  // kamida bittasi kelishi shart, faqat kelgan maydonlar yangilanadi.
  update: async (clientId, id, body) => {
    const { fullName, phone, parentPhone, photo } = body;
    if (
      fullName === undefined &&
      phone === undefined &&
      parentPhone === undefined &&
      photo === undefined &&
      !hasTelegramFields(body)
    ) {
      throw new Error("student.fillTheRows");
    }

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const hasAccess = student.groups.some((g) => String(g.client) === String(clientId));
    if (!hasAccess) throw new Error("student.notFound");

    // Telegram raqamlari o'zgarishdan OLDINGI holat (badge eventi uchun).
    const telegramBefore = telegramFieldsOf(student);

    if (fullName !== undefined) {
      const trimmedName = fullName.trim();
      if (trimmedName.length < 2) throw new Error("student.invalidName");
      student.fullName = trimmedName;
    }
    if (phone !== undefined) {
      const trimmedPhone = (phone || "").trim();
      if (!trimmedPhone) throw new Error("student.invalidPhone");
      student.phone = trimmedPhone;
    }
    if (parentPhone !== undefined) student.parentPhone = parentPhone || "";
    if (photo !== undefined) student.photo = photo || "";
    // phone/parentPhone YUQORIDA o'rnatilgan — `*Same` bo'lsa qayta sinxronlanadi.
    applyTelegramFields(student, body, { isNew: false });

    await student.save();
    emitTelegramDiff(telegramBefore, telegramFieldsOf(student));

    // Bu o'quvchi tegishli BARCHA markaz va clientlarga xabar beriladi — bir
    // o'quvchi bir nechta centerda o'qishi mumkin (CLAUDE.md "15 tagacha
    // markaz"). `client:{clientId}` ham qo'shiladi, chunki Client Owner
    // socket ulanishida centerId yo'q (socket.config.js) — faqat
    // `center:*` xonalariga yuborilsa Owner hech qachon ololmaydi.
    const dto = await attachTelegramStatus(await DTO(student, clientId));

    const centerIds = [...new Set(student.groups.map((g) => String(g.center)))];
    const clientIds = [...new Set(student.groups.map((g) => String(g.client)))];
    const payload = {
      studentId: String(student._id),
      fullName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      ...telegramFieldsOf(student),
      photo: student.photo,
      parentTelegram: dto.parentTelegram,
      studentTelegram: dto.studentTelegram,
    };
    centerIds.forEach((centerId) => emit(`center:${centerId}`, "student:updated", payload));
    clientIds.forEach((cId) => emit(`client:${cId}`, "student:updated", payload));

    return dto;
  },

  // O'qituvchi/yordamchi uchun kontakt tahriri (API_CONTRACT_student_contact_telegram.md
  // §2) — faqat `fullName`, `phone`, `parentPhone`; qolgan maydonlar (`photo` va
  // h.k.) jimgina tashlanadi. Validatsiya/socket/DTO — `update` ning o'zi.
  updateContact: async (clientId, id, body = {}) => {
    const { fullName, phone, parentPhone } = body || {};
    // `update` `.trim()` chaqiradi — satr bo'lmagan qiymat 500 bermasin.
    if (fullName !== undefined && typeof fullName !== "string") throw new Error("student.invalidName");
    if (phone !== undefined && typeof phone !== "string") throw new Error("student.invalidPhone");
    if (parentPhone !== undefined && parentPhone !== null && typeof parentPhone !== "string") {
      throw new Error("student.invalidPhone");
    }
    return await module.exports.update(clientId, id, {
      fullName,
      phone,
      parentPhone,
      // Telegram raqamlari ham kontakt (API_CONTRACT_telegram_phone.md §4).
      ...pickTelegramFields(body || {}),
    });
  },

  updateGroupPrice: async (clientId, id, groupEntryId, price) => {
    if (price == null || price < 0) throw new Error("student.invalidPrice");

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    const group = await Group.findById(entry.group);
    const billingSetting = group ? await billingSettingService.getOrCreate(group.center) : null;

    if (!entry.priceHistory || entry.priceHistory.length === 0) {
      // Eski (tarixsiz) yozuvlar uchun: boshlang'ich narx "azaldan" amal
      // qilgan deb hisoblanadi (from:0) — aks holda mid-sikl qo'shilgan
      // o'quvchida joinedAt joriy sikl boshlanishidan KEYIN bo'lishi mumkin
      // va priceAt hech qanday yozuvni topmay, joriy (yangi) narxni NOTO'G'RI
      // orqaga qo'llab yuboradi.
      entry.priceHistory = [{ price: entry.price, from: 0 }];
    }
    // `from` joriy (hali yopilmagan) siklning BOSHLANISH sanasi qilib
    // belgilanadi (`getNow()` emas) — aks holda priceAt joriy sikl uchun
    // hamon ESKI narxni qaytarardi (cycleStart < from=now), va narxni 0'ga
    // tuzatish qarzdorlikka darhol ta'sir qilmasdi. Bu faqat JORIY siklga
    // orqaga ta'sir qiladi — allaqachon yopilgan o'tgan sikllar o'zgarmaydi.
    const now = getNow();
    const effectiveNow =
      group?.status === "finished" && group.finishedAt ? group.finishedAt : now;
    const from =
      group && effectiveNow >= group.activatedAt
        ? currentCycleStartOf(group, billingSetting?.cycleMode || "anchor", effectiveNow)
        : now;
    entry.priceHistory.push({ price, from });
    entry.price = price;
    await student.save();

    // Narx o'zgarishi Guruh detail/Students ro'yxatida ochiq turgan boshqa
    // sahifalarga HAM realtime yetib borishi kerak (StudentEditDialog
    // orqali tahrirlash — attendance:marked bilan bir xil naqsh).
    if (group) {
      emit(`client:${clientId}`, "student:priceUpdated", {
        groupId: String(entry.group),
        studentId: String(id),
        entry: groupEntryDTO(entry, group, billingSetting.cycleMode),
      });
    }

    return await DTO(student, clientId);
  },

  // PUT /students/:id/groups/:groupEntryId/opening — ko'chirishdan oldingi
  // qarz(lar) va avansni TO'LIQ almashtiradi (API_CONTRACT_opening_debts.md
  // §3.2). Legacy manfiy `openingBalance` shu saqlashda `openingDebts`ga
  // ko'chadi (body normallashtirilgan ro'yxatni to'liq yuboradi, avans esa
  // `openingBalance`ga yoziladi — manfiy qiymat endi saqlanmaydi).
  updateOpening: async (clientId, id, groupEntryId, body, actor = null) => {
    const next = validateOpening({
      openingDebts: body?.openingDebts,
      openingBalance: body?.openingBalance,
    });

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry || entry.status === "archived") throw new Error("student.groupEntryNotFound");

    const plain = (items, advance) => ({
      openingDebts: items.map((o) => ({ month: o.month, amount: o.amount, note: o.note || "" })),
      openingBalance: advance,
    });
    const prev = openingItemsOf(entry);
    const before = plain(prev.items, prev.advance);
    const after = plain(next.openingDebts, next.openingBalance);

    entry.openingDebts = next.openingDebts;
    entry.openingBalance = next.openingBalance;
    await student.save();

    const group = await Group.findById(entry.group);
    const billingSetting = group ? await billingSettingService.getOrCreate(group.center) : null;

    // GroupDetail allaqachon shu event bilan `entry`ni almashtiradi.
    // Owner `client:*`, Staff `center:*` xonasida (socket.config.js).
    if (group) {
      const payload = {
        groupId: String(entry.group),
        studentId: String(id),
        entry: groupEntryDTO(entry, group, billingSetting?.cycleMode || "anchor"),
      };
      emit(`client:${clientId}`, "student:priceUpdated", payload);
      emit(`center:${String(entry.center)}`, "student:priceUpdated", payload);
    }

    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:openingDebtsUpdated",
      entity: { type: "student", id: student._id, label: student.fullName },
      changes: audit.diff(before, after, ["openingDebts", "openingBalance"]),
      meta: { groupEntryId: String(groupEntryId), group: String(entry.group) },
    });

    return await DTO(student, clientId);
  },

  // Bitta A'ZOLIKNI arxivlash (o'quvchi HUJJATI emas) —
  // API_CONTRACT_archive.md §1. O'quvchi boshqa guruhlarda faol qolaveradi,
  // arxivlangan a'zolikning qarzdorligi esa butun loyihadan chiqadi.
  archiveGroupEntry: async (clientId, id, groupEntryId, actor = null) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");
    if (entry.status === "archived") throw new Error("archive.alreadyArchived");

    entry.statusBeforeArchive = entry.status;
    entry.status = "archived";
    entry.archivedAt = getNow();
    // QO'LDA arxivlangan — guruh keyinchalik arxivdan qaytarilsa ham bu
    // a'zolik arxivda qoladi (archive.util.js#restoreGroupEntries).
    entry.archivedWithGroup = false;
    await student.save();

    // Dashboard/hisobot keshi aynan shu hodisada bekor qilinadi
    // (emitter.util.js CACHE_BUSTING) — qarzdorlik raqami darhol o'zgaradi.
    emit(`client:${clientId}`, "student:leftGroup", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
    });
    emitArchiveChanged(clientId, entry.center, "student", student._id, "archived");

    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:archived",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: { groupEntryId: String(groupEntryId), group: String(entry.group) },
    });

    return await DTO(student, clientId);
  },

  leaveGroup: async (clientId, id, groupEntryId) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");
    if (entry.status === "left") throw new Error("student.alreadyLeft");

    entry.status = "left";
    entry.leftAt = getNow();
    await student.save();

    emit(`client:${clientId}`, "student:leftGroup", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
    });

    return await DTO(student, clientId);
  },

  // Guruhdan guruhga o'tkazish (API_CONTRACT_student_transfer.md §3). Bitta
  // `save()` — yangi a'zolik va eski a'zolikni yopish atomar (avval frontend
  // ikki alohida so'rov yuborardi va birinchisi doim `fillTheRows` bilan
  // yiqilardi). Baho/davomat/to'lov KO'CHIRILMAYDI: yangi a'zolik
  // `transferredFrom` zanjiri orqali ularni ko'radi, balans esa ko'chadi.
  transferGroup: async (clientId, id, groupEntryId, body = {}, actor = null) => {
    const { centerId, groupId, price } = body;
    if (!centerId || !groupId) throw new Error("student.fillTheRows");

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");
    if (entry.status !== "active") throw new Error("student.transferNotActive");
    if (String(entry.group) === String(groupId)) throw new Error("student.transferSameGroup");

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");
    const group = await Group.findOne({ _id: groupId, client: clientId, center: center._id, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.status === "finished") throw new Error("student.groupFinished");

    const alreadyIn = student.groups.some(
      (g) => String(g.group) === String(group._id) && g.status === "active",
    );
    if (alreadyIn) throw new Error("student.alreadyEnrolled");

    const finalPrice =
      price != null && price !== "" ? Number(price) : (await Subject.findById(group.subject))?.price || 0;
    if (!Number.isFinite(finalPrice) || finalPrice < 0) throw new Error("student.invalidPrice");

    const oldGroup = await Group.findById(entry.group).select("status activatedAt finishedAt center days");
    const [oldSetting, newSetting] = await Promise.all([
      billingSettingService.getOrCreate(entry.center),
      billingSettingService.getOrCreate(group.center),
    ]);
    const { surplus, debts } = settleEntry(entry, oldGroup, oldSetting.cycleMode);
    const credits = await joinCreditsOf(group, newSetting.cycleMode);

    const now = getNow();
    student.groups.push({
      group: group._id,
      center: center._id,
      client: clientId,
      subject: group.subject,
      price: finalPrice,
      priceHistory: [{ price: finalPrice, from: 0 }],
      status: "active",
      credits,
      openingDebts: debts,
      openingBalance: surplus,
      transferredFrom: [
        ...(entry.transferredFrom || []).map((s) => ({
          group: s.group,
          entry: s.entry,
          center: s.center,
          from: s.from,
          until: s.until,
        })),
        { group: entry.group, entry: entry._id, center: entry.center, from: entry.joinedAt || 0, until: now },
      ],
    });
    const newEntry = student.groups[student.groups.length - 1];

    entry.status = "left";
    entry.leftAt = now;
    entry.transferredTo = { group: group._id, entry: newEntry._id, at: now };
    await student.save();

    // `maxStudents` — MO'LJAL, `create`dagi kabi jimgina ko'tariladi.
    if (group.maxStudents != null) {
      const activeInGroup = await Student.countDocuments({
        isDeleted: false,
        groups: { $elemMatch: { group: group._id, status: "active" } },
      });
      if (activeInGroup > group.maxStudents) {
        group.maxStudents = activeInGroup;
        await group.save();
      }
    }

    const enrolledPayload = {
      groupId: String(group._id),
      center: String(center._id),
      maxStudents: group.maxStudents ?? null,
      student: {
        _id: student._id,
        fullName: student.fullName,
        phone: student.phone,
        parentPhone: student.parentPhone,
        ...telegramFieldsOf(student),
        photo: student.photo,
      },
      entry: { ...groupEntryDTO(newEntry, group, newSetting.cycleMode), client: newEntry.client },
    };
    emit(`center:${String(center._id)}`, "student:enrolled", enrolledPayload);
    emit(`client:${String(clientId)}`, "student:enrolled", enrolledPayload);
    emit(`client:${clientId}`, "student:leftGroup", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
    });

    void audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "student:transfer",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: {
        fromGroup: String(entry.group),
        toGroup: String(group._id),
        carriedAdvance: surplus,
        carriedDebt: debts.reduce((sum, d) => sum + d.amount, 0),
      },
    });

    return await DTO(student, clientId);
  },

  // "Tushumlar" (Owner) — barcha kirim to'lovlari, har birida KIM qabul
  // qilgani bilan. To'lovlar Student.groups[].payments ichida joylashgani
  // uchun aggregate + ikki bosqichli $unwind orqali yassilanadi. Eski
  // yozuvlarda `collectedBy` yo'q (null) — moliyaviy yozuvlar qayta
  // yozilmaydi (CLAUDE.md), UI ularni "noma'lum" deb ko'rsatadi.
  listRevenue: async (clientId, { page = 1, from = "", to = "", center = "", type = "", collectedBy = "", search = "", status = "" }) => {
    const rows = await buildRevenueRows(clientId, { from, to, center, type, collectedBy, search, status });

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    // "paid" yozuvlar kirim, "cancelled"/"refunded" — emas. Umumiy summa
    // faqat haqiqiy kirimdan yig'iladi.
    const paid = rows.filter((r) => r.status === "paid");
    const totalAmount = paid.reduce((sum, r) => sum + r.amount, 0);

    // "Kim qabul qildi" select'ining variantlari `collectedBy` filtridan
    // MUSTAQIL hisoblanadi — aks holda bitta hodim tanlangач boshqalari
    // ro'yxatdan g'oyib bo'lib qolardi (variantlar har safar `rows`dan, ya'ni
    // ALLAQACHON collectedBy bo'yicha filtrlangan natijadan olinardi).
    // Qolgan filtrlar (qidiruv/filial/sana/tur) esa hurmat qilinadi.
    const collectorRows = collectedBy
      ? await buildRevenueRows(clientId, { from, to, center, type, search, status })
      : rows;
    const paidForCollector = collectedBy ? collectorRows.filter((r) => r.status === "paid") : paid;

    const byCollector = {};
    const byType = {};
    for (const row of paidForCollector) {
      const key = row.collectedBy?.id || "unknown";
      byCollector[key] = byCollector[key] || { id: row.collectedBy?.id || null, name: row.collectedBy?.name || "", role: row.collectedBy?.role || null, amount: 0, count: 0 };
      byCollector[key].amount += row.amount;
      byCollector[key].count += 1;
    }
    for (const row of paid) {
      byType[row.type] = (byType[row.type] || 0) + row.amount;
    }

    return {
      data: rows.slice(skip, skip + PAGE_SIZE),
      totalAmount,
      byCollector: Object.values(byCollector).sort((a, b) => b.amount - a.amount),
      byType,
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total: rows.length,
        totalPages: Math.ceil(rows.length / PAGE_SIZE) || 1,
      },
    };
  },

  exportRevenue: async (clientId, filters) => await buildRevenueRows(clientId, filters),

  // `collector` — to'lovni kim qabul qilgani ({ id, kind }). Controller
  // request'dan uzatadi (Owner bo'lsa req.client, hodim bo'lsa req.staff).
  addPayment: async (clientId, id, groupEntryId, body, collector = null) => {
    const { amount, type, note, forMonth } = body;
    if (!amount || amount <= 0) throw new Error("student.invalidAmount");
    if (type && !["cash", "card", "mixed", "previousMonth"].includes(type))
      throw new Error("student.invalidPaymentType");

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    // Darslar boshlanishidan oldingi oy uchun to'lov olish man etiladi —
    // guruh hali faollashtirilmagan bo'lsa "qaysi oy uchun" tanlanmaydi,
    // faollashtirilgan bo'lsa kurs boshlangan oydan oldingi oy tanlab bo'lmaydi.
    // ISTISNO: shu a'zolikning ko'chirishdan oldingi qarz oylaridan biri
    // (guruh faollashmagan bo'lsa ham) — API_CONTRACT_opening_debts.md §3.3.
    if (forMonth) await assertPayableMonth(entry, forMonth);

    // Qisqa tekshirish kodi — chek QR/linki shunga ishora qiladi
    // (paymentVerify.service.js, receiptPdf.util.js).
    const code = await generateUniqueShortCode((c) =>
      Student.exists({ "groups.payments.code": c }),
    );

    entry.payments.push({
      amount,
      type: type || "cash",
      note: note || "",
      forMonth: forMonth || "",
      status: "paid",
      collectedBy: collector?.id || null,
      collectedByKind: collector?.kind || null,
      code,
    });
    await student.save();

    // Dashboard/Center Detail/Salary/Student Detail — hammasi shu eventni
    // kutib turadi (API_CONTRACT: "payment:created"), realtime yangilanish
    // uchun.
    emit(`client:${clientId}`, "payment:created", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
    });

    // Ota-onaga Telegram xabari — kutilmaydi, xatosi bu yerga chiqmaydi.
    void parentNotification.onPayment({ student, entry, payment: entry.payments[entry.payments.length - 1] });

    return await DTO(student, clientId);
  },

  // To'lovni boshqa oy uchun o'tkazish (API_CONTRACT_payment_move_month.md).
  // Moliyaviy yozuv: summa/sana/tur/qabul qiluvchi/`code` O'ZGARMAYDI — faqat
  // `forMonth` belgisi, eski qiymat `forMonthHistory[]` + Audit Log'da qoladi.
  // Qarzdorlik, foizli oylik va oylik tushum jonli hisoblangani uchun
  // (computeBilling / sumMonthPayments `forMonth || oy(date)`) avtomatik
  // qayta taqsimlanadi — cancelPayment kabi.
  movePaymentMonth: async (clientId, id, groupEntryId, paymentId, body, actor = null) => {
    const forMonth = typeof body?.forMonth === "string" ? body.forMonth.trim() : body?.forMonth;
    if (typeof forMonth !== "string" || !OPENING_MONTH_RE.test(forMonth)) {
      throw new Error("student.openingMonthInvalid");
    }

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    const payment = entry.payments.id(paymentId);
    if (!payment) throw new Error("student.paymentNotFound");
    if (payment.status !== "paid") throw new Error("student.paymentNotMovable");

    // Eski to'lovda `forMonth` bo'sh bo'lishi mumkin — u sana oyi deb
    // talqin qilinadi (taqqoslash uchun), tarixga esa `""` yoziladi.
    const from = payment.forMonth || "";
    if (forMonth === (from || formatMonth(payment.date))) throw new Error("student.paymentSameMonth");

    await assertPayableMonth(entry, forMonth);

    payment.forMonthHistory.push({
      from,
      to: forMonth,
      at: getNow(),
      byId: actor?.id || null,
      byKind: actor?.kind === "staff" ? "staff" : actor?.kind === "client" ? "owner" : null,
    });
    payment.forMonth = forMonth;
    await student.save();

    // Owner `client:*`, Staff `center:*` xonasida (socket.config.js).
    const rooms = [`client:${clientId}`, `center:${String(entry.center)}`];
    const movedPayload = {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
      paymentId: String(paymentId),
      from,
      to: forMonth,
    };
    for (const room of rooms) emit(room, "payment:updated", movedPayload);

    const group = await Group.findById(entry.group);
    if (group) {
      const billingSetting = await billingSettingService.getOrCreate(group.center);
      const payload = {
        groupId: String(entry.group),
        studentId: String(id),
        entry: groupEntryDTO(entry, group, billingSetting?.cycleMode || "anchor"),
      };
      for (const room of rooms) emit(room, "student:priceUpdated", payload);
    }

    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:paymentMonthMoved",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: {
        groupEntryId: String(groupEntryId),
        group: String(entry.group),
        paymentId: String(paymentId),
        code: payment.code || null,
        amount: payment.amount,
        from,
        to: forMonth,
      },
    });

    return await DTO(student, clientId);
  },

  // Moliyaviy yozuv hech qachon o'chirilmaydi — faqat status "cancelled"ga o'zgaradi.
  cancelPayment: async (clientId, id, groupEntryId, paymentId) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    const payment = entry.payments.id(paymentId);
    if (!payment) throw new Error("student.paymentNotFound");
    if (payment.status !== "paid") throw new Error("student.paymentNotCancellable");

    payment.status = "cancelled";
    await student.save();

    emit(`client:${clientId}`, "payment:cancelled", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
      paymentId: String(paymentId),
    });

    void parentNotification.onPayment({ student, entry, payment, cancelled: true });

    return await DTO(student, clientId);
  },
};
