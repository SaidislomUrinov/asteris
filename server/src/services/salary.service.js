const Staff = require("../models/Staff");
const Group = require("../models/Group");
const Student = require("../models/Student");
const SalaryTransaction = require("../models/SalaryTransaction");
const emit = require("../utils/emitter.util");
const { getNow, currentMonthString, formatMonth } = require("../utils/date.util");

// Hodimning oylik turi Staff.permissions ichidagi "staff.salary.*" flag'i
// bilan belgilanadi (StaffDialog shu formatda yozadi).
const SALARY_FLAGS = {
  "staff.salary.fixed": "fixed",
  "staff.salary.percentage": "percentage",
  "staff.salary.perGroup": "perGroup",
};

const salaryTypeOf = (staff) => {
  const flag = (staff.permissions || []).find((p) => SALARY_FLAGS[p]);
  return flag ? SALARY_FLAGS[flag] : null;
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
// aks holda to'lov sanasining oyi (Asia/Tashkent).
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
      for (const p of entry.payments) {
        if (p.status !== "paid") continue;
        const payMonth = p.forMonth || formatMonth(p.date);
        if (payMonth === month) total += p.amount;
      }
    }
  }

  return total;
};

// Bitta hodimning bitta oy uchun jonli hisob-kitobi.
const computeStaffMonth = async (staff, month) => {
  const type = salaryTypeOf(staff);
  let base = 0;
  let meta = {};

  if (type === "fixed") {
    base = staff.salaryValue || 0;
  } else if (type === "perGroup") {
    // salaryValue = har bir guruh uchun yagona stavka
    const count = await Group.countDocuments({ ...scopedGroupFilter(staff), status: "active" });
    base = (staff.salaryValue || 0) * count;
    meta = { groupCount: count, ratePerGroup: staff.salaryValue || 0 };
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
    const data = await Promise.all(staffs.map((s) => computeStaffMonth(s, m)));

    return { month: m, data };
  },

  // Bitta hodimning batafsil hisobi (hodim o'zinikini ham ko'ra oladi)
  detail: async (clientId, staffId, { month = "" }) => {
    const staff = await Staff.findOne({ _id: staffId, client: clientId, isDeleted: false });
    if (!staff) throw new Error("staff.notFound");

    return computeStaffMonth(staff, month || currentMonthString());
  },

  // Avans / oldindan pul olish / bonus / jarima qo'shish
  addTransaction: async (clientId, staffId, body) => {
    const { type, amount, note, month } = body;
    if (!SalaryTransaction.TYPES.includes(type)) throw new Error("salary.invalidType");
    if (!amount || amount < 1) throw new Error("salary.invalidAmount");

    const staff = await Staff.findOne({ _id: staffId, client: clientId, isDeleted: false });
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

    return txDTO(tx);
  },

  // Tranzaksiyani bekor qilish — hujjat o'chirilmaydi, faqat status o'zgaradi.
  // Avans (advance) bundan mustasno: hodimga pul allaqachon qo'lma-qo'l
  // berib bo'lingan haqiqiy voqea, tizimda "bekor qilish" real hayotda pulni
  // orqaga qaytarmaydi — shu sabab avans hech qachon bekor qilinmaydi.
  cancelTransaction: async (clientId, txId) => {
    const tx = await SalaryTransaction.findOne({ _id: txId, client: clientId });
    if (!tx) throw new Error("salary.txNotFound");
    if (tx.type === "advance") throw new Error("salary.advanceNotCancellable");
    if (tx.status === "cancelled") throw new Error("salary.alreadyCancelled");

    tx.status = "cancelled";
    tx.cancelledAt = getNow();
    await tx.save();

    emit(`client:${clientId}`, "salary:updated", { staff: String(tx.staff), month: tx.month });

    return txDTO(tx);
  },
};
