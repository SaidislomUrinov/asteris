const path = require("path");
const sharp = require("sharp");
// "Dekompressiya bombasi"dan himoya: 10MB'li siqilgan PNG ichida 16k×16k
// piksel bo'lishi mumkin (~1GB RAM). 40 megapiksel — har qanday telefon
// kamerasi uchun yetarli (sharp default'i 268M edi).
const MAX_INPUT_PIXELS = 40_000_000;
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
  formatDay,
  todayString,
} = require("../utils/date.util");
const { countLessonDays, listLessonDates } = require("../utils/lessonDays.util");
const billingSettingService = require("./billingSetting.service");
const { cycleRolloverDiscount } = require("../utils/rollover.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { emitArchiveChanged } = require("../utils/archive.util");
const { attachTelegramStatus, emitParentTelegramChanged } = require("../utils/parentTelegram.util");
const { parseAmount } = require("../utils/amount.util");
const {
  applyTelegramFields,
  telegramFieldsOf,
  hasTelegramFields,
  pickTelegramFields,
  telegramFieldsFromImportRow,
} = require("../utils/telegramPhone.util");
const groupHolidayService = require("./groupHoliday.service");
const fileUtil = require("../utils/file.util");
const { photoFor, latestPhoto } = require("../utils/studentPhoto.util");
const { FOLDERS } = require("../configs/folder.config");

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
// O'quvchi rasmi (API_CONTRACT_student_photo.md §2).
const PHOTO_SIZE = 360;
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const PHOTO_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const STUDENT_PHOTO_PREFIX = `/uploads/${FOLDERS.STUDENTS}/`;

// Rasm amallari uchun o'quvchi: shu client'da arxivlanmagan a'zoligi bo'lishi
// shart (Owner uchun yagona tekshiruv — middleware Owner'ni o'tkazib yuboradi).
const findPhotoStudent = async (clientId, id) => {
  if (!Types.ObjectId.isValid(id)) throw new Error("student.notFound");
  const student = await Student.findOne({ _id: id, isDeleted: false });
  if (!student) throw new Error("student.notFound");
  const hasEntry = student.groups.some(
    (g) => String(g.client) === String(clientId) && g.status !== "archived",
  );
  if (!hasEntry) throw new Error("student.notFound");
  return student;
};

// Rasm fayli ref-count bo'yicha o'chiriladi (API_CONTRACT_student_photo_per_client.md):
// element o'zgargandan/olib tashlangandan KEYIN chaqiriladi — hech bir
// hujjat/element bu `path`ni ishlatmasa fayl diskdan o'chadi. Parallel
// holatda ikki jarayon o'chirishga ursa ham `fileUtil.remove` ENOENT'ni
// jim o'tkazadi. Xato asosiy amalni buzmaydi.
const releasePhotoFile = async (oldPath) => {
  try {
    if (!oldPath || !oldPath.startsWith(STUDENT_PHOTO_PREFIX)) return false;
    const inUse = await Student.exists({ "photos.path": oldPath });
    if (inUse) return false;
    return await fileUtil.remove(oldPath);
  } catch (error) {
    console.error("Student photo release error:", error.message);
    return false;
  }
};

// Shu client elementini atomar almashtiradi/yaratadi (bitta pipeline-update):
// boshqa client elementlariga tegilmaydi, shu client'niki (bo'lsa) olib
// tashlanib yangisi qo'shiladi — dublikat element hech qachon paydo bo'lmaydi.
// Qaytaradi: yangilashdan OLDINGI shu client rasmi ("" — yo'q edi), hujjat
// topilmasa `null`.
const upsertClientPhoto = async (studentId, clientId, photoPath) => {
  const client = new Types.ObjectId(String(clientId));
  const previous = await Student.findOneAndUpdate(
    { _id: studentId },
    [
      {
        $set: {
          photos: {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ["$photos", []] },
                  cond: { $ne: ["$$this.client", client] },
                },
              },
              [{ client, path: photoPath, updatedAt: getNow() }],
            ],
          },
        },
      },
    ],
    { returnDocument: "before", projection: { photos: 1 }, updatePipeline: true },
  ).lean();
  if (!previous) return null;
  return photoFor(previous, client);
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

// A'zolik billingi qachondan boshlanadi: odatda guruh `activatedAt`i, lekin
// o'qishni guruhdan OLDIN boshlagan (`startedBeforeGroup`) a'zolikda — uning
// `joinedAt`i (ko'chirilgan markazning o'tgan oylari to'lanishi uchun).
const earlyStartOf = (entry, group) =>
  entry?.startedBeforeGroup &&
  group?.activatedAt &&
  formatDay(entry.joinedAt || 0) < formatDay(group.activatedAt)
    ? entry.joinedAt
    : null;
const billingStartOf = (entry, group) => earlyStartOf(entry, group) ?? group.activatedAt;

