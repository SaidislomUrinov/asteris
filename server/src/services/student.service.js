const { Types } = require("mongoose");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Client = require("../models/Client");
const Group = require("../models/Group");
const Center = require("../models/Center");
const Subject = require("../models/Subject");
const BillingSetting = require("../models/BillingSetting");
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
const emit = require("../utils/emitter.util");
const groupHolidayService = require("./groupHoliday.service");

const PAGE_SIZE = 50;

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
    if (entry.from <= unix && (result === null || entry.from > result.from)) result = entry;
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

  const addCycle = (cycleStart, cycleEnd, cyclePrice) => {
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
    cycles.push({
      month: formatMonth(cycleStart),
      cycleStart,
      cycleEnd,
      fullDue: Math.round(dailyRate * fullChargeable), // shu sikl uchun JAMI to'lanishi kerak summa
      elapsedDue: Math.round(dailyRate * elapsedChargeable), // shu paytgacha HAQIQATDA to'lash SHART bo'lgan qism
      isCurrent,
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

// To'lovlarni sikllarga taqsimlaydi. Avval har bir to'lov o'zining
// `forMonth` (agar shu sikllar orasida mos sikl bo'lsa) ustiga to'g'ridan-
// to'g'ri yoziladi — foydalanuvchi "aynan shu oy uchun" to'lasa, o'sha oy
// oldingi qarzlar to'liq yopilmagan bo'lsa ham ustuvor qoplanadi. Shu
// sikldan ORTIB qolgan qism (yoki `forMonth` ko'rsatilmagan/mos sikl
// topilmagan to'lovlar) umumiy "havzaga" tushadi va FIFO tartibida (eng
// eskisidan boshlab) qolgan sikllarning qoldig'iga taqsimlanadi — shu bilan
// forMonth'siz eski to'lovlar ilgarigidek ishlayveradi.
const allocatePayments = (cycles, payments) => {
  const cycleByMonth = new Map(cycles.map((c) => [c.month, c]));
  const labeledPaid = new Map();
  let pool = 0;
  for (const p of payments) {
    if (p.status !== "paid") continue;
    if (p.forMonth && cycleByMonth.has(p.forMonth)) {
      labeledPaid.set(p.forMonth, (labeledPaid.get(p.forMonth) || 0) + p.amount);
    } else {
      pool += p.amount;
    }
  }

  const withLabelPaid = cycles.map((c) => {
    const labeled = labeledPaid.get(c.month) || 0;
    const paid = Math.min(c.fullDue, labeled);
    pool += labeled - paid; // shu oy uchun ortib qolgan qism umumiy havzaga o'tadi
    return { ...c, paid };
  });

  let remaining = pool;
  return withLabelPaid.map((c) => {
    const due = c.fullDue - c.paid;
    const extra = Math.min(due, remaining);
    remaining -= extra;
    return { ...c, paid: c.paid + extra };
  });
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
  const paidAmount = (entry.payments || [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  // Guruh hali yig'ilmoqda (pending) yoki hali faollashtirilmagan bo'lsa
  // hech qanday sikl boshlanmagan — qarzdorlik yo'q, faqat avans (kredit).
  if (group?.status === "pending" || !group?.activatedAt) {
    return {
      paidAmount,
      debt: 0,
      currentMonthDue: 0,
      currentCyclePrice: 0,
      paidForCurrentCycle: 0,
      debtBreakdown: [],
      courseStartMonth: null,
      currentCycleMonth: null,
      nextDueDate: null,
    };
  }

  // Yakunlangan guruhda hisoblash "finishedAt" paytida to'xtaydi — kurs
  // tugagach yangi sikl boshlanavermaydi.
  const effectiveNow = group.status === "finished" && group.finishedAt ? group.finishedAt : getNow();

  // Faollashtirilgan, lekin darslar boshlanishi kelajakdagi sanaga
  // belgilangan bo'lsa (masalan bugun activlashtirib, dushanbadan
  // boshlansin deyilgan) — o'sha sana kelmagunicha hali qarzdorlik yo'q.
  if (effectiveNow < group.activatedAt) {
    return {
      paidAmount,
      debt: 0,
      currentMonthDue: 0,
      currentCyclePrice: entry.price || 0,
      paidForCurrentCycle: 0,
      debtBreakdown: [],
      courseStartMonth: formatMonth(group.activatedAt),
      currentCycleMonth: formatMonth(group.activatedAt),
      nextDueDate: addMonths(group.activatedAt, 1),
    };
  }

  const cycles = allocatePayments(
    buildCycles(entry, group, cycleMode, effectiveNow),
    entry.payments || [],
  );
  const current = cycles[cycles.length - 1];
  const pastCycles = cycles.slice(0, -1);

  // Joriy sikl uchun "hozir to'lash SHART bo'lgan" qism — faqat O'TGAN
  // kunlar uchun (adolatli undirish/eslatma uchun, PaymentDialog'dagi kichik
  // eslatma matni shundan foydalanadi).
  const currentMonthDue = Math.max(0, current.elapsedDue - Math.min(current.elapsedDue, current.paid));

  // "Qarzdorliklar: Ko'rish" ro'yxati — qarzi bor HAR BIR oy (o'tganlar HAM,
  // joriy oy HAM — "Bu oy uchun" ustuni qarzdor ko'rsatsa, shu ro'yxatda ham
  // ko'rinishi kerak, aks holda "Umumiy qarzdorlik" > 0 bo'lsa-yu ro'yxat
  // bo'sh chiqib qolardi).
  const currentCycleRemaining = Math.max(0, current.fullDue - current.paid);
  const debtBreakdown = [...pastCycles, current]
    .map((c) => ({ month: c.month, due: c.fullDue, paid: c.paid, debt: Math.max(0, c.fullDue - c.paid) }))
    .filter((c) => c.debt > 0);

  const pastDebtTotal = pastCycles.reduce((sum, c) => sum + Math.max(0, c.fullDue - c.paid), 0);
  // "Umumiy qarzdorlik" — joriy sikl uchun ham TO'LIQ (elapsed emas)
  // qoldiq hisobga olinadi, chunki "Bu oy uchun: to'langan/jami" ustuni,
  // qarzdorlik chip va donut chart — ularning barchasi allaqachon
  // `currentCyclePrice - paidForCurrentCycle` (to'liq sikl qoldig'i)
  // asosida ishlaydi. Avval bu yerda faqat `currentMonthDue` (elapsed-based,
  // odatda kichikroq yoki 0) qo'shilgani uchun "Bu oy uchun" qarzdor
  // ko'rsatsa ham "Umumiy qarzdorlik" "Qarzi yo'q" chiqib qolardi.
  const debt = pastDebtTotal + currentCycleRemaining;

  return {
    paidAmount,
    debt, // umumiy qarzdorlik — o'tgan barcha sikllar + joriy sikldan hozirgacha
    currentMonthDue,
    currentCyclePrice: current.fullDue, // joriy sikl uchun to'lanishi kerak bo'lgan JAMI summa — "to'langan/jami" ko'rsatish uchun
    paidForCurrentCycle: current.paid, // shundan TO'LIQ sikl bo'yicha qanchasi to'langan (oldindan to'lovlarni ham hisobga oladi)
    debtBreakdown, // [{month, due, paid, debt}] — faqat qarzi bor O'TGAN oylar (joriy oy alohida ko'rsatiladi)
    courseStartMonth: formatMonth(group.activatedAt),
    currentCycleMonth: current.month,
    nextDueDate: current.cycleEnd,
  };
};

// Faqat SHU clientga tegishli guruh yozuvlari ko'rsatiladi — boshqa
// tenant'larning bog'lanishlari (Student hujjati umumiy bo'lgani uchun)
// hech qachon frontendga oqib chiqmaydi.
const groupEntryDTO = (entry, group, cycleMode) => {
  const billing = computeBilling(entry, group, cycleMode);

  return {
    _id: entry._id,
    group: entry.group,
    center: entry.center,
    subject: entry.subject,
    price: entry.price,
    status: entry.status,
    groupStatus: group?.status || null,
    joinedAt: entry.joinedAt,
    leftAt: entry.leftAt,
    ...billing,
    payments: (entry.payments || []).map((p) => ({
      _id: p._id,
      amount: p.amount,
      type: p.type,
      status: p.status,
      note: p.note,
      forMonth: p.forMonth,
      date: p.date,
    })),
  };
};

// `centerId` berilsa (Staff kontekstida — tenantAuth `req.centerScope`ni
// o'rnatadi) faqat O'SHA filialdagi guruh-yozuvlari qaytadi. CLAUDE.md:
// "Har markaz faqat o'ziga tegishli o'quvchilarni ko'radi" — bir o'quvchi
// bir nechta filialda o'qishi mumkin, shuning uchun tenant filtri yetarli
// emas. Owner uchun bo'sh qoladi (barcha filiallar ko'rinadi).
const DTO = async (student, clientId, centerId = "") => {
  const groups = (student.groups || []).filter(
    (g) =>
      String(g.client) === String(clientId) &&
      (!centerId || String(g.center) === String(centerId)),
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
    staffIds.length ? Staff.find({ _id: { $in: [...new Set(staffIds)] } }, { fullName: 1, role: 1 }) : [],
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
    return { id: String(row.collectedBy), name: staff?.fullName || "", role: staff?.role || "staff" };
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

module.exports = {
  DTO,
  centerBillingTotals,

  // Telefon raqam bo'yicha global directory qidiruvi — Student hujjati
  // tenant'lararo yagona bo'lgani uchun (CLAUDE.md "telefon asosida yagona
  // hujjat"), boshqa markaz/mijozda allaqachon mavjud odam bo'lsa ham ismi
  // topiladi. Faqat identifikatsiya maydonlari qaytadi — groups[] (boshqa
  // tenant'ning markaz/guruh/narx/to'lov ma'lumoti) hech qachon chiqmaydi.
  lookupByPhone: async (phone) => {
    const trimmed = (phone || "").trim();
    if (!trimmed) return { exists: false };

    const student = await Student.findOne({ phone: trimmed, isDeleted: false }).select(
      "fullName parentPhone photo",
    );
    if (!student) return { exists: false };

    return {
      exists: true,
      fullName: student.fullName,
      parentPhone: student.parentPhone,
      photo: student.photo,
    };
  },

  // Yangi o'quvchi yaratadi YOKI (agar shu telefon raqam bilan hujjat
  // allaqachon mavjud bo'lsa) mavjud hujjatga yangi guruh bog'lanishini
  // qo'shadi — CLAUDE.md "O'quvchi — telefon raqam asosida yagona hujjat".
  create: async (clientId, body) => {
    const { fullName, phone, parentPhone, centerId, groupId, price } = body;
    if (!phone || !centerId || !groupId) throw new Error("student.fillTheRows");

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

    if (group.maxStudents != null) {
      const activeCount = await Student.countDocuments({
        groups: { $elemMatch: { group: group._id, status: "active" } },
      });
      if (activeCount >= group.maxStudents) throw new Error("student.groupFull");
    }

    const trimmedPhone = phone.trim();
    let student = await Student.findOne({ phone: trimmedPhone, isDeleted: false });

    if (student) {
      const alreadyIn = student.groups.some(
        (g) => String(g.group) === String(group._id) && g.status === "active",
      );
      if (alreadyIn) throw new Error("student.alreadyEnrolled");
    } else {
      if (!fullName) throw new Error("student.fillTheRows");
      student = new Student({ phone: trimmedPhone, fullName: fullName.trim(), parentPhone: parentPhone || "" });
    }

    if (fullName && !student.isNew) student.fullName = fullName.trim();
    if (parentPhone !== undefined) student.parentPhone = parentPhone || "";

    const finalPrice = price != null ? price : (await Subject.findById(group.subject))?.price || 0;
    if (finalPrice < 0) throw new Error("student.invalidPrice");

    // Guruh allaqachon faol bo'lsa (sikl o'rtasida qo'shilmoqda) — shu
    // sikldan hozirgacha o'tkazib yuborilgan HAR BIR dars kuni uchun bitta
    // kredit yoziladi (computeBilling joriy sikl to'lovidan shu kunlar
    // sonini avtomatik ayiradi — "o'quvchi o'tgan darslar uchun to'lamaydi").
    const credits = [];
    if (group.status === "active" && group.activatedAt) {
      const now = getNow();
      const [billingSetting, holidayDates] = await Promise.all([
        billingSettingService.getOrCreate(group.center),
        groupHolidayService.getNonChargeableDates(group._id),
      ]);
      const currentCycleStart = currentCycleStartOf(group, billingSetting.cycleMode, now);
      const missedDates = listLessonDates(group.days, currentCycleStart, now, holidayDates);
      missedDates.forEach((date) => credits.push({ date }));
    }

    student.groups.push({
      group: group._id,
      center: center._id,
      client: clientId,
      subject: group.subject,
      price: finalPrice,
      priceHistory: [{ price: finalPrice, from: 0 }],
      status: "active",
      credits,
    });

    await student.save();

    // O'quvchi guruhga qo'shildi — o'qituvchi/yordamchi panelidagi
    // "o'quvchilar soni" realtime yangilansin.
    emit(`client:${clientId}`, "student:enrolled", {
      groupId: String(group._id),
      studentId: String(student._id),
      center: String(center._id),
    });

    return await DTO(student, clientId);
  },

  list: async (
    clientId,
    { page = 1, search = "", center = "", group = "", status = "", debtStatus = "" },
  ) => {
    const elemMatch = { client: clientId };
    if (center) elemMatch.center = center;
    if (group) elemMatch.group = group;
    if (status && ["active", "left"].includes(status)) elemMatch.status = status;

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

      return {
        data: filtered,
        meta: { page: 1, limit: filtered.length, total: filtered.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Student.countDocuments(filter),
    ]);

    return {
      data: await Promise.all(data.map((s) => DTO(s, clientId, center))),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
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
    if (status && ["active", "left"].includes(status)) elemMatch.status = status;

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

    return await DTO(student, clientId, centerId);
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

  update: async (clientId, id, body) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const hasAccess = student.groups.some((g) => String(g.client) === String(clientId));
    if (!hasAccess) throw new Error("student.notFound");

    if (body.fullName) student.fullName = body.fullName.trim();
    if (body.parentPhone !== undefined) student.parentPhone = body.parentPhone || "";

    await student.save();
    return await DTO(student, clientId);
  },

  updateGroupPrice: async (clientId, id, groupEntryId, price) => {
    if (price == null || price < 0) throw new Error("student.invalidPrice");

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    if (!entry.priceHistory || entry.priceHistory.length === 0) {
      // Eski (tarixsiz) yozuvlar uchun: boshlang'ich narx "azaldan" amal
      // qilgan deb hisoblanadi (from:0) — aks holda mid-sikl qo'shilgan
      // o'quvchida joinedAt joriy sikl boshlanishidan KEYIN bo'lishi mumkin
      // va priceAt hech qanday yozuvni topmay, joriy (yangi) narxni NOTO'G'RI
      // orqaga qo'llab yuboradi.
      entry.priceHistory = [{ price: entry.price, from: 0 }];
    }
    entry.priceHistory.push({ price, from: getNow() });
    entry.price = price;
    await student.save();
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

    const byCollector = {};
    const byType = {};
    for (const row of paid) {
      const key = row.collectedBy?.id || "unknown";
      byCollector[key] = byCollector[key] || { id: row.collectedBy?.id || null, name: row.collectedBy?.name || "", role: row.collectedBy?.role || null, amount: 0, count: 0 };
      byCollector[key].amount += row.amount;
      byCollector[key].count += 1;
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
    if (forMonth) {
      const group = await Group.findById(entry.group).select("activatedAt");
      if (!group?.activatedAt) throw new Error("student.forMonthBeforeStart");
      if (forMonth < formatMonth(group.activatedAt)) throw new Error("student.forMonthBeforeStart");
    }

    entry.payments.push({
      amount,
      type: type || "cash",
      note: note || "",
      forMonth: forMonth || "",
      status: "paid",
      collectedBy: collector?.id || null,
      collectedByKind: collector?.kind || null,
    });
    await student.save();

    // Dashboard/Center Detail/Salary/Student Detail — hammasi shu eventni
    // kutib turadi (API_CONTRACT: "payment:created"), realtime yangilanish
    // uchun.
    emit(`client:${clientId}`, "payment:created", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
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

    return await DTO(student, clientId);
  },
};
