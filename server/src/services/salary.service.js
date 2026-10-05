const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Student = require("../models/Student");
const SalaryTransaction = require("../models/SalaryTransaction");
const emit = require("../utils/emitter.util");
const { getNow, currentMonthString } = require("../utils/date.util");
const clientService = require("./client.service");
const { salaryTypeKeyOf, SALARY_TYPE_TARIFF_FLAG } = require("../utils/staffPermission.util");
const { paymentSalaryDelta, rolloverSalaryDelta } = require("../utils/salaryMonth.util");
const audit = require("../utils/audit.util");
const { parseAmount } = require("../utils/amount.util");

// Tranzaksiya turi → shu turni ochadigan tarif flagi (faqat premium
// turlar uchun; withdrawal/penalty har doim ochiq).
const TX_TARIFF_FLAG = {
  advance: "staff.salary.advance",
  bonus: "staff.bonus",
};

// Hodimning OYLIK TURI Staff.permissions ichidagi "staff.salary.*" kaliti
// bilan belgilanadi (StaffDialog shu formatda yozadi). Bu satrlar tarif
// flaglari bilan bir xil — farqi staffPermission.util.js da izohlangan.
const SALARY_FLAGS = {
  "staff.salary.fixed": "fixed",
  "staff.salary.percentage": "percentage",
};

const salaryTypeOf = (staff) => {
  const key = salaryTypeKeyOf(staff.permissions);
  return key ? SALARY_FLAGS[key] : null;
};

const txDTO = (t) => ({
  _id: t._id,
  staff: t.staff,
  month: t.month,
  type: t.type,
  amount: t.amount,
  note: t.note,
  status: t.status,
  date: t.date,
});

// Hodim qamrovidagi guruhlar: O'qituvchi va YORDAMCHI o'qituvchi — faqat
// o'zi biriktirilgan guruhlar, Reception — markazdagi BARCHA guruhlar
// (feedback: center-wide).
const scopedGroupFilter = (staff) => {
  const filter = { client: staff.client, center: staff.center, isDeleted: false };
  if (staff.role === "teacher") filter.teacher = staff._id;
  if (staff.role === "assistant") filter.assistant = staff._id;
  return filter;
};

// Berilgan oy uchun qamrovdagi guruhlarga tushgan to'lovlar yig'indisi.
// To'lov qaysi oyga tegishliligi: forMonth ko'rsatilgan bo'lsa o'sha,
// aks holda to'lov sanasining oyi (Asia/Tashkent) — LEKIN yopilgan (o'tgan)
// oy orqaga o'zgarmaydi: kech to'lov/bekor qilish/oy ko'chirish voqea
// sodir bo'lgan oyga yoziladi (utils/salaryMonth.util.js).
const sumMonthPayments = async (groupIds, month) => {
  if (!groupIds.length) return 0;

  const students = await Student.find(
    { "groups.group": { $in: groupIds } },
    { groups: 1 },
  );

  const idSet = new Set(groupIds.map(String));
  let total = 0;

  for (const student of students) {
    for (const entry of student.groups) {
      if (!idSet.has(String(entry.group))) continue;
      for (const p of entry.payments) total += paymentSalaryDelta(p, month);
      // "3 kun ketma-ket kelmadi → keyingi oyga o'tkazish" (CLAUDE.md Ish haqi):
      // o'tkazilgan summa shu oydan ayiriladi, keyingi oyga qo'shiladi.
      for (const r of entry.rollovers || []) total += rolloverSalaryDelta(r, month);
    }
  }

  return Math.max(0, total);
};

// Bitta hodimning bitta oy uchun jonli hisob-kitobi.
// `features` — joriy tarif flaglari (bitta so'rovda bir marta olinadi).
const computeStaffMonth = async (staff, month, features = null) => {
  const type = salaryTypeOf(staff);
  const typeKey = salaryTypeKeyOf(staff.permissions);
  // Tarif pasaygandan keyin hodimda qolib ketgan (endi tarifda yo'q) oylik
  // turi: hisob TO'XTATILMAYDI (hodim ishlagan oy uchun pul qarz), lekin UI
  // "tarifda yo'q" deb ogohlantirishi va turni o'zgartirishni taklif qilishi
  // uchun bayroq qaytariladi. Yangi berish staff.service'da bloklangan.
  const salaryTypeInTariff =
    !typeKey || !features ? true : features.includes(SALARY_TYPE_TARIFF_FLAG[typeKey]);
  let base = 0;
  let meta = {};

  if (type === "fixed") {
    base = staff.salaryValue || 0;
  } else if (type === "percentage") {
    const groups = await Group.find(scopedGroupFilter(staff), { _id: 1 });
    const paymentsTotal = await sumMonthPayments(groups.map((g) => g._id), month);
    base = Math.round((paymentsTotal * (staff.salaryValue || 0)) / 100);
    meta = { paymentsTotal, percent: staff.salaryValue || 0 };
  }

  const transactions = await SalaryTransaction.find({
    staff: staff._id,
    month,
  }).sort({ createdAt: -1 });

  const sums = { advance: 0, withdrawal: 0, bonus: 0, penalty: 0 };
  for (const t of transactions) {
    if (t.status === "active") sums[t.type] += t.amount;
  }

  const final = base - sums.advance - sums.withdrawal + sums.bonus - sums.penalty;

  return {
    staff: {
      _id: staff._id,
      name: staff.name,
      role: staff.role,
      salaryValue: staff.salaryValue,
    },
    month,
    salaryType: type,
    salaryTypeInTariff,
    base,
    ...meta,
    advance: sums.advance,
    withdrawal: sums.withdrawal,
    bonus: sums.bonus,
    penalty: sums.penalty,
    final,
    transactions: transactions.map(txDTO),
  };
};