// `activatedAt`ga langarlangan sikllardan `t` tushgani — indeksi (`t`
// guruhdan oldin bo'lsa manfiy). Chegaralar doim ASL `activatedAt`dan
// hisoblanadi (31 → 28 → 31 langar siljimasligi uchun).
const anchorIndexAt = (activatedAt, t) => {
  if (t >= activatedAt) return monthsBetween(activatedAt, t);
  let i = -1;
  while (i > -MAX_CYCLES && addMonths(activatedAt, i) > t) i -= 1;
  return i;
};
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

  // Arxivda turgan davrlar (archive.util.js `restoreEntry`) — shu oraliqdagi
  // dars kunlari to'lanmaydi. Ular kredit kabi ayiriladi; shu kunga tushgan
  // kredit esa ikki marta ayirilmasligi uchun hisobga olinmaydi.
  const archivedPeriods = entry.archivedPeriods || [];
  const inArchivedPeriod = (u) => archivedPeriods.some((p) => u >= p.from && u < p.to);
  const archivedDaysIn = (from, to) =>
    archivedPeriods.reduce(
      (sum, p) => sum + countLessonDays(group.days, Math.max(from, p.from), Math.min(to, p.to)),
      0,
    );

  // `basePrice` — shu siklda amalda bo'lgan OYLIK narx (priceHistory bo'yicha,
  // prorata emas). Tahrirlash oynasida o'tgan oylar narxini ko'rsatish uchun
  // (API_CONTRACT_past_cycle_price.md §2); hisob-kitobda `cyclePrice` ishlaydi.
  const addCycle = (cycleStart, cycleEnd, cyclePrice, basePrice = cyclePrice) => {
    // Sikl o'quvchi qo'shilishidan OLDIN tugagan → o'tkazib yuboriladi.
    // `false` qaytariladi: bu "joriy sikl emas" degani, ya'ni tashqi
    // sikl davom etadi va keyingi sikllarga o'tadi.
    if (cycleEnd <= joinedAt) return false;

    const nominalDays = countLessonDays(group.days, cycleStart, cycleEnd);
    const dailyRate = nominalDays > 0 ? cyclePrice / nominalDays : 0;
    const creditCount = credits.filter((c) => {
      const u = dateStringToUnix(c.date);
      return u >= cycleStart && u < cycleEnd && !inArchivedPeriod(u);
    }).length;
    const isCurrent = effectiveNow < cycleEnd;
    const elapsedEnd = isCurrent ? Math.min(effectiveNow, cycleEnd) : cycleEnd;
    const elapsedDaysNominal = isCurrent ? countLessonDays(group.days, cycleStart, elapsedEnd) : nominalDays;
    const archivedFull = archivedDaysIn(cycleStart, cycleEnd);
    const archivedElapsed = isCurrent ? archivedDaysIn(cycleStart, elapsedEnd) : archivedFull;
    const elapsedChargeable = Math.max(0, elapsedDaysNominal - creditCount - archivedElapsed);
    const fullChargeable = Math.max(0, nominalDays - creditCount - archivedFull);
    // Oldingi sikldan "3 kun ketma-ket kelmadi" bilan o'tkazilgan summa —
    // shu siklda chegirma (utils/rollover.util.js).
    const rolloverDiscount = cycleRolloverDiscount(entry, cycleStart, cycleEnd);
    // Sikl o'rtasida qo'shilgan o'quvchida yorliq — QO'SHILGAN oy (avval
    // sikl boshlangan oy edi: 25-sanali guruhga 20-oktabrda qo'shilgan
    // o'quvchining to'lovi "Sentyabr" bo'lib, o'tgan oy tushumi va o'qituvchi
    // oyligiga yozilardi). Shu sabab bir oyda ikki sikl bo'lishi mumkin —
    // allocatePayments buni qo'llaydi, UI esa `from`–`to` oralig'ini ko'rsatadi.
    const billedFrom = Math.max(cycleStart, joinedAt);
    cycles.push({
      month: formatMonth(billedFrom),
      cycleStart,
      cycleEnd,
      billedFrom,
      fullDue: Math.max(0, Math.round(dailyRate * fullChargeable) - rolloverDiscount), // shu sikl uchun JAMI to'lanishi kerak summa
      elapsedDue: Math.max(0, Math.round(dailyRate * elapsedChargeable) - rolloverDiscount), // shu paytgacha HAQIQATDA to'lash SHART bo'lgan qism
      isCurrent,
      dailyRate,
      rolloverDiscount,
      basePrice,
    });
    return isCurrent;
  };

  const earlyStart = earlyStartOf(entry, group);

  if (cycleMode === "calendarMonth") {
    // Guruhdan oldin boshlagan a'zolik — o'sha oy boshidan to'liq sikllar;
    // `joinedAt`gacha bo'lgan kunlar qo'shilish kreditlari bilan ayiriladi.
    const calStart = earlyStart != null ? startOfMonth(earlyStart) : group.activatedAt;
    const daysInActMonth = daysInMonth(calStart);
    const firstCycleDays = daysInActMonth - dayOfMonth(calStart) + 1;
    const firstCyclePriceBase = priceAt(priceHistory, calStart, price);
    const firstCyclePrice = Math.round((firstCyclePriceBase * firstCycleDays) / daysInActMonth);
    const firstCycleEnd = addMonths(startOfMonth(calStart), 1);
    if (addCycle(calStart, firstCycleEnd, firstCyclePrice, firstCyclePriceBase)) return cycles;

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
  const firstIndex = earlyStart != null ? anchorIndexAt(group.activatedAt, earlyStart) : 0;
  for (let i = firstIndex; i < MAX_CYCLES; i++) {
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
    // Guruhdan oldingi sana (o'qishni oldin boshlagan a'zolik) — o'sha oy boshi.
    if (effectiveNow < group.activatedAt) return startOfMonth(effectiveNow);
    const calMonthsElapsed = calendarMonthsBetween(startOfMonth(group.activatedAt), effectiveNow);
    return calMonthsElapsed === 0
      ? group.activatedAt
      : addMonths(startOfMonth(group.activatedAt), calMonthsElapsed);
  }
  return addMonths(group.activatedAt, anchorIndexAt(group.activatedAt, effectiveNow));
};

// Sikl o'rtasida guruhga qo'shilish — shu sikldan hozirgacha o'tgan HAR BIR
// dars kuni uchun bitta kredit (computeBilling joriy sikl to'lovidan shu
// kunlarni ayiradi). `create` va `transferGroup` ikkalasi ishlatadi.
const joinCreditsOf = async (group, cycleMode) => joinCreditsFor(group, cycleMode, getNow());

// `startUnix` tushgan siklning boshidan `startUnix` gacha (kun bo'yicha,
// `startUnix` kuni KIRMAYDI) o'tgan har bir dars kuni uchun bitta kredit —
// o'quvchi shu sanadan o'qiyapti, undan oldingi kunlar uchun to'lamaydi
// (API_CONTRACT_group_month_filter_and_start_date.md §B.1). Bayram
// (to'lanmaydigan) kunlar kredit bo'lmaydi — ular buildCycles'da allaqachon
// hisobdan chiqadi.
const joinCreditsFor = async (group, cycleMode, startUnix) => {
  if (group.status !== "active" || !group.activatedAt) return [];
  const cycleStart = currentCycleStartOf(group, cycleMode, startUnix);
  if (startUnix <= cycleStart) return [];
  const holidayDates = await groupHolidayService.getNonChargeableDates(group._id);
  return listLessonDates(group.days, cycleStart, startUnix, holidayDates).map((date) => ({ date }));
};

const START_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const START_DATE_MAX_BACK_MONTHS = 36;

// "O'qishni boshlagan sana" (`"YYYY-MM-DD"`, Asia/Tashkent) → a'zolikning
// `joinedAt` unix vaqti (§B.1). Guruh `active` bo'lishi shart.
// Sikl chegarasi aynan shu KUNGA tushsa (guruh `activatedAt` vaqti kun
// o'rtasida bo'lishi mumkin — masalan 10:00), `joinedAt` sikl boshiga
// suriladi: aks holda 00:00 oldingi siklga tushib, to'liq kreditlangan
// (0 so'mlik) ortiqcha sikl qatori paydo bo'lardi.
const resolveStartDate = (startDate, group, cycleMode) => {
  if (typeof startDate !== "string" || !START_DATE_RE.test(startDate)) {
    throw new Error("student.startDateInvalid");
  }
  const startUnix = dateStringToUnix(startDate);
  if (!Number.isFinite(startUnix) || formatDay(startUnix) !== startDate) {
    throw new Error("student.startDateInvalid");
  }
  if (group?.status !== "active" || !group.activatedAt) throw new Error("student.startDateUnavailable");
  if (startDate > todayString()) throw new Error("student.startDateFuture");
  // Guruh boshlanishidan oldingi sana ham mumkin (yangi ulangan markazda eski
  // o'quvchilar) — faqat xato kiritilgan juda eski sanadan himoya.
  if (startUnix < addMonths(group.activatedAt, -START_DATE_MAX_BACK_MONTHS)) {
    throw new Error("student.startDateTooOld");
  }

  const dayEnd = addDays(startUnix, 1) - 1;
  const cycleStart = currentCycleStartOf(group, cycleMode, dayEnd);
  return cycleStart > startUnix ? cycleStart : startUnix;
};

