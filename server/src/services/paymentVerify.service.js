const Student = require("../models/Student");
const Center = require("../models/Center");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const { formatDate } = require("../utils/date.util");
const { computeBilling } = require("./student.service");
const billingSettingService = require("./billingSetting.service");

// Guruh nomi hech qayerda saqlanmaydi — bo'lsa qo'lda qo'yilgan `name`,
// bo'lmasa "{fanNomi} - {activeId}" (group.service.js/certificate.service.js
// bilan bir xil naqsh).
const groupLabel = (group, subjectName) => {
  if (!group) return "";
  if (group.name) return group.name;
  const id = group.status === "pending" ? group.pendingId : group.activeId;
  return `${subjectName || "?"} - ${id ?? "?"}`;
};

// Ochiq (auth talab qilmaydigan) chek tekshiruvi — receiptPdf.util.js QR
// kodi shu yerga ishora qiladi (`https://wenet.uz/payment/verify/:id`).
// certificate.service.js#verify bilan bir xil naqsh: faqat ko'rsatish uchun
// matn qaytariladi, hech qanday ichki tenant maxfiyligi oshkor qilinmaydi.
// Payment alohida model emas — Student.groups[].payments[] ichida
// joylashgan (CLAUDE.md "O'quvchi (Student)"), shuning uchun nested-array
// bo'yicha qidiriladi. `id` — YANGI to'lovlarda qisqa `payment.code`,
// ESKI (bu maydon qo'shilishidan oldingi) to'lovlarda esa hamon Mongo
// subdocument `_id`si — ikkalasi ham sinaladi (backward compat).
module.exports = {
  verify: async (id) => {
    let student = await Student.findOne(
      { "groups.payments.code": id },
      { fullName: 1, phone: 1, groups: 1 },
    );
    let matchesPayment = (p) => p.code === id;

    if (!student) {
      student = await Student.findOne(
        { "groups.payments._id": id },
        { fullName: 1, phone: 1, groups: 1 },
      );
      matchesPayment = (p) => String(p._id) === id;
    }
    if (!student) throw new Error("payment.notFound");

    const entry = student.groups.find((g) => g.payments.some(matchesPayment));
    const payment = entry?.payments.find(matchesPayment);
    if (!entry || !payment) throw new Error("payment.notFound");

    const [center, group, subject] = await Promise.all([
      Center.findById(entry.center, { name: 1 }),
      Group.findById(entry.group),
      Subject.findById(entry.subject, { name: 1 }),
    ]);

    let remainingDebt = 0;
    let debtBreakdown = [];
    if (group) {
      const billingSetting = await billingSettingService.getOrCreate(group.center);
      const billing = computeBilling(entry, group, billingSetting.cycleMode);
      remainingDebt = billing.debt;
      debtBreakdown = billing.debtBreakdown;
    }

    return {
      paymentId: payment.code || String(payment._id),
      studentName: student.fullName,
      phone: student.phone,
      centerName: center?.name || "",
      groupName: groupLabel(group, subject?.name),
      subjectName: subject?.name || "",
      amount: payment.amount,
      type: payment.type,
      status: payment.status,
      forMonth: payment.forMonth,
      date: formatDate(payment.date),
      remainingDebt,
      debtBreakdown,
    };
  },
};
