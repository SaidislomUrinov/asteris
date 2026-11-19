// O'quvchi profilidan SMS/Telegram xabar — docs/API_CONTRACT_profile_test_and_student_notify.md §2.
// Reusable servis: Telegram — `bot/notify.js` sendToChat + 20s Redis cooldown
// (group.service.js `broadcast` bilan bir xil parent-topish naqshi).
// SMS — `sms.service.js` mavjud shablon/balans/getsms zanjiri (`sendToStudent`),
// cooldown YO'Q.
const { isValidObjectId } = require("mongoose");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Staff = require("../models/Staff");
const Center = require("../models/Center");
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

// Shablon matni (Telegram ham, ko'rib chiqish ham): sms.service shabloni
// to'liq o'zgaruvchilar (`{center}`, `{student}`, `{group}`, `{debt}`...) bilan
// BITTA o'quvchi uchun to'ldiriladi. Faol a'zolik topilmasa kamida markaz va
// ism to'ldiriladi.
const renderTemplate = async (clientId, centerId, student, templateId) => {
  const rendered = await smsService.renderForStudent(clientId, centerId, student._id, templateId);
  if (rendered) return rendered;
  const tpl = await smsService.getTemplate(templateId);
  const center = await Center.findById(centerId).select("name").lean();
  return {
    text: smsService.render(tpl.text, { student: student.fullName || "", center: center?.name || "" }),
    centerName: center?.name || "",
    studentName: student.fullName || "",
  };
};

// Telegram matni: shablon berilsa to'liq render, bo'lmasa qo'lda yozilgan `text`.
const resolveTelegramText = async (clientId, centerId, student, body) => {
  if (body?.templateId) return (await renderTemplate(clientId, centerId, student, body.templateId)).text;
  const text = String(body?.text || "").trim();
  if (!text) throw new Error("student.message.textRequired");
  return text;
};

// Faol a'zoliklaridagi guruhlar orqali o'qituvchi/yordamchi Staff hujjatlarini
// topadi (dublikatsiz, `role` bo'yicha). `activeOnly` — arxivlangan/chiqqan
// a'zoliklar hisobga olinmaydi (ular bilan "dars" aloqasi yo'q).
const findTeachingStaff = async (student, role) => {
  const field = role === "teacher" ? "teacher" : "assistant";
  const groupIds = [...new Set(
    (student.groups || [])
      .filter((g) => g.status === "active")
      .map((g) => String(g.group)),
  )];
  if (!groupIds.length) return [];
  const groups = await Group.find({ _id: { $in: groupIds }, [field]: { $ne: null } }).select(field).lean();
  const staffIds = [...new Set(groups.map((g) => String(g[field])).filter(Boolean))];
  if (!staffIds.length) return [];
  return Staff.find({ _id: { $in: staffIds }, isDeleted: false }).select("name telegram").lean();
};

module.exports = {
  // Dialog ochilganda — kimga yuborish mumkinligi (rol + ulangan-ulanmaganligi)
  // frontend'dagi tanlov ro'yxati uchun. SMS uchun kerak emas (faqat Telegram).
  getRecipientOptions: async (client, center, studentId) => {
    const clientId = client?._id || client;
    const centerId = center?._id || center;
    const { student } = await requireStudent(clientId, centerId, studentId);
    const { findParents } = require("./parentNotification.service");

    const [parentMatches, studentMatches, teachers, assistants] = await Promise.all([
      findParents(student, ["parent"]),
      findParents(student, ["student"]),
      findTeachingStaff(student, "teacher"),
      findTeachingStaff(student, "assistant"),
    ]);

    const options = [
      {
        role: "parent",
        linked: parentMatches.some((r) => r.parent.telegram?.chatId && !r.parent.telegram?.blockedAt),
      },
      {
        role: "student",
        linked: studentMatches.some((r) => r.parent.telegram?.chatId && !r.parent.telegram?.blockedAt),
      },
    ];
    for (const staff of teachers) {
      options.push({ role: "teacher", staffId: String(staff._id), name: staff.name, linked: !!staff.telegram?.chatId });
    }
    for (const staff of assistants) {
      options.push({ role: "assistant", staffId: String(staff._id), name: staff.name, linked: !!staff.telegram?.chatId });
    }
    return options;
  },

  // Dialogdagi "ko'rib chiqish": shablon shu o'quvchi uchun to'ldirilgan holda
  // + aniq o'quvchi va markaz nomi.
  previewMessage: async (client, center, studentId, { templateId } = {}) => {
    const clientId = client?._id || client;
    const { student, centerId } = await requireStudent(clientId, center?._id || center, studentId);
    const r = await renderTemplate(clientId, centerId, student, templateId);
    return { text: r.text, segments: r.segments || null, studentName: r.studentName, centerName: r.centerName };
  },

  // channel: "telegram" | "sms"
  // recipient (faqat telegram uchun): "parent" | "student" | "teacher" | "assistant".
  // Berilmasa — eski xatti-harakat (parent+student baravar).
  sendStudentMessage: async (client, center, studentId, { channel, templateId, text, recipient } = {}) => {
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
      const { student, centerId: resolvedCenter } = await requireStudent(clientId, centerId, studentId);

      // Avval TTL tekshiriladi (kalit bo'lsa cooldown) — kalit faqat
      // MUVAFFAQIYATLI yuborilgandan keyin qo'yiladi (pastda), shunda
      // "qabul qiluvchi topilmadi" kabi muvaffaqiyatsiz urinish foydalanuvchini
      // bekorga 20s kutib turishga majburlamaydi. Rolga qarab alohida
      // kalit — bitta rolga yuborish boshqa rolni bloklamasin.
      const key = cooldownKey(`${student._id}:${recipient || "parent+student"}`);
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

      const messageText = await resolveTelegramText(clientId, resolvedCenter, student, { templateId, text });
      const { sendToChat } = require("../bot/notify");

      let sent = 0;
      let skipped = 0;
      let total = 0;

      if (recipient === "teacher" || recipient === "assistant") {
        const staffList = await findTeachingStaff(student, recipient);
        total = staffList.length;
        for (const staff of staffList) {
          if (!staff.telegram?.chatId || staff.telegram?.blockedAt) {
            skipped += 1;
            continue;
          }
          try {
            const result = await sendToChat(staff.telegram.chatId, messageText);
            if (result?.ok) sent += 1;
            else skipped += 1;
          } catch {
            skipped += 1;
          }
        }
      } else {
        // group.service.js `broadcast` bilan bir xil naqsh — lazy require
        // (aylanma importdan qochish uchun).
        const { findParents } = require("./parentNotification.service");
        const roles = recipient === "parent" || recipient === "student" ? [recipient] : ["parent", "student"];
        const recipients = await findParents(student, roles);
        total = recipients.length;
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
      }

      if (!total || sent === 0) throw new Error("student.message.noRecipient");

      // Muvaffaqiyatli yuborildi — endi 20s cooldown boshlanadi.
      await redis.set(key, "1", "EX", COOLDOWN_SEC);

      return { sent, skipped, total };
    }

    throw new Error("student.message.invalidChannel");
  },
};