// PATCH .../start-date kreditlari (§B.3): eski qo'shilish kreditlari (eski
// `joinedAt` kunidan oldingi) va yangi sanadan oldingi kreditlar tushadi,
// keyingi davomat/bayram kreditlari qoladi; ustiga yangi qo'shilish
// kreditlari, sana bo'yicha dublikatsiz. Sof funksiya.
const mergeStartCredits = (credits, oldDay, newDay, joinCredits) => {
  const keepFrom = oldDay > newDay ? oldDay : newDay;
  const byDate = new Map();
  for (const c of credits || []) if (c?.date && c.date >= keepFrom) byDate.set(c.date, { date: c.date });
  for (const c of joinCredits || []) byDate.set(c.date, { date: c.date });
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};

// computeBilling taqsimot natijasidan oy kesimidagi jadval (§A.1): sikllar +
// oyi ma'lum opening qarz qatorlari, bir oyga tushgan qatorlar yig'iladi.
// Sof funksiya.
const billingMonthsOf = (allocated) => {
  const byMonth = new Map();
  for (const item of allocated || []) {
    if (!item.month) continue; // oyi noma'lum opening — umumiy `debt`da qoladi
    if (item.kind !== "cycle" && item.kind !== "opening") continue;
    const row = byMonth.get(item.month) || {
      month: item.month,
      due: 0,
      paid: 0,
      debt: 0,
      isCurrent: false,
      from: null,
      to: null,
    };
    row.due += item.fullDue || 0;
    row.paid += item.paid || 0;
    if (item.kind === "cycle") {
      if (item.isCurrent) row.isCurrent = true;
      // Haqiqiy davr (2-bosqich C): "sanadan-sanaga" rejimida oy yorlig'i
      // kalendar oyiga to'g'ri kelmaydi — UI shu oraliqni ko'rsatadi.
      const from = item.billedFrom ?? item.cycleStart;
      if (row.from === null || from < row.from) row.from = from;
      if (row.to === null || item.cycleEnd > row.to) row.to = item.cycleEnd;
    }
    byMonth.set(item.month, row);
  }
  return [...byMonth.values()]
    .map((r) => ({ ...r, debt: Math.max(0, r.due - r.paid) }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
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
  checkPayableMonth(forMonth, openingMonths, group?.activatedAt ? formatMonth(billingStartOf(entry, group)) : null);
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

  // Bir oyda bir nechta sikl bo'lishi mumkin (o'rtada qo'shilgandagi qisqa
  // sikl + shu oyda boshlangan to'liq sikl) — `forMonth` ularning hammasini
  // tartib bilan yopadi.
  const cycleByMonth = new Map();
  const openingByMonth = new Map();
  for (const item of items) {
    if (item.kind === "cycle") {
      if (!cycleByMonth.has(item.month)) cycleByMonth.set(item.month, []);
      cycleByMonth.get(item.month).push(item);
    }
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
      for (const item of cycleByMonth.get(p.forMonth) || []) left = applyTo(item, left);
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

// A'zolik qachon tugagan: guruhdan chiqqan (`leftAt`) yoki arxivlangan
// (`archivedAt`; chiqqandan keyin arxivlangan bo'lsa — `leftAt`). Faol
// a'zolikda `null`.
const membershipEndOf = (entry) => {
  if (entry?.status === "left") return entry.leftAt || null;
  if (entry?.status === "archived") {
    if (entry.statusBeforeArchive === "left") return entry.leftAt || entry.archivedAt || null;
    return entry.archivedAt || null;
  }
  return null;
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
    const allocatedOpening = allocatePayments([], payments, openingItems, advance);
    const openingRows = openingRowsOf(allocatedOpening);
    return {
      paidAmount,
      ...openingFields(openingRows),
      debt: sumDebt(openingRows),
      currentMonthDue: 0,
      paidForCurrentCycle: 0,
      debtBreakdown: openingRows.filter((r) => r.debt > 0),
      priceCycles: [],
      // Faqat oyi ma'lum opening qatorlari (§A.1).
      billingMonths: billingMonthsOf(allocatedOpening),
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
      priceCycles: [],
      billingMonths: [],
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
  const groupNow = group.status === "finished" && group.finishedAt ? group.finishedAt : getNow();
  // O'quvchi guruhdan chiqqan/arxivlangan bo'lsa — hisob o'sha paytda
  // to'xtaydi (avval `leftAt` e'tiborsiz qolib, chiqib ketgan o'quvchiga har
  // oy yangi qarz yozilardi). Oxirgi sikl faqat o'tgan dars kunlari bo'yicha.
  const membershipEnd = membershipEndOf(entry);
  const endedEarly = membershipEnd != null && membershipEnd < groupNow;
  const effectiveNow = endedEarly ? membershipEnd : groupNow;

  // Faollashtirilgan, lekin darslar boshlanishi kelajakdagi sanaga
  // belgilangan bo'lsa — o'sha sana kelmagunicha sikl qarzdorligi yo'q.
  const billingStart = billingStartOf(entry, group);
  if (effectiveNow < billingStart) {
    return withoutCycles({
      currentCyclePrice: entry.price || 0,
      courseStartMonth: formatMonth(billingStart),
      currentCycleMonth: formatMonth(billingStart),
      nextDueDate: addMonths(group.activatedAt, 1),
    });
  }

  const builtCycles = buildCycles(entry, group, cycleMode, effectiveNow);
  const allocated = allocatePayments(
    endedEarly ? builtCycles.map((c) => (c.isCurrent ? { ...c, fullDue: c.elapsedDue } : c)) : builtCycles,
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
    from: c.billedFrom, // to'lanadigan oraliq — bir oyda ikki qator bo'lsa ajratish uchun
    to: c.cycleEnd,
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
    // Har sikl (o'tgan + joriy) amaldagi oylik narxi — o'tgan oy narxini
    // tahrirlash uchun (API_CONTRACT_past_cycle_price.md §2).
    priceCycles: cycles.map((c) => ({
      cycleStart: c.cycleStart,
      from: c.billedFrom,
      to: c.cycleEnd,
      month: c.month,
      price: c.basePrice,
      due: c.fullDue,
      paid: c.paid,
      isCurrent: c.isCurrent,
    })),
    // Oy kesimida due/paid/debt — Guruh detali oy filtri (§A.1).
    billingMonths: billingMonthsOf(allocated),
    courseStartMonth: formatMonth(billingStart),
    currentCycleMonth: current.month,
    // A'zolik tugagan — keyingi to'lov sanasi yo'q.
    nextDueDate: membershipEnd != null ? null : current.cycleEnd,
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
    if (effectiveNow >= billingStartOf(entry, group)) {
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
    // Individual (1 kishilik yashirin) guruh a'zoligi — API_CONTRACT_individual_students.md.
    isIndividual: group?.kind === "individual",
    // "Alohida foiz" (API_CONTRACT_entry_teacher_percent.md) — teacher/assistant
    // uchun controller'da (teacherView.stripEntry) `null`ga almashtiriladi.
    teacherPercent: entry.teacherPercent ?? null,
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
    ? await Group.find({ _id: { $in: groupIds } }).select("status activatedAt finishedAt center days kind")
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
    photo: photoFor(student, clientId),
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

// O'quvchilar ro'yxati (API_CONTRACT_individual_students.md §2): kamida bitta
// FAOL a'zoligi individual guruhda bo'lsa `isIndividual: true` va o'sha
// guruh o'qituvchisi ismi (tooltip uchun). DTO'lar joyida to'ldiriladi —
// o'qituvchilar BITTA so'rovda.
const attachIndividualInfo = async (dtos) => {
  const groupOf = new Map();
  for (const dto of dtos) {
    const entry = (dto.groups || []).find((g) => g.isIndividual && g.status === "active");
    dto.isIndividual = !!entry;
    dto.individualTeacher = null;
    if (entry) groupOf.set(dto, String(entry.group));
  }
  if (!groupOf.size) return;

  const groups = await Group.find({ _id: { $in: [...new Set(groupOf.values())] } }).select("teacher").lean();
  const teacherOfGroup = Object.fromEntries(groups.map((g) => [String(g._id), g.teacher ? String(g.teacher) : null]));
  const teacherIds = [...new Set(Object.values(teacherOfGroup).filter(Boolean))];
  const teachers = teacherIds.length ? await Staff.find({ _id: { $in: teacherIds } }).select("name").lean() : [];
  const nameOf = Object.fromEntries(teachers.map((t) => [String(t._id), t.name]));
  for (const [dto, groupId] of groupOf) dto.individualTeacher = nameOf[teacherOfGroup[groupId]] || null;
};

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
        // Guruhdan chiqqanlarning to'lanmagan qarzi ham umumiy qarzga kiradi
        // (u undirilishi kerak) — joriy sikl donutiga esa faqat faollar.
        (g.status === "active" || g.status === "left"),
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
    if (entry.status !== "active") return acc;
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

// O'zbekiston raqami — frontend maskasi bilan bir xil format (`+998XXXXXXXXX`).
// Avval tahrirda format umuman tekshirilmasdi ("abc" saqlanib qolardi).
const STUDENT_PHONE_RE = /^\+998\d{9}$/;

// O'quvchi hujjati platforma bo'ylab UMUMIY (telefon bo'yicha yagona) — bir
// necha mijoz (client) uni birga ishlatadi. Telefon, ota-ona raqami va
// Telegram raqamlari ota-onaga xabar/WebApp kirishini belgilaydi, shuning
// uchun boshqa mijozda ham FAOL a'zoligi bo'lsa ularni bitta mijoz yolg'iz
// o'zgartira olmaydi (QA 2026-10-02: begona markaz o'quvchisini
// `existingStudentId` bilan biriktirib, ota-ona raqamini o'ziniki qilib
// almashtirish mumkin edi).
const sharedWithOtherClients = (student, clientId) =>
  (student.groups || []).some((g) => String(g.client) !== String(clientId) && g.status !== "archived");

const CONTACT_FIELDS = [
  "phone",
  "parentPhone",
  "telegramSame",
  "telegramPhone",
  "parentTelegramSame",
  "parentTelegramPhone",
];
const changesSharedContact = (student, body) =>
  CONTACT_FIELDS.some((f) => body[f] !== undefined && String(body[f] ?? "") !== String(student[f] ?? ""));

// `student:updated` — o'quvchi tegishli BARCHA markaz va clientlarga xabar
// beriladi (bir o'quvchi bir nechta centerda o'qishi mumkin — CLAUDE.md
// "15 tagacha markaz"). `client:{clientId}` ham qo'shiladi, chunki Client
// Owner socket ulanishida centerId yo'q (socket.config.js) — faqat
// `center:*` xonalariga yuborilsa Owner hech qachon ololmaydi.
// `update` va rasm amallari uchun umumiy; DTO qaytaradi.
// Rasm client darajasida (API_CONTRACT_student_photo_per_client.md) — payload
// HAR client uchun o'z `photo`si bilan quriladi va faqat o'sha client'ning
// `client:{id}` + uning `center:{id}` xonalariga ketadi. `onlyClient` — rasm
// o'zgarishi: faqat `clientId` xonalariga (boshqa tenant'ga hech narsa ketmaydi).
const emitStudentUpdated = async (student, clientId, { onlyClient = false } = {}) => {
  const dto = await attachTelegramStatus(await DTO(student, clientId));

  const centersByClient = new Map();
  for (const g of student.groups || []) {
    const cId = String(g.client);
    if (onlyClient && cId !== String(clientId)) continue;
    if (!centersByClient.has(cId)) centersByClient.set(cId, new Set());
    centersByClient.get(cId).add(String(g.center));
  }
  const base = {
    studentId: String(student._id),
    fullName: student.fullName,
    phone: student.phone,
    parentPhone: student.parentPhone,
    ...telegramFieldsOf(student),
    parentTelegram: dto.parentTelegram,
    studentTelegram: dto.studentTelegram,
  };
  for (const [cId, centerIds] of centersByClient) {
    const payload = { ...base, photo: photoFor(student, cId) };
    centerIds.forEach((centerId) => emit(`center:${centerId}`, "student:updated", payload));
    emit(`client:${cId}`, "student:updated", payload);
  }

  return dto;
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
  _internal: { buildCycles, billingMonthsOf, joinCreditsFor, resolveStartDate, mergeStartCredits },

  // Telefon raqam bo'yicha global directory qidiruvi — Student hujjati
  // tenant'lararo yagona bo'lgani uchun (CLAUDE.md "telefon asosida yagona
  // hujjat"), boshqa markaz/mijozda allaqachon mavjud odam bo'lsa ham ismi
  // topiladi. Faqat identifikatsiya maydonlari qaytadi — groups[] (boshqa
  // tenant'ning markaz/guruh/narx/to'lov ma'lumoti) hech qachon chiqmaydi.
  // Endi Student.phone UNIQUE emas (API_CONTRACT.md §2 — bitta ota-ona
  // raqami bir nechta farzand uchun ishlatilishi mumkin), shuning uchun
  // qidiruv BIRTA emas, mos kelgan hujjatlar RO'YXATINI qaytaradi. Frontend
  // bo'sh massivni "yangi o'quvchi" deb talqin qiladi.
  // Telefon bo'yicha mavjud o'quvchini topish (qo'shish formasida qayta
  // ishlatish uchun). Boshqa mijoz o'quvchisi uchun faqat tanlashga yetarli
  // minimum (id, ism, rasm) — ota-ona raqami va Telegram raqamlari BERILMAYDI.
  lookupByPhone: async (phone, clientId) => {
    const trimmed = typeof phone === "string" ? phone.trim() : "";
    if (!trimmed) return [];

    // FAQAT shu mijoz o'quvchilari (docs/API_CONTRACT_student_per_client.md §2):
    // boshqa brend o'quvchisining ismi/rasmi hech qachon ko'rinmaydi.
    const students = await Student.find({ client: clientId, phone: trimmed, isDeleted: false }).select(
      "fullName phone parentPhone photos telegramSame telegramPhone parentTelegramSame parentTelegramPhone",
    );

    return students.map((student) => ({
      _id: student._id,
      fullName: student.fullName,
      parentPhone: student.parentPhone,
      ...telegramFieldsOf(student),
      photo: photoFor(student, clientId),
    }));
  },

  // Yangi o'quvchi yaratadi YOKI (agar shu telefon raqam bilan hujjat
  // allaqachon mavjud bo'lsa) mavjud hujjatga yangi guruh bog'lanishini
  // qo'shadi — CLAUDE.md "O'quvchi — telefon raqam asosida yagona hujjat".
  create: async (clientId, body, actor = null) => {
    const { fullName, phone, parentPhone, centerId, groupId, price, existingStudentId, startDate } = body;
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
    // Individual guruh — BITTA o'quvchi: a'zosi (har qanday holatda — arxiv/
    // chiqqan ham) bor bo'lsa ikkinchisi qo'shilmaydi, aks holda arxivdan
    // qaytarishda bitta guruhda ikki faol a'zo paydo bo'lardi (maxStudents'dan
    // farqli, bu QAT'IY cheklov).
    if (group.kind === "individual") {
      const occupied = await Student.exists({ isDeleted: false, "groups.group": group._id });
      if (occupied) throw new Error("individual.occupied");
    }

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
      // Hujjat SHU mijozniki bo'lishi shart (o'quvchi mijoz darajasida).
      student = await Student.findOne({ _id: existingStudentId, client: clientId, isDeleted: false });
      if (!student) throw new Error("student.notFound");
      // Telefon mos kelishi SHART — aks holda ID'ni bilgan har kim istalgan
      // (boshqa markazdagi) o'quvchini o'z guruhiga biriktira olardi.
      if (student.phone !== trimmedPhone) throw new Error("student.notFound");

      const alreadyIn = student.groups.some(
        (g) => String(g.group) === String(group._id) && g.status === "active",
      );
      if (alreadyIn) throw new Error("student.alreadyEnrolled");
    } else {
      if (!fullName) throw new Error("student.fillTheRows");
      if (!STUDENT_PHONE_RE.test(trimmedPhone)) throw new Error("student.invalidPhone");
      student = new Student({
        client: clientId,
        phone: trimmedPhone,
        fullName: fullName.trim(),
        parentPhone: parentPhone || "",
      });
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

    // Boshqa mijozda ham faol o'qiydigan o'quvchining umumiy maydonlari
    // (ism, ota-ona raqami, Telegram) bu yerda TEGILMAYDI — o'quvchi faqat
    // guruhga qo'shiladi (`sharedWithOtherClients` izohiga qarang).
    const contactLocked = !student.isNew && sharedWithOtherClients(student, clientId);
    if (fullName && !student.isNew && !contactLocked) student.fullName = fullName.trim();
    const telegramBefore = student.isNew ? null : telegramFieldsOf(student);
    if (parentPhone !== undefined && !contactLocked) student.parentPhone = parentPhone || "";
    // Telegram raqamlari (API_CONTRACT_telegram_phone.md §1) — parentPhone
    // bilan bir xil siyosat: yuborilgan maydonlar mavjud hujjatga ham
    // qo'llanadi, `*Same` bo'lsa telefon o'zgarishi bilan qayta sinxronlanadi.
    if (!contactLocked) applyTelegramFields(student, body, { isNew: student.isNew });

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
    // Ixtiyoriy "o'qishni boshlagan sana" (§B.2) — faqat faol guruhda;
    // pending guruhda e'tiborsiz (sikllar hali boshlanmagan).
    // Darslar kelajakda boshlanadigan (activatedAt > hozir) guruh ham shu
    // toifada — sikl hali yo'q, `startDate` ma'nosiz.
    const hasStartDate =
      startDate != null &&
      startDate !== "" &&
      group.status === "active" &&
      !!group.activatedAt &&
      group.activatedAt <= getNow();
    const startUnix = hasStartDate ? resolveStartDate(startDate, group, billingSetting.cycleMode) : null;
    const credits =
      startUnix != null
        ? await joinCreditsFor(group, billingSetting.cycleMode, startUnix)
        : await joinCreditsOf(group, billingSetting.cycleMode);

    student.groups.push({
      ...(startUnix != null
        ? { joinedAt: startUnix, startedBeforeGroup: formatDay(startUnix) < formatDay(group.activatedAt) }
        : {}),
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

    // Boshqa client'ning o'quvchisi qo'shildi va shu client'da rasm elementi
    // yo'q — eng so'nggi rasm nusxasi (API_CONTRACT_student_photo_per_client.md).
    // Atomar va ref-count bilan xavfsiz: `photos.path` sharti — nusxa faqat
    // fayl hali shu hujjatda ishlatilayotgan bo'lsa yoziladi (aks holda
    // parallel o'chirish faylni allaqachon o'chirgan bo'lishi mumkin).
    if (existingStudentId && !photoFor(student, clientId)) {
      const source = latestPhoto(student);
      if (source) {
        const copy = { client: new Types.ObjectId(String(clientId)), path: source, updatedAt: getNow() };
        const res = await Student.updateOne(
          { _id: student._id, "photos.client": { $ne: copy.client }, "photos.path": source },
          { $push: { photos: copy } },
        );
        if (res.modifiedCount) student.photos.push(copy);
      }
    }

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
        photo: photoFor(student, clientId),
      },
      entry: {
        ...groupEntryDTO(entry, group, billingSetting.cycleMode),
        client: entry.client,
      },
    };
    emit(`center:${String(center._id)}`, "student:enrolled", enrolledPayload);
    emit(`client:${String(clientId)}`, "student:enrolled", enrolledPayload);
    void audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "student:create",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: { groupId: String(group._id), price: entry.price, existing: Boolean(existingStudentId) },
    });

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
    const { centerId, groupId, rows, startDate } = body;
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
          // O'qishni boshlagan sana (2-bosqich E): qator qiymati ustun, aks
          // holda butun import uchun umumiy sana; validatsiya create()'da.
          startDate: row.startDate || startDate || undefined,
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
    // `payments: { $size: 0 }` — yuqoridagi tekshiruv bilan shu qator ORASIDA
    // to'lov qo'shilib qolgan bo'lsa ham, to'lovli a'zolik hech qachon
    // o'chirilmaydi (moliyaviy yozuv o'chmaydi — CLAUDE.md).
    await Student.updateMany(
      { "groups.importBatch": batch._id },
      { $pull: { groups: { importBatch: batch._id, payments: { $size: 0 } } } },
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
      // Chiqib ketgan, lekin qarzini to'lamagan o'quvchi ham "Qarzdorlar"da.
      const hasDebt = (s) => s.groups.some((g) => (g.status === "active" || g.status === "left") && (g.debt || 0) > 0);
      const filtered = dtos.filter((s) => (debtStatus === "debtor" ? hasDebt(s) : !hasDebt(s)));
      await Promise.all([attachTelegramStatus(filtered), attachIndividualInfo(filtered)]);

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
    await Promise.all([attachTelegramStatus(dtos), attachIndividualInfo(dtos)]);

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
      // Chiqib ketgan, lekin qarzini to'lamagan o'quvchi ham "Qarzdorlar"da.
      const hasDebt = (s) => s.groups.some((g) => (g.status === "active" || g.status === "left") && (g.debt || 0) > 0);
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
  // tahrirlash (API_CONTRACT.md §1). fullName/phone/parentPhone dan kamida
  // bittasi kelishi shart, faqat kelgan maydonlar yangilanadi. `photo` bu yerda
  // QABUL QILINMAYDI — faqat PUT/DELETE /:id/photo orqali (sharp + eski faylni
  // o'chirish); aks holda ixtiyoriy satr yozilib, eski fayl diskda yetim qolardi.
  update: async (clientId, id, body, actor = null) => {
    const { fullName, phone, parentPhone } = body || {};
    if (
      fullName === undefined &&
      phone === undefined &&
      parentPhone === undefined &&
      !hasTelegramFields(body)
    ) {
      throw new Error("student.fillTheRows");
    }

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const hasAccess = student.groups.some((g) => String(g.client) === String(clientId));
    if (!hasAccess) throw new Error("student.notFound");

    if (fullName !== undefined && typeof fullName !== "string") throw new Error("student.invalidName");
    if (phone !== undefined && typeof phone !== "string") throw new Error("student.invalidPhone");
    if (parentPhone !== undefined && parentPhone !== null && typeof parentPhone !== "string") {
      throw new Error("student.invalidPhone");
    }
    if (sharedWithOtherClients(student, clientId) && changesSharedContact(student, body)) {
      throw new Error("student.sharedContactLocked");
    }

    // Telegram raqamlari o'zgarishdan OLDINGI holat (badge eventi uchun).
    const telegramBefore = telegramFieldsOf(student);
    const auditBefore = {
      fullName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      ...telegramBefore,
    };

    if (fullName !== undefined) {
      const trimmedName = fullName.trim();
      if (trimmedName.length < 2) throw new Error("student.invalidName");
      student.fullName = trimmedName;
    }
    if (phone !== undefined) {
      const trimmedPhone = (phone || "").trim();
      if (!STUDENT_PHONE_RE.test(trimmedPhone)) throw new Error("student.invalidPhone");
      student.phone = trimmedPhone;
    }
    if (parentPhone !== undefined) {
      const trimmedParent = (parentPhone || "").trim();
      if (trimmedParent && !STUDENT_PHONE_RE.test(trimmedParent)) throw new Error("student.invalidPhone");
      student.parentPhone = trimmedParent;
    }
    // phone/parentPhone YUQORIDA o'rnatilgan — `*Same` bo'lsa qayta sinxronlanadi.
    applyTelegramFields(student, body, { isNew: false });

    await student.save();
    emitTelegramDiff(telegramBefore, telegramFieldsOf(student));
    const auditChanges = audit.diff(auditBefore, {
      fullName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      ...telegramFieldsOf(student),
    });
    if (auditChanges.length) {
      void audit.log({
        actor,
        client: clientId,
        action: "student:update",
        entity: { type: "student", id: student._id, label: student.fullName },
        changes: auditChanges,
      });
    }

    // Socket + DTO — `emitStudentUpdated` (barcha markaz/client xonalari).
    return await emitStudentUpdated(student, clientId);
  },

  // PUT /students/:id/photo (API_CONTRACT_student_photo.md §2–4). Doira
  // (filial/guruh) `requireStudentPhoto` da tekshirilgan; bu yerda — tenant.
  // Avval yangi fayl yoziladi, hujjat saqlanadi, SO'NG eski fayl o'chiriladi.
  setPhoto: async (clientId, id, file, actor = null) => {
    if (!file || Array.isArray(file) || !Buffer.isBuffer(file.data) || !file.data.length) {
      throw new Error("student.photoRequired");
    }
    const ext = path.extname(file.name || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (!PHOTO_MIME_TYPES.includes(mime) && !PHOTO_EXTENSIONS.includes(ext)) {
      throw new Error("student.photoInvalid");
    }

    const student = await findPhotoStudent(clientId, id);

    // Haqiqiy tekshiruv — sharp dekodlay olishi (kengaytmaga ishonilmaydi).
    let buffer;
    try {
      buffer = await sharp(file.data, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
        .webp({ quality: 70, effort: 6 })
        .toBuffer();
    } catch {
      throw new Error("student.photoInvalid");
    }

    const photo = await fileUtil.saveBuffer(buffer, FOLDERS.STUDENTS, ".webp");
    // Faqat SHU client elementi (API_CONTRACT_student_photo_per_client.md) —
    // atomar almashtirish, eski qiymat aynan shu yozuvdan olinadi (parallel
    // yuklashlarda yetim fayl qolmaydi). Boshqa client rasmi o'zgarmaydi.
    let oldPhoto;
    try {
      oldPhoto = await upsertClientPhoto(student._id, clientId, photo);
    } catch (error) {
      void fileUtil.remove(photo); // hujjat saqlanmadi — yetim fayl qolmasin
      throw error;
    }
    if (oldPhoto === null) {
      void fileUtil.remove(photo);
      throw new Error("student.notFound");
    }
    // Ref-count: eski fayl boshqa client/hujjatda ishlatilmasa o'chadi.
    if (oldPhoto && oldPhoto !== photo) await releasePhotoFile(oldPhoto);

    const client = new Types.ObjectId(String(clientId));
    student.photos = [
      ...(student.photos || []).filter((p) => String(p.client) !== String(clientId)),
      { client, path: photo, updatedAt: getNow() },
    ];

    void audit.log({
      actor,
      client: clientId,
      action: "student:photo",
      entity: { type: "student", id: student._id, label: student.fullName },
      changes: [{ field: "photo", from: oldPhoto, to: photo }],
    });
    await emitStudentUpdated(student, clientId, { onlyClient: true });
    return { _id: student._id, photo };
  },

  // DELETE /students/:id/photo — faqat shu client rasmi olib tashlanadi;
  // fayl ref-count bo'yicha (boshqa client ishlatayotgan bo'lsa qoladi).
  removePhoto: async (clientId, id, actor = null) => {
    const student = await findPhotoStudent(clientId, id);
    const client = new Types.ObjectId(String(clientId));
    // Atomar — eski qiymat shu yozuvning o'zidan (setPhoto bilan bir xil sabab).
    const previous = await Student.findOneAndUpdate(
      { _id: student._id, "photos.client": client },
      { $pull: { photos: { client } } },
      { returnDocument: "before", projection: { photos: { $elemMatch: { client } } } },
    ).lean();
    const oldPhoto = previous ? photoFor(previous, client) : "";
    if (previous) {
      student.photos = (student.photos || []).filter((p) => String(p.client) !== String(clientId));
      if (oldPhoto) await releasePhotoFile(oldPhoto);
      void audit.log({
        actor,
        client: clientId,
        action: "student:photo",
        entity: { type: "student", id: student._id, label: student.fullName },
        changes: [{ field: "photo", from: oldPhoto, to: "" }],
      });
      await emitStudentUpdated(student, clientId, { onlyClient: true });
    }
    return { _id: student._id, photo: "" };
  },

  // O'qituvchi/yordamchi uchun kontakt tahriri (API_CONTRACT_student_contact_telegram.md
  // §2) — faqat `fullName`, `phone`, `parentPhone`; qolgan maydonlar (`photo` va
  // h.k.) jimgina tashlanadi. Validatsiya/socket/DTO — `update` ning o'zi.
  updateContact: async (clientId, id, body = {}, actor = null) => {
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
    }, actor);
  },

  // `cycleStart` berilsa — narx FAQAT shu o'tgan (yopilgan) sikl uchun
  // o'zgaradi (API_CONTRACT_past_cycle_price.md). Berilmasa — avvalgidek
  // joriy sikldan boshlab.
  updateGroupPrice: async (clientId, id, groupEntryId, price, actor = null, cycleStart = null) => {
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0 || price > 1e12) {
      throw new Error("student.invalidPrice");
    }
    if (cycleStart !== null && cycleStart !== undefined && (typeof cycleStart !== "number" || !Number.isInteger(cycleStart))) {
      throw new Error("student.invalidCycle");
    }

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
    let oldPrice;
    let auditMeta = { groupId: String(entry.group) };
    if (cycleStart !== null && cycleStart !== undefined) {
      // O'tgan sikl: shu sikl boshidan yangi narx, keyingi sikl boshidan esa
      // o'sha paytgacha amalda bo'lgan narx qaytadi — keyingi oylar va
      // joriy narx (`entry.price`) o'zgarmaydi. Sikl ro'yxati computeBilling
      // bilan bir xil manbadan (joriy va kelajak sikllar qabul qilinmaydi).
      const { priceCycles = [] } = computeBilling(entry, group, billingSetting?.cycleMode || "anchor");
      const cycle = priceCycles.find((c) => c.cycleStart === cycleStart && !c.isCurrent);
      if (!cycle) throw new Error("student.invalidCycle");
      const nextPrice = priceAt(entry.priceHistory, cycle.to, entry.price);
      oldPrice = cycle.price;
      entry.priceHistory = [
        ...entry.priceHistory.filter((h) => h.from < cycle.cycleStart || h.from > cycle.to),
        { price, from: cycle.cycleStart },
        { price: nextPrice, from: cycle.to },
      ].sort((a, b) => a.from - b.from);
      auditMeta = { ...auditMeta, cycleStart: cycle.cycleStart, month: cycle.month };
    } else {
      const now = getNow();
      const effectiveNow =
        group?.status === "finished" && group.finishedAt ? group.finishedAt : now;
      const from =
        group && effectiveNow >= group.activatedAt
          ? currentCycleStartOf(group, billingSetting?.cycleMode || "anchor", effectiveNow)
          : now;
      oldPrice = entry.price;
      entry.priceHistory.push({ price, from });
      entry.price = price;
    }
    await student.save();
    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:priceChanged",
      entity: { type: "student", id: student._id, label: student.fullName },
      changes: [{ field: "price", from: oldPrice, to: price }],
      meta: auditMeta,
    });

    // Narx o'zgarishi Guruh detail/Students ro'yxatida ochiq turgan boshqa
    // sahifalarga HAM realtime yetib borishi kerak (StudentEditDialog
    // orqali tahrirlash — attendance:marked bilan bir xil naqsh).
    if (group) {
      const pricePayload = {
        groupId: String(entry.group),
        studentId: String(id),
        entry: groupEntryDTO(entry, group, billingSetting.cycleMode),
      };
      emit(`client:${clientId}`, "student:priceUpdated", pricePayload);
      emit(`center:${String(entry.center)}`, "student:priceUpdated", pricePayload);
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

  // PATCH /students/:id/groups/:groupEntryId/start-date — "o'qishni
  // boshlagan sana"ni tahrirlash (API_CONTRACT_group_month_filter_and_start_date.md
  // §B.3). `joinedAt` va qo'shilish kreditlari qayta yoziladi; to'lovlar,
  // opening va narx tarixi tegilmaydi. Javob — yangilangan groupEntryDTO.
  updateStartDate: async (clientId, id, groupEntryId, body = {}, actor = null) => {
    const startDate = body?.startDate;
    if (typeof startDate !== "string" || !START_DATE_RE.test(startDate)) {
      throw new Error("student.startDateInvalid");
    }

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");
    if (entry.status !== "active") throw new Error("student.entryNotActive");

    const group = await Group.findById(entry.group);
    if (!group) throw new Error("group.notFound");
    const billingSetting = await billingSettingService.getOrCreate(group.center);
    const cycleMode = billingSetting?.cycleMode || "anchor";

    const startUnix = resolveStartDate(startDate, group, cycleMode);
    const oldDay = formatDay(entry.joinedAt || 0);
    const newDay = formatDay(startUnix);

    const joinCredits = await joinCreditsFor(group, cycleMode, startUnix);
    entry.credits = mergeStartCredits(entry.credits, oldDay, newDay, joinCredits);
    entry.joinedAt = startUnix;
    entry.startedBeforeGroup = formatDay(startUnix) < formatDay(group.activatedAt);
    await student.save();

    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:startDate",
      entity: { type: "student", id: student._id, label: student.fullName },
      changes: [{ field: "startDate", from: oldDay, to: newDay }],
      meta: { groupEntryId: String(groupEntryId), group: String(entry.group) },
    });

    const dto = groupEntryDTO(entry, group, cycleMode);
    // GroupDetail narx/opening tahriridagi kabi shu event bilan `entry`ni
    // refetchsiz almashtiradi. Owner `client:*`, Staff `center:*` xonasida.
    const payload = { groupId: String(entry.group), studentId: String(id), entry: dto };
    emit(`client:${clientId}`, "student:priceUpdated", payload);
    emit(`center:${String(entry.center)}`, "student:priceUpdated", payload);

    return dto;
  },

  // PATCH /students/:id/groups/:groupEntryId/teacher-percent — "Alohida foiz"
  // (API_CONTRACT_entry_teacher_percent.md §2). O'quvchi guruhda qoladi, faqat
  // shu a'zolik to'lovlari o'qituvchi oyligiga alohida foiz bilan hisoblanadi
  // (salary.service.js `customPercentOf`). `null` — alohida foizni olib tashlash.
  updateTeacherPercent: async (clientId, id, groupEntryId, body = {}, actor = null) => {
    const raw = body?.teacherPercent;
    let percent = null;
    if (raw !== null) {
      percent = typeof raw === "number" ? raw : NaN;
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error("individual.invalidPercent");
      }
    }

    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");
    if (entry.status !== "active") throw new Error("entryPercent.notActive");

    const group = await Group.findById(entry.group).select("kind teacher center");
    if (!group) throw new Error("group.notFound");
    // Individual guruhda `Group.teacherPercent` ishlaydi (API_CONTRACT_individual_students.md).
    if (group.kind === "individual") throw new Error("entryPercent.individualGroup");

    const from = entry.teacherPercent ?? null;
    if (from !== percent) {
      entry.teacherPercent = percent;
      await student.save();

      void audit.log({
        actor,
        client: clientId,
        center: entry.center,
        action: "student:teacherPercent",
        entity: { type: "student", id: student._id, label: student.fullName },
        changes: [{ field: "teacherPercent", from, to: percent }],
        meta: { groupId: String(entry.group), groupEntryId: String(groupEntryId), from, to: percent },
      });

      const payload = {
        studentId: String(student._id),
        groupId: String(entry.group),
        groupEntryId: String(groupEntryId),
        teacherPercent: percent,
      };
      emit(`client:${clientId}`, "student:teacherPercent", payload);
      emit(`center:${String(entry.center)}`, "student:teacherPercent", payload);
      if (group.teacher) emit(`client:${clientId}`, "salary:updated", { staff: String(group.teacher) });
    }

    return { groupEntryId: String(groupEntryId), teacherPercent: percent };
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
      groupId: String(entry.group),
      center: String(entry.center),
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

  leaveGroup: async (clientId, id, groupEntryId, actor = null) => {
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
      groupId: String(entry.group),
      center: String(entry.center),
    });
    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "student:leftGroup",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: { groupId: String(entry.group) },
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
    // Individual guruhga o'tkazib bo'lmaydi — u faqat o'z o'quvchisi bilan yaratiladi.
    const group = await Group.findOne({
      _id: groupId,
      client: clientId,
      center: center._id,
      isDeleted: false,
      kind: { $ne: "individual" },
    });
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
        photo: photoFor(student, clientId),
      },
      entry: { ...groupEntryDTO(newEntry, group, newSetting.cycleMode), client: newEntry.client },
    };
    emit(`center:${String(center._id)}`, "student:enrolled", enrolledPayload);
    emit(`client:${String(clientId)}`, "student:enrolled", enrolledPayload);
    emit(`client:${clientId}`, "student:leftGroup", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
      groupId: String(entry.group),
      center: String(entry.center),
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
  addPayment: async (clientId, id, groupEntryId, body, collector = null, actor = null) => {
    const { type, note, forMonth } = body || {};
    const amount = parseAmount(body?.amount);
    if (!amount) throw new Error("student.invalidAmount");
    if (note != null && typeof note !== "string") throw new Error("student.invalidAmount");
    if (forMonth != null && typeof forMonth !== "string") throw new Error("student.invalidMonth");
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
    // `center`/`groupId` — emitter hodisani hodimlarga FILIAL xonasi orqali
    // yetkazadi (`client:` xonasida faqat Owner bor).
    const created = entry.payments[entry.payments.length - 1];
    emit(`client:${clientId}`, "payment:created", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
      groupId: String(entry.group),
      center: String(entry.center),
    });
    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "payment:create",
      entity: { type: "payment", id: created._id, label: student.fullName },
      meta: { amount, type: created.type, forMonth: created.forMonth, code, studentId: String(id) },
    });

    // Ota-onaga Telegram xabari — kutilmaydi, xatosi bu yerga chiqmaydi.
    void parentNotification.onPayment({ student, entry, payment: created });

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
  cancelPayment: async (clientId, id, groupEntryId, paymentId, actor = null) => {
    const student = await Student.findOne({ _id: id, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    const entry = findClientGroupEntry(student, clientId, groupEntryId);
    if (!entry) throw new Error("student.groupEntryNotFound");

    const payment = entry.payments.id(paymentId);
    if (!payment) throw new Error("student.paymentNotFound");
    if (payment.status !== "paid") throw new Error("student.paymentNotCancellable");

    payment.status = "cancelled";
    payment.cancelledAt = getNow();
    payment.cancelledBy = actor?.id || null;
    payment.cancelledByKind = actor?.kind === "client" ? "owner" : actor?.kind || null;
    await student.save();

    emit(`client:${clientId}`, "payment:cancelled", {
      studentId: String(id),
      groupEntryId: String(groupEntryId),
      paymentId: String(paymentId),
      groupId: String(entry.group),
      center: String(entry.center),
    });
    void audit.log({
      actor,
      client: clientId,
      center: entry.center,
      action: "payment:cancel",
      entity: { type: "payment", id: payment._id, label: student.fullName },
      meta: { amount: payment.amount, forMonth: payment.forMonth, code: payment.code || null, studentId: String(id) },
    });

    void parentNotification.onPayment({ student, entry, payment, cancelled: true });

    return await DTO(student, clientId);
  },
};