module.exports = {
  // Markaz bo'yicha barcha hodimlarning oylik xulosasi (Owner/Manager ko'rinishi)
  summary: async (clientId, { month = "", center = "" }) => {
    const m = month || currentMonthString();
    const filter = { client: clientId, isDeleted: false };
    if (center) filter.center = center;

    const staffs = await Staff.find(filter).sort({ createdAt: -1 });
    const features = await clientService.getTariffFeatures(clientId);
    const data = await Promise.all(staffs.map((s) => computeStaffMonth(s, m, features)));

    return { month: m, data };
  },

  // Bitta hodimning batafsil hisobi (hodim o'zinikini ham ko'ra oladi)
  // `centerId` — hodim so'raganda o'z filiali bilan cheklanadi (boshqa filial
  // hodimi `staff.notFound`); Owner uchun null.
  detail: async (clientId, staffId, { month = "" }, centerId = null) => {
    const staff = await Staff.findOne({
      _id: staffId,
      client: clientId,
      isDeleted: false,
      ...(centerId && { center: centerId }),
    });
    if (!staff) throw new Error("staff.notFound");

    const features = await clientService.getTariffFeatures(clientId);
    return computeStaffMonth(staff, month || currentMonthString(), features);
  },

  // Avans / oldindan pul olish / bonus / jarima qo'shish
  addTransaction: async (clientId, staffId, body, centerId = null, actor = null) => {
    const { type, note, month } = body || {};
    if (!SalaryTransaction.TYPES.includes(type)) throw new Error("salary.invalidType");
    const amount = parseAmount(body?.amount);
    if (!amount) throw new Error("salary.invalidAmount");
    if (note != null && typeof note !== "string") throw new Error("salary.invalidAmount");

    const tariffFlag = TX_TARIFF_FLAG[type];
    if (tariffFlag && !(await clientService.hasPermission(clientId, tariffFlag))) {
      throw new Error("tariff.featureNotAvailable");
    }

    const staff = await Staff.findOne({
      _id: staffId,
      client: clientId,
      isDeleted: false,
      ...(centerId && { center: centerId }),
    });
    if (!staff) throw new Error("staff.notFound");

    const tx = await SalaryTransaction.create({
      client: clientId,
      center: staff.center,
      staff: staff._id,
      month: month || currentMonthString(),
      type,
      amount,
      note: note?.trim() || "",
    });

    emit(`client:${clientId}`, "salary:updated", { staff: String(staff._id), month: tx.month });
    void audit.log({
      actor,
      client: clientId,
      center: staff.center,
      // admin lang fayllaridagi mavjud kalit nomlari bilan bir xil (salary:withdraw).
      action: type === "withdrawal" ? "salary:withdraw" : `salary:${type}`,
      entity: { type: "salary", id: tx._id, label: staff.name },
      meta: { amount: tx.amount, month: tx.month, staffId: String(staff._id) },
    });

    return txDTO(tx);
  },

  // Tranzaksiyani bekor qilish — hujjat o'chirilmaydi, faqat status o'zgaradi.
  // Avans (advance) bundan mustasno: hodimga pul allaqachon qo'lma-qo'l
  // berib bo'lingan haqiqiy voqea, tizimda "bekor qilish" real hayotda pulni
  // orqaga qaytarmaydi — shu sabab avans hech qachon bekor qilinmaydi.
  cancelTransaction: async (clientId, txId, centerId = null, actor = null) => {
    const tx = await SalaryTransaction.findOne({
      _id: txId,
      client: clientId,
      ...(centerId && { center: centerId }),
    });
    if (!tx) throw new Error("salary.txNotFound");
    if (tx.type === "advance") throw new Error("salary.advanceNotCancellable");
    if (tx.status === "cancelled") throw new Error("salary.alreadyCancelled");

    tx.status = "cancelled";
    tx.cancelledAt = getNow();
    await tx.save();

    emit(`client:${clientId}`, "salary:updated", { staff: String(tx.staff), month: tx.month });
    void audit.log({
      actor,
      client: clientId,
      center: tx.center,
      action: "salary:cancel",
      entity: { type: "salary", id: tx._id, label: tx.type },
      meta: { amount: tx.amount, month: tx.month, staffId: String(tx.staff) },
    });

    return txDTO(tx);
  },
};
