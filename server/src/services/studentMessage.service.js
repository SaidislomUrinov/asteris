// O'quvchi profilidan SMS/Telegram xabar — docs/API_CONTRACT_profile_test_and_student_notify.md §2.
// Reusable servis: Telegram — `bot/notify.js` sendToChat + 20s Redis cooldown
// (group.service.js `broadcast` bilan bir xil parent-topish naqshi).
// SMS — `sms.service.js` mavjud shablon/balans/getsms zanjiri (`sendToStudent`),
// cooldown YO'Q.
const { isValidObjectId } = require("mongoose");
const Student = require("../models/Student");
const smsService = require("./sms.service");
const redis = require("../configs/redis.config");

const COOLDOWN_SEC = 20;
const cooldownKey = (studentId) => `studentMsgCooldown:${studentId}`;

// Tenant-scoped: shu client'ga tegishli (aktiv a'zolik) o'quvchi, aks holda
// topilmadi xatosi (student.service.js'dagi boshqa funksiyalar bilan bir
// xil xato kodi). `centerId` berilsa (hodim) — shu filialdagi a'zolik shart;
// berilmasa (Owner) — birinchi mos a'zolikning filiali ishlatiladi (SMS
// shabloni/balansi filial darajasida bo'lgani uchun bitta filial kerak).
const requireStudent = async (clientId, centerId, studentId) => {
  if (!isValidObjectId(studentId)) throw new Error("student.notFound");
  const student = await Student.findOne({ _id: studentId, isDeleted: false });
  if (!student) throw new Error("student.notFound");
  const entries = (student.groups || []).filter(
    (g) =>
      String(g.client) === String(clientId) &&
      g.status !== "archived" &&
      (!centerId || String(g.center) === String(centerId)),
  );
  if (!entries.length) throw new Error("student.notFound");
  const resolvedCenter = centerId || entries.find((e) => e.status === "active")?.center || entries[0].center;
  return { student, centerId: resolvedCenter };
};

// Telegram matni: shablon berilsa sms.service shabloni qayta ishlatiladi
// (bir xil `{var}` placeholder), bo'lmasa qo'lda yozilgan `text`.
const resolveTelegramText = async (student, body) => {
  if (body?.templateId) {
    const tpl = await smsService.getTemplate(body.templateId);
    return smsService.render(tpl.text, { student: student.fullName || "" });
  }
  const text = String(body?.text || "").trim();
  if (!text) throw new Error("student.message.textRequired");
  return text;
};

module.exports = {
  // channel: "telegram" | "sms"
  sendStudentMessage: async (client, center, studentId, { channel, templateId, text } = {}) => {
    const clientId = client?._id || client;
    const centerId = center?._id || center;

    if (channel === "sms") {
      const { student, centerId: resolvedCenter } = await requireStudent(clientId, centerId, studentId);
      return smsService.sendToStudent(clientId, resolvedCenter, student._id, { templateId, text }, {
        id: client?._id ? client._id : null,
        kind: "client",
      });
    }

    if (channel === "telegram") {
      const { student } = await requireStudent(clientId, centerId, studentId);

      // Avval TTL tekshiriladi (kalit bo'lsa cooldown) — kalit faqat
      // MUVAFFAQIYATLI yuborilgandan keyin qo'yiladi (pastda), shunda
      // "qabul qiluvchi topilmadi" kabi muvaffaqiyatsiz urinish foydalanuvchini
      // bekorga 20s kutib turishga majburlamaydi.
      const key = cooldownKey(student._id);
      const ttlNow = await redis.ttl(key);
      if (ttlNow > 0) {
        // `error.util.js` konvensiyasi: `code` faqat UPPER_SNAKE bo'lsa
        // javobga chiqadi (bu yerda i18n-uslub kalit bor, shuning uchun
        // qolgan ma'lumot — retryAfterSec — `data` orqali o'tadi, xuddi
        // boshqa servislardagi `lockedBy`/`conflict` kabi).
        const error = new Error("student.message.cooldown");
        error.data = { retryAfterSec: ttlNow };
        throw error;
      }

      const messageText = await resolveTelegramText(student, { templateId, text });

      // group.service.js `broadcast` bilan bir xil naqsh — lazy require
      // (aylanma importdan qochish uchun).
      const { findParents } = require("./parentNotification.service");
      const { sendToChat } = require("../bot/notify");

      const recipients = await findParents(student, ["parent", "student"]);
      let sent = 0;
      let skipped = 0;
      for (const { parent } of recipients) {
        if (!parent.telegram?.chatId || parent.telegram?.blockedAt) {
          skipped += 1;
          continue;
        }
        try {
          const result = await sendToChat(parent.telegram.chatId, messageText);
          if (result?.ok) sent += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
      }

      if (!recipients.length || sent === 0) throw new Error("student.message.noRecipient");

      // Muvaffaqiyatli yuborildi — endi 20s cooldown boshlanadi.
      await redis.set(key, "1", "EX", COOLDOWN_SEC);

      return { sent, skipped, total: recipients.length };
    }

    throw new Error("student.message.invalidChannel");
  },
};
