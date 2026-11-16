// OTA-ONA XABARLARI — a'zolik (`Student.groups[]` entry) darajasida.
//
// Bitta kirish nuqtasi `notify(type, ctx)`: qabul qiluvchilarni ROLGA qarab
// topadi (API_CONTRACT_student_role_homework.md §5): `parent` roli —
// `Parent.phone = Student.parentTelegramPhone`, `student` roli — `Parent.phone =
// Student.telegramPhone`. Har tur faqat ruxsat etilgan rolga ketadi (`TYPE_ROLES`). Markaz
// sozlamasi va ota-onaning `mute`ini tekshiradi, `Notification`ga
// (recipient.kind "parent", dedupKey bilan) yozadi va Telegram'ga yuboradi.
//
// Chaqiruvchi (student.service addPayment va h.k.) buni KUTMAYDI —
// `void parentNotification.onPayment(...)`: Telegram sekin/bo'lmasa ham
// asosiy amal (to'lov saqlash) shunga bog'lanmasin. Bu yerdagi hech qanday
// xato tashqariga chiqmaydi.
//
// Idempotency: dedupKey `parent:{parentId}:{type}:{entryId}:{key}` —
// bir voqea uchun ikki marta xabar hech qachon ketmaydi (Notification
// unique sparse index, E11000 → null).
const Parent = require("../models/Parent");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Center = require("../models/Center");
const BillingSetting = require("../models/BillingSetting");
const Notification = require("../models/Notification");
const Homework = require("../models/Homework");
const notificationService = require("./notification.service");
const { sendToChat, sendRichToChat, sendDocumentToChat, parentWebAppMarkup } = require("../bot/notify");
const { richTable } = require("../bot/format");
const { buildPaymentReceiptPdf, receiptFileName } = require("../utils/receiptPdf.util");
const Student = require("../models/Student");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const { escapeHtml } = require("../bot/escapeHtml");
const { t } = require("../bot/i18n");
const { getNow } = require("../utils/date.util");
const { emitParentTelegramChanged } = require("../utils/parentTelegram.util");
const { telegramFieldsOf } = require("../utils/telegramPhone.util");
const { BADGE_EMOJI, filterHiddenGrades } = require("../utils/badge.util");
const moment = require("moment-timezone");
const crypto = require("crypto");

const TZ = "Asia/Tashkent";
const RECEIPT_VERIFY_BASE = "https://wenet.uz/payment/verify";
const ATT_DEBOUNCE_SEC = Number(process.env.PARENT_ATT_DEBOUNCE_SEC) || 180;
// Uyga vazifa: shu oynada qayta tahrir qayta xabar yubormaydi (§4.4).
const HOMEWORK_DEBOUNCE_MS = 2 * 60 * 1000;

// Qaysi tur qaysi rolga yuboriladi (§5 jadvali).
const TYPE_ROLES = {
  attendance: ["parent"],
  // Chek PDF o'quvchining o'ziga ham boradi (API_CONTRACT_receipt_pdf.md §2).
  // WebApp xabarlar ro'yxati baribir rol bo'yicha filtrlanadi
  // (parent.service ROLE_NOTIF_TYPES) — o'quvchida to'lov yozuvi ko'rinmaydi.
  payment: ["parent", "student"],
  lessonFinished: ["parent", "student"],
  homework: ["student"],
  // Vazifa "Bajarmadi" deb belgilandi (API_CONTRACT_homework_missed.md).
  homeworkMissed: ["parent", "student"],
  lessonReminder: ["student"],
  // Oylik yutuq nishonlari (jobs/badges.job.js, API_CONTRACT_badges_monthly_rank.md §C).
  badge: ["parent", "student"],
  // WECOIN oy yakuni (coin.service.notifyMonth) va do'kon buyurtmasi holati
  // (API_CONTRACT_wecoin.md §5).
  coin: ["parent", "student"],
  shop: ["student"],
  // Test (Quiz) — faqat o'quvchi roliga (API_CONTRACT_quiz.md §6).
  quizSent: ["student"],
  quizResult: ["student"],
};
const attTimers = new Map();

const fmtSum = (n, lang) => `${Number(n || 0).toLocaleString("ru-RU").replace(/ /g, " ")} ${t(lang, "pnSom")}`;
const fmtMonth = (ym, lang) => {
  if (!ym) return "—";
  const [y, m] = String(ym).split("-").map(Number);
  const names = t(lang, "pnMonths").split("|");
  return y && m ? `${names[m - 1] || m} ${y}` : ym;
};
const fmtDate = (unix) => moment.unix(unix).tz(TZ).format("DD.MM.YYYY");
const typeLabel = (type, lang) =>
  ({
    cash: t(lang, "pnTypeCash"),
    card: t(lang, "pnTypeCard"),
    mixed: t(lang, "pnTypeMixed"),
    previousMonth: t(lang, "pnTypePreviousMonth"),
  })[type] || type;

// Markaz sozlamasi (`Center.parentNotifications`, API_CONTRACT_parent.md §2).
// Sub-hujjat bo'lmasa (eski hujjat) — hamma tur yoqiq.
const centerAllows = (center, type) => {
  const cfg = center?.parentNotifications;
  if (!cfg) return true;
  if (cfg.enabled === false) return false;
  return cfg[type]?.enabled !== false;
};

// Entry kontekstini bir marta yig'adi: guruh/fan/markaz nomlari + billing.
const loadContext = async (entry) => {
  const [group, center, billingDoc] = await Promise.all([
    Group.findById(entry.group).select("name subject activatedAt lessonOffset days startTime endTime").lean(),
    Center.findById(entry.center).select("name parentNotifications isDeleted status").lean(),
    BillingSetting.findOne({ center: entry.center }).select("cycleMode").lean(),
  ]);
  // O'chirilgan yoki (tarif downgrade'da) bloklangan filialdan xabar ketmaydi.
  if (!group || !center || center.isDeleted || center.status === "blocked") return null;
  const subject = await Subject.findById(group.subject).select("name").lean();
  // student.service → parentNotification → student.service aylanma
  // import bo'lmasin: computeBilling chaqiruv paytida olinadi.
  const { computeBilling } = require("./student.service");
  const billing = computeBilling(entry, group, billingDoc?.cycleMode || "anchor");
  return {
    group,
    center,
    groupLabel: group.name || subject?.name || "",
    billing,
  };
};

// Qabul qiluvchilar — `[{ parent, role }]`. Parent o'quvchiga mos keladi,
// agar (roli parent VA phone == student.parentTelegramPhone) YOKI (roli student VA
// phone == student.telegramPhone). `role: null` bo'lsa `effectiveRole` ishlatiladi.
// Telegram mosligi FAQAT Telegram raqami bo'yicha (API_CONTRACT_telegram_phone.md §3).
const findParents = async (student, roles = ["parent", "student"]) => {
  const { telegramPhone, parentTelegramPhone } = telegramFieldsOf(student);
  const phones = [parentTelegramPhone, telegramPhone].filter(Boolean);
  if (!phones.length) return [];
  const parents = await Parent.find({ phone: { $in: phones }, "telegram.blockedAt": null });
  // parent.service → parentTelegram.util aylanmasi bo'lmasin — lazy.
  const { effectiveRole } = require("./parent.service");
  const out = [];
  for (const parent of parents) {
    // `null` rol + parentTelegramPhone mosligi → effectiveRole baribir "parent"
    // (kamida shu o'quvchi mos) — qo'shimcha so'rovsiz.
    const role =
      parent.role || (parent.phone === parentTelegramPhone ? "parent" : await effectiveRole(parent));
    const matches =
      (role === "parent" && parent.phone === parentTelegramPhone) ||
      (role === "student" && parent.phone === telegramPhone);
    if (matches && roles.includes(role)) out.push({ parent, role });
  }
  return out;
};

// Sarlavha: "Markaz · Guruh" — ota-ona 2 markazdan xabar oladi, kontekst shart.
const header = (ctx) => `${escapeHtml(ctx.center.name)} · ${escapeHtml(ctx.groupLabel)}`;

const buildPaymentText = (lang, { student, ctx, payment, cancelled }) => {
  const lines = [
    `<b>${t(lang, cancelled ? "pnPaymentCancelledTitle" : "pnPaymentTitle")}</b>`,
    header(ctx),
    "",
    `${t(lang, "pnStudent")}: <b>${escapeHtml(student.fullName)}</b>`,
    `${t(lang, "pnAmount")}: <b>${fmtSum(payment.amount, lang)}</b> (${typeLabel(payment.type, lang)})`,
  ];
  if (payment.forMonth) lines.push(`${t(lang, "pnMonth")}: ${fmtMonth(payment.forMonth, lang)}`);
  const debt = ctx.billing?.debt || 0;
  lines.push(
    debt > 0 ? `${t(lang, "pnDebtLeft")}: <b>${fmtSum(debt, lang)}</b>` : `${t(lang, "pnDebtLeft")}: ${t(lang, "pnNoDebt")}`,
  );
  if (debt > 0 && ctx.billing?.nextDueDate) lines.push(`${t(lang, "pnNextDue")}: ${fmtDate(ctx.billing.nextDueDate)}`);
  if (!cancelled && payment.code) lines.push("", `${t(lang, "pnReceipt")}: ${RECEIPT_VERIFY_BASE}/${payment.code}`);
  return lines.join("\n");
};

const buildAttendanceText = (lang, { student, ctx, date, status, late, reason }) => {
  const key =
    status === "present" ? (late ? "pnAttLate" : "pnAttPresent") : status === "excused" ? "pnAttExcused" : "pnAttAbsent";
  const lines = [
    `<b>${escapeHtml(student.fullName)} — ${t(lang, key).toLowerCase()}</b>`,
    header(ctx),
    "",
    `${t(lang, "pnDate")}: ${moment.tz(date, "YYYY-MM-DD", TZ).format("DD.MM.YYYY")}`,
  ];
  if (ctx.group?.startTime) lines.push(`${t(lang, "pnTime")}: ${ctx.group.startTime}–${ctx.group.endTime || ""}`);
  if (status === "excused" && reason) lines.push(`${t(lang, "pnReason")}: ${escapeHtml(reason)}`);
  return lines.join("\n");
};

// "{from} → {to}" kabi o'rinbosarlar. Replacer funksiya — qiymatdagi "$&"
// kabi belgilar maxsus naqsh bo'lib qolmasin.
const fillVars = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));

// Keyingi dars: "Ertaga 09:00" yoki "Chor, 24.09 · 15:00".
const fmtNextLesson = (lang, next) => {
  if (!next) return null;
  const d = moment.tz(next.date, "YYYY-MM-DD", TZ);
  const isTomorrow = d.isSame(moment.tz(TZ).add(1, "day"), "day");
  const dayName = t(lang, "pnDayNames").split("|")[d.day()];
  const when = isTomorrow ? t(lang, "pnTomorrow") : `${dayName}, ${d.format("DD.MM")}`;
  return next.startTime ? `${when} · ${next.startTime}` : when;
};

// O'quvchining o'ziga (student roli) — "siz" shaklida, ism sarlavhada yo'q.
const buildLessonFinishedText = (lang, { student, ctx, date, grade, nextLesson, role, rankChange }) => {
  const self = role === "student";
  const lines = [
    self
      ? `<b>${t(lang, "snLessonFinishedTitle")}</b>`
      : `<b>${t(lang, "pnLessonFinishedTitle")} — ${escapeHtml(student.fullName)}</b>`,
    header(ctx),
    "",
    `${t(lang, "pnDate")}: ${moment.tz(date, "YYYY-MM-DD", TZ).format("DD.MM.YYYY")}`,
  ];
  // Markaz "baho qatori chiqmasin" desa (lessonFinished.includeGrade=false)
  // baho umuman ko'rsatilmaydi — "qo'yilmagan" deb ham yozilmaydi.
  const pn = ctx.center?.parentNotifications;
  if (pn?.lessonFinished?.includeGrade !== false) {
    lines.push(
      `${t(lang, self ? "snGrade" : "pnGrade")}: ${grade != null ? `<b>${grade}</b>` : t(lang, self ? "snNoGrade" : "pnNoGrade")}`,
    );
    // Guruhdagi o'rin KO'TARILGAN bo'lsa (API_CONTRACT_badges_monthly_rank.md §B).
    // O'rin bahodan kelib chiqadi — markaz baholarni yashirgan bo'lsa chiqmaydi.
    if (rankChange && pn?.showGrades !== false)
      lines.push(
        fillVars(t(lang, self ? "snRankUp" : "pnRankUp"), {
          from: rankChange.from,
          to: rankChange.to,
          total: rankChange.total,
        }),
      );
  }
  const next = fmtNextLesson(lang, nextLesson);
  if (next) lines.push(`${t(lang, self ? "snNextLesson" : "pnNextLesson")}: ${next}`);
  return lines.join("\n");
};

const fmtDay = (date) => moment.tz(date, "YYYY-MM-DD", TZ).format("DD.MM.YYYY");

// Uyga vazifa (faqat student roli).
const buildHomeworkText = (lang, { ctx, date, text }) =>
  [`<b>${t(lang, "snHomeworkTitle")}</b>`, header(ctx), "", `${t(lang, "snHomeworkFor")}: ${fmtDay(date)}`, "", escapeHtml(text)].join(
    "\n",
  );

// Vazifa qilinmadi (API_CONTRACT_homework_missed.md): ota-onaga ism bilan,
// o'quvchiga "siz" shaklida. Sana "11 sentabr" ko'rinishida (yilsiz).
const buildHomeworkMissedText = (lang, { student, ctx, date, text, role }) => {
  const d = moment.tz(date, "YYYY-MM-DD", TZ);
  const monthName = (t(lang, "pnMonths").split("|")[d.month()] || "").toLowerCase();
  // ru'da oy nomi qaratqich kelishigida bo'lishi kerak ("октября") — raqamli sana.
  const day =
    lang === "en" ? `${capitalize(monthName)} ${d.date()}` : lang === "ru" ? d.format("DD.MM.YYYY") : `${d.date()}-${monthName}`;
  const self = role === "student";
  const lines = [
    `<b>${fillVars(t(lang, self ? "snHomeworkMissed" : "pnHomeworkMissed"), {
      name: escapeHtml(student.fullName),
      date: day,
    })}</b>`,
    header(ctx),
  ];
  if (text) lines.push("", `${t(lang, "snHomeworkTitle")}: ${escapeHtml(String(text).slice(0, 300))}`);
  return lines.join("\n");
};

// Darsdan 1 soat oldin (faqat student roli): "Bugun 15:00 da <guruh> darsingiz bor".
const buildLessonReminderText = (lang, { ctx, topic = null }) => {
  const title = t(lang, "snReminderText")
    // Replacer funksiya: guruh nomidagi "$&" kabi belgilar maxsus naqsh bo'lib qolmasin.
    .replace("{time}", () => ctx.group?.startTime || "")
    .replace("{group}", () => escapeHtml(ctx.groupLabel));
  const lines = [`<b>${title}</b>`, escapeHtml(ctx.center.name)];
  if (ctx.group?.startTime) lines.push("", `${t(lang, "pnTime")}: ${ctx.group.startTime}–${ctx.group.endTime || ""}`);
  // Bugungi mavzu — dam olish kunlari surgan bo'lsa ham to'g'ri (lessonSchedule.util).
  if (topic) lines.push(`${t(lang, "reminderTopicLabel")}: ${escapeHtml(topic)}`);
  return lines.join("\n");
};

// YUTUQ NISHONLARI (§C). Markaz baholarni yashirgan bo'lsa baho nishonlari
// chiqariladi; hech narsa qolmasa `null` — xabar umuman ketmaydi.
const capitalize = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const buildBadgeText = (lang, { student, ctx, month, types, role }) => {
  const list = filterHiddenGrades(types || [], ctx.center?.parentNotifications?.showGrades === false);
  if (!list.length) return null;
  const self = role === "student";
  const monthName = (t(lang, "pnMonths").split("|")[Number(String(month).slice(5, 7)) - 1] || month).toLowerCase();
  return [
    self
      ? `🏅 <b>${t(lang, "snBadgeTitle")}</b>`
      : `🏅 <b>${t(lang, "pnBadgeTitle")} — ${escapeHtml(student.fullName)}</b>`,
    header(ctx),
    "",
    fillVars(t(lang, "pnBadgeMonth"), { month: lang === "ru" ? monthName : capitalize(monthName) }),
    ...list.map((type) => `• ${BADGE_EMOJI[type] || "🏅"} ${t(lang, `badge_${type}`)}`),
  ].join("\n");
};

// WECOIN (API_CONTRACT_wecoin.md §5) — oy yakunida berilgan tangalar.
const buildCoinText = (lang, { student, ctx, month, amount, balance, role }) => {
  if (!amount) return null;
  const self = role === "student";
  const monthName = (t(lang, "pnMonths").split("|")[Number(String(month).slice(5, 7)) - 1] || month).toLowerCase();
  return [
    self
      ? `🪙 <b>${t(lang, "snCoinTitle")}</b>`
      : `🪙 <b>${t(lang, "pnCoinTitle")} — ${escapeHtml(student.fullName)}</b>`,
    escapeHtml(ctx.center.name),
    "",
    fillVars(t(lang, "pnCoinMonth"), { month: lang === "ru" ? monthName : capitalize(monthName), amount }),
    fillVars(t(lang, "pnCoinBalance"), { balance }),
    ...(self ? ["", t(lang, "snCoinHint")] : []),
  ].join("\n");
};

// TEST (QUIZ) — yuborilganda (faqat o'quvchiga) va natija tayyor bo'lganda.
const buildQuizSentText = (lang, { ctx, quizTitle, startTime, questionCount, durationMin }) =>
  [
    `<b>${t(lang, "pnQuizSentTitle")}</b>`,
    header(ctx),
    "",
    ...(quizTitle ? [`<b>${escapeHtml(quizTitle)}</b>`] : []),
    fillVars(t(lang, "pnQuizSentBody"), { time: startTime, count: questionCount, min: durationMin }),
  ].join("\n");

const buildQuizResultText = (lang, { ctx, correctCount, total, score }) =>
  [
    `<b>${t(lang, "pnQuizResultTitle")}</b>`,
    header(ctx),
    "",
    fillVars(t(lang, "pnQuizResultBody"), { correct: correctCount, total, score }),
  ].join("\n");

const buildShopText = (lang, { ctx, order }) =>
  [
    `<b>${t(lang, order.status === "refunded" ? "snShopRefunded" : "snShopDelivered")}</b>`,
    escapeHtml(ctx.center.name),
    "",
    `${escapeHtml(order.productName)} · ${order.price} WECOIN`,
  ].join("\n");

const BUILDERS = {
  coin: buildCoinText,
  shop: buildShopText,
  payment: buildPaymentText,
  attendance: buildAttendanceText,
  lessonFinished: buildLessonFinishedText,
  homework: buildHomeworkText,
  homeworkMissed: buildHomeworkMissedText,
  lessonReminder: buildLessonReminderText,
  badge: buildBadgeText,
  quizSent: buildQuizSentText,
  quizResult: buildQuizResultText,
};

// WebApp ichida ochiladigan sahifa (parent/ ilovasi shu yo'llarni tushunadi).
const APP_PATH = {
  coin: () => "/coins",
  shop: () => "/coins",
  payment: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/payments`,
  attendance: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/attendance`,
  lessonFinished: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/grades`,
  homework: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/homework`,
  homeworkMissed: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/homework`,
  lessonReminder: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/homework`,
  badge: ({ student, entry }) => `/child/${student._id}/group/${entry._id}/badges`,
  // API_CONTRACT_quiz.md §6 — WebApp'ning o'ziga xos `/quiz/:entryId/:quizId` yo'li.
  quizSent: ({ entry, quizId }) => `/quiz/${entry._id}/${quizId}`,
  quizResult: ({ entry, quizId }) => `/quiz/${entry._id}/${quizId}`,
};

// Ota-ona botni bloklagan (403) — keyingi xabarlar urinilmaydi, /start tozalaydi.
const markBlockedIfNeeded = async (parent, res) => {
  if (!res.ok && /blocked|deactivated|chat not found/i.test(res.error || "")) {
    const r = await Parent.updateOne(
      { _id: parent._id, "telegram.blockedAt": null },
      { $set: { "telegram.blockedAt": getNow() } },
    );
    // Endigina bloklandi — o'quvchi ro'yxatlarida "Ulanmagan" ga o'tadi
    // (API_CONTRACT_student_contact_telegram.md §4).
    if (r.modifiedCount) void emitParentTelegramChanged([parent.phone]);
  }
};

// To'lov cheki PDF (API_CONTRACT_receipt_pdf.md) — har til uchun bir marta
// yasaladi (`cache`), bir xil tildagi oluvchilar bitta buferni oladi. Diskka
// yozilmaydi. Yasab bo'lmasa `null` — chaqiruvchi oddiy matnga qaytadi.
const receiptPdfFor = async (lang, cache, { student, ctx, payment }) => {
  if (!cache.has(lang)) {
    cache.set(
      lang,
      buildPaymentReceiptPdf(
        {
          centerName: ctx.center.name,
          groupLabel: ctx.groupLabel,
          studentName: student.fullName,
          phone: student.phone,
          amount: payment.amount,
          remainingDebt: ctx.billing?.debt || 0,
          debtBreakdown: ctx.billing?.debtBreakdown || [],
          forMonth: payment.forMonth,
          code: payment.code,
          paidAt: payment.date,
        },
        { lang, t: (key) => t(lang, key), monthNames: t(lang, "pnMonths").split("|") },
      ).catch((error) => {
        console.error("parentNotification receipt pdf:", error?.message || error);
        return null;
      }),
    );
  }
  return await cache.get(lang);
};
const CAPTION_MAX = 1024;

// Umumiy yuborish: har ota-ona uchun o'z tilida matn, Notification + Telegram.
const notify = async (type, { student, entry, dedupSuffix, data = {}, ...rest }) => {
  const recipients = await findParents(student, TYPE_ROLES[type] || ["parent"]);
  if (!recipients.length) return;

  const ctx = await loadContext(entry);
  if (!ctx || !centerAllows(ctx.center, type)) return;

  const withReceipt = type === "payment" && !rest.cancelled && !!rest.payment;
  const pdfCache = new Map();

  for (const { parent, role } of recipients) {
    if (parent.mute?.[type]) continue;
    const lang = parent.telegram?.lang || "uz";
    const text = BUILDERS[type](lang, { student, ctx, role, ...rest });
    if (!text) continue; // builder "yuboradigan narsa yo'q" dedi

    const created = await notificationService.create({
      clientId: entry.client,
      centerId: entry.center,
      recipient: { id: parent._id, kind: "parent" },
      type: `parent:${type}`,
      title: text.split("\n")[0].replace(/<[^>]+>/g, ""),
      body: text,
      data: { studentId: String(student._id), entryId: String(entry._id), groupId: String(entry.group), ...data },
      dedupKey: `parent:${parent._id}:${type}:${entry._id}:${dedupSuffix}`,
    });
    if (!created) continue; // allaqachon yuborilgan

    const buttonLabel = type === "quizSent" ? t(lang, "pnQuizStartButton") : t(lang, "parentOpenApp");
    const reply_markup = await parentWebAppMarkup(buttonLabel, APP_PATH[type]?.({ student, entry, ...rest }) || "");
    const extra = reply_markup ? { reply_markup } : {};

    // To'lov: matn PDF chekka caption bo'lib bitta xabarda boradi. Caption
    // sig'masa — avval matn, keyin PDF. PDF yasalmasa yoki yuborilmasa —
    // oddiy matnli xabar (avvalgi xatti-harakat).
    const pdf = withReceipt ? await receiptPdfFor(lang, pdfCache, { student, ctx, ...rest }) : null;
    let res;
    if (pdf) {
      const filename = receiptFileName(t(lang, "receiptFileName"), student.fullName, rest.payment.date);
      if (text.length <= CAPTION_MAX) {
        res = await sendDocumentToChat(parent.telegram.chatId, pdf, filename, { caption: text, ...extra });
      } else {
        res = await sendToChat(parent.telegram.chatId, text, extra);
        if (res.ok) await sendDocumentToChat(parent.telegram.chatId, pdf, filename);
      }
      if (!res.ok && !/blocked|deactivated|chat not found/i.test(res.error || "")) {
        console.error("parentNotification receipt send:", res.error);
        res = await sendToChat(parent.telegram.chatId, text, extra);
      }
    } else {
      res = await sendToChat(parent.telegram.chatId, text, extra);
    }
    await markBlockedIfNeeded(parent, res);
  }
};

// QARZ DIGESTI (jobs/parentDebt.job.js, API_CONTRACT_parent.md §3) —
// `notify()`dan farqli, PARENT darajasida: kunlik BITTA birlashtirilgan
// xabar, barcha bola/guruh/markaz qarzlari markaz bo'yicha guruhlab.
// `items[]`: { studentName, centerId, centerName, center (hujjat, parentNotifications bilan),
//   clientId, groupLabel, entryId, studentId, debt, months: ["YYYY-MM"], dueDate (unix|null) }.
// Markaz gate'i (centerAllows(center,"debt") + tarif flagi) HAR ITEM uchun.
const buildDebtDigestText = (lang, items) => {
  const byCenter = new Map();
  for (const it of items) {
    const k = String(it.centerId);
    if (!byCenter.has(k)) byCenter.set(k, []);
    byCenter.get(k).push(it);
  }
  const blocks = [];
  for (const list of byCenter.values()) {
    // Bir markaz ichida guruh bo'yicha bloklar (format.js blockList uslubi).
    const byGroup = new Map();
    for (const it of list) {
      const k = `${it.centerName} · ${it.groupLabel}`;
      if (!byGroup.has(k)) byGroup.set(k, []);
      byGroup.get(k).push(it);
    }
    for (const [title, rows] of byGroup) {
      const lines = [];
      for (const it of rows) {
        const months = (it.months || []).map((m) => fmtMonth(m, lang)).join(", ");
        lines.push(`${escapeHtml(it.studentName)} — <b>${fmtSum(it.debt, lang)}</b>${months ? ` (${months})` : ""}`);
        if (it.dueDate) lines.push(`${t(lang, "pnDebtDue")}: ${fmtDate(it.dueDate)}`);
      }
      blocks.push(`<b>${escapeHtml(title)}</b>\n${lines.join("\n")}`);
    }
  }
  const total = items.reduce((sum, it) => sum + (it.debt || 0), 0);
  return [`<b>${t(lang, "pnDebtTitle")}</b>`, "", blocks.join("\n\n"), "", `${t(lang, "pnDebtTotal")}: <b>${fmtSum(total, lang)}</b>`].join("\n");
};

// Xuddi shu ma'lumot — Telegram uchun haqiqiy jadval (tr/td) bloki, `text`
// esa Notification hujjati/in-app ko'rinish uchun o'zgarishsiz qoladi.
const buildDebtDigestRich = (lang, items) => {
  const byGroup = new Map();
  for (const it of items) {
    const k = `${it.centerName} · ${it.groupLabel}`;
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k).push(it);
  }
  const blocks = [{ type: "heading", size: 3, text: t(lang, "pnDebtTitle") }];
  for (const [title, rows] of byGroup) {
    blocks.push(
      { type: "paragraph", text: { type: "bold", text: title } },
      richTable(
        [t(lang, "pnDebtStudentCol"), t(lang, "pnSom"), t(lang, "pnDebtDue")],
        rows.map((it) => [
          it.studentName,
          `${fmtSum(it.debt, lang)}${(it.months || []).length ? ` (${it.months.map((m) => fmtMonth(m, lang)).join(", ")})` : ""}`,
          it.dueDate ? fmtDate(it.dueDate) : "—",
        ]),
      ),
    );
  }
  const total = items.reduce((sum, it) => sum + (it.debt || 0), 0);
  blocks.push({ type: "paragraph", text: { type: "bold", text: `${t(lang, "pnDebtTotal")}: ${fmtSum(total, lang)}` } });
  return { blocks };
};

const onDebtDigest = async ({ parent, items, date }) => {
  if (!parent || parent.telegram?.blockedAt || parent.mute?.debt) return null;

  // Yagona gate — markaz sozlamasi (ota-ona nazorati tarifga bog'liq emas).
  const allowed = [];
  for (const it of items || []) {
    if (!(it.debt > 0)) continue;
    if (!centerAllows(it.center, "debt")) continue;
    allowed.push(it);
  }
  if (!allowed.length) return null;

  const lang = parent.telegram?.lang || "uz";
  const text = buildDebtDigestText(lang, allowed);
  const day = date || moment.tz(TZ).format("YYYY-MM-DD");

  // Notification `client` majburiy — parent darajasidagi xabar uchun
  // birinchi itemning tenant'i yoziladi (ro'yxat `data.items` ichida to'liq).
  const created = await notificationService.create({
    clientId: allowed[0].clientId,
    centerId: allowed.length === 1 ? allowed[0].centerId : null,
    recipient: { id: parent._id, kind: "parent" },
    type: "parent:debt",
    title: t(lang, "pnDebtTitle"),
    body: text,
    data: {
      date: day,
      total: allowed.reduce((sum, it) => sum + it.debt, 0),
      items: allowed.map((it) => ({
        studentId: String(it.studentId),
        studentName: it.studentName,
        entryId: String(it.entryId),
        centerId: String(it.centerId),
        centerName: it.centerName,
        groupLabel: it.groupLabel,
        debt: it.debt,
        months: it.months || [],
        dueDate: it.dueDate || null,
      })),
    },
    dedupKey: `parent:${parent._id}:debt:${day}`,
  });
  if (!created) return null; // bugun allaqachon yuborilgan

  const reply_markup = await parentWebAppMarkup(t(lang, "parentOpenApp"), "/payments");
  const res = await sendRichToChat(
    parent.telegram.chatId,
    buildDebtDigestRich(lang, allowed),
    reply_markup ? { reply_markup } : {},
  );
  await markBlockedIfNeeded(parent, res);
  return created;
};

// Guruhning aktiv a'zolaridan faqat STUDENT roli bilan ulanganlari bor
// o'quvchilar (har biriga `notify` qimmat — loadContext/billing). Oldindan
// bitta so'rov bilan filtrlanadi: `role: "student"` yoki `null` (effectiveRole
// `findParents` ichida aniqlanadi).
const activeMembersWithStudentLink = async (groupId) => {
  const students = await Student.find({
    isDeleted: false,
    groups: { $elemMatch: { group: groupId, status: "active" } },
  });
  const tgOf = (s) => telegramFieldsOf(s).telegramPhone;
  const phones = [...new Set(students.map(tgOf).filter(Boolean))];
  if (!phones.length) return [];
  const linked = await Parent.find(
    { phone: { $in: phones }, "telegram.blockedAt": null, role: { $ne: "parent" } },
    { phone: 1 },
  ).lean();
  const set = new Set(linked.map((p) => p.phone));
  return students
    .filter((s) => set.has(tgOf(s)))
    .map((student) => ({
      student,
      entry: student.groups.find((e) => String(e.group) === String(groupId) && e.status === "active"),
    }))
    .filter((x) => x.entry);
};

const textHash = (text) => crypto.createHash("sha1").update(String(text)).digest("hex").slice(0, 10);

// UYGA VAZIFA (§4.4) — faqat o'quvchi roliga, sana bugun yoki kelajakda
// bo'lsa. DEBOUNCE: o'qituvchi matnni ketma-ket tuzatishi mumkin — oxirgi
// saqlashdan HOMEWORK_DEBOUNCE_MS o'tgach vazifa DB'dan QAYTA o'qiladi va
// eng so'nggi matn yuboriladi (o'chirilgan bo'lsa — hech narsa). Cluster'da
// har worker o'z taymerini qo'yishi mumkin: ikkalasi ham DB'dagi bir xil
// oxirgi matnni o'qiydi, Notification dedupKey (matn hash'i) esa takroriy
// xabarni to'xtatadi.
const hwTimers = new Map();

const sendHomework = async (groupId, date) => {
  if (date < moment.tz(TZ).format("YYYY-MM-DD")) return;
  const hw = await Homework.findOne({ group: groupId, date, isDeleted: false }).select("text").lean();
  if (!hw?.text) return;
  const hash = textHash(hw.text);
  for (const { student, entry } of await activeMembersWithStudentLink(groupId)) {
    await notify("homework", {
      student,
      entry,
      date,
      text: hw.text,
      dedupSuffix: `${date}:${hash}`,
      data: { date },
    });
  }
};

const onHomework = async ({ group, date }) => {
  if (!group?._id || date < moment.tz(TZ).format("YYYY-MM-DD")) return;
  const key = `${group._id}:${date}`;
  clearTimeout(hwTimers.get(key));
  const timer = setTimeout(async () => {
    hwTimers.delete(key);
    try {
      await sendHomework(group._id, date);
    } catch (error) {
      console.error("parentNotification homework:", error?.message || error);
    }
  }, HOMEWORK_DEBOUNCE_MS);
  timer.unref?.();
  hwTimers.set(key, timer);
};

// VAZIFA QILINMADI (API_CONTRACT_homework_missed.md) — o'qituvchi natijani
// "missed" qilganda. DEBOUNCE: xato bosib qaytarsa xabar ketmasin — taymer
// otganda Homework qayta o'qiladi va natija hali ham "missed" bo'lsagina
// yuboriladi. Dedup: `{entryId}:{date}` — bitta vazifa uchun bir marta.
const missedTimers = new Map();

const sendHomeworkMissed = async (homeworkId, studentId) => {
  const hw = await Homework.findOne({ _id: homeworkId, isDeleted: false }).select("group date text results").lean();
  const result = hw?.results?.find((r) => String(r.student) === String(studentId));
  if (result?.status !== "missed") return;
  const student = await Student.findOne({ _id: studentId, isDeleted: false });
  const entry = student?.groups?.find((e) => String(e.group) === String(hw.group) && e.status === "active");
  if (!entry) return;
  await notify("homeworkMissed", {
    student,
    entry,
    date: hw.date,
    text: hw.text,
    dedupSuffix: hw.date,
    data: { date: hw.date },
  });
};

const onHomeworkMissed = async ({ homeworkId, studentId }) => {
  const key = `${homeworkId}:${studentId}`;
  clearTimeout(missedTimers.get(key));
  const timer = setTimeout(async () => {
    missedTimers.delete(key);
    try {
      await sendHomeworkMissed(homeworkId, studentId);
    } catch (error) {
      console.error("parentNotification homeworkMissed:", error?.message || error);
    }
  }, HOMEWORK_DEBOUNCE_MS);
  timer.unref?.();
  missedTimers.set(key, timer);
};

// DARS ESLATMASI (§5) — darsdan 60 daqiqa oldin, faqat student roli.
// Dedup: `lessonReminder:{entryId}:{date}` (parent darajasida).
const onLessonReminder = async ({ groupId, date, topic = null }) => {
  for (const { student, entry } of await activeMembersWithStudentLink(groupId)) {
    await notify("lessonReminder", {
      student,
      entry,
      date,
      topic,
      dedupSuffix: date,
      data: { date },
    });
  }
};

// TEST (QUIZ) — docs/API_CONTRACT_quiz.md §6. Yuborilgan zahoti guruhdagi
// barcha o'quvchilarga (`Quiz.create()` fire-and-forget chaqiradi).
const onQuizSent = async ({ groupId, quizId }) => {
  const quiz = await require("../models/Quiz").findById(quizId).select("title startAt totalTimeSec questions").lean();
  if (!quiz) return;
  const info = {
    quizTitle: quiz.title || "",
    startTime: moment.unix(quiz.startAt).tz("Asia/Tashkent").format("HH:mm"),
    questionCount: quiz.questions.length,
    durationMin: Math.round(quiz.totalTimeSec / 60),
  };
  for (const { student, entry } of await activeMembersWithStudentLink(groupId)) {
    await notify("quizSent", {
      student,
      entry,
      quizId,
      ...info,
      dedupSuffix: String(quizId),
      data: { quizId: String(quizId) },
    });
  }
};

// Bitta o'quvchi natijasi — job (jobs/quiz.job.js) test "finished" bo'lganda
// har attempt uchun alohida chaqiradi, `notifiedAt` bilan idempotent.
const onQuizResult = async ({ groupId, quizId, studentId, correctCount, total, score }) => {
  const student = await Student.findOne({ _id: studentId, isDeleted: false });
  const entry = student?.groups?.find((e) => String(e.group) === String(groupId));
  if (!student || !entry) return;
  await notify("quizResult", {
    student,
    entry,
    quizId,
    correctCount,
    total,
    score,
    dedupSuffix: String(quizId),
    data: { quizId: String(quizId), correctCount, total, score },
  });
};

const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error("parentNotification:", error?.message || error);
    return null;
  }
};

module.exports = {
  // Ichki yordamchilar — QR kartani Telegramga yuborish (attendance.service,
  // API_CONTRACT_qr_card_send_and_worker_chat.md §A.2) shu qoidalarni qayta ishlatadi.
  findParents,
  markBlockedIfNeeded,

  // To'lov qabul qilindi / bekor qilindi. `payment` — entry.payments subdoc.
  onPayment: safe(async ({ student, entry, payment, cancelled = false }) => {
    await notify("payment", {
      student,
      entry,
      payment,
      cancelled,
      dedupSuffix: `${payment.code || payment._id}:${cancelled ? "cancelled" : "paid"}`,
      data: { paymentId: String(payment._id) },
    });
  }),

  // Davomat belgilandi (qo'lda yoki QR). 3 DAQIQALIK DEBOUNCE: o'qituvchi
  // holatni ketma-ket o'zgartirsa faqat oxirgisi ketadi. Holat Redis'da
  // (`bot:att:{student}:{group}:{date}`), taymer jarayonda; cluster'da
  // bir nechta worker taymeri otsa ham dedupKey (date+status+late) ikkinchi
  // xabarni yo'q qiladi. Keyinroq tuzatilsa (kelmadi → keldi) yangi holat
  // uchun yangi xabar ketadi — bu to'g'ri, ota-ona tuzatishni bilishi kerak.
  // Faqat BUGUNGI dars: o'tgan kunlarni ommaviy to'ldirish spam bo'lardi.
  onAttendance: safe(async ({ clientId, groupId, studentId, date, status, late = false, reason = "", today }) => {
    if (date !== today) return;
    const key = keyConfig.botAttendanceDebounce(studentId, groupId, date);
    await redis.set(key, JSON.stringify({ status, late, reason }), "EX", ATT_DEBOUNCE_SEC + 60);

    const timerKey = `${studentId}:${groupId}:${date}`;
    clearTimeout(attTimers.get(timerKey));
    const timer = setTimeout(async () => {
        attTimers.delete(timerKey);
        try {
          const raw = await redis.get(key);
          if (!raw) return;
          const latest = JSON.parse(raw);
          const student = await Student.findOne({ _id: studentId, isDeleted: false });
          if (!student) return;
          const entry = student.groups.find(
            (g) => String(g.group) === String(groupId) && String(g.client) === String(clientId),
          );
          if (!entry) return;
          await notify("attendance", {
            student,
            entry,
            date,
            ...latest,
            dedupSuffix: `${date}:${latest.status}:${latest.late ? "late" : "ontime"}`,
            data: { date },
          });
        } catch (error) {
          console.error("parentNotification attendance:", error?.message || error);
        }
    }, ATT_DEBOUNCE_SEC * 1000);
    attTimers.set(timerKey, timer);
  }),

  // Dars tugadi (jobs/lessonFinished.job.js) — faqat darsga KELGAN o'quvchi
  // uchun; baho (bo'lsa) va keyingi dars sanasi bilan.
  // `rankChange` — { from, to, total } faqat o'rin ko'tarilganda (§B).
  onLessonFinished: safe(async ({ student, entry, date, grade = null, nextLesson = null, rankChange = null }) => {
    await notify("lessonFinished", {
      student,
      entry,
      date,
      grade,
      nextLesson,
      rankChange,
      dedupSuffix: date,
      data: { date, grade, ...(rankChange ? { rankChange } : {}) },
    });
  }),

  // Oy yakunida berilgan yutuq nishonlari (jobs/badges.job.js) — bitta
  // a'zolik uchun BITTA xabar, shu oyda berilgan barcha nishonlar ro'yxati.
  // Dedup: `parent:{parentId}:badge:{entryId}:{month}`.
  onBadges: safe(async ({ student, entry, month, types }) => {
    // Markaz baholarni yashirgan bo'lsa `data.types` ham filtrlanadi — WebApp
    // bildirishnoma ikonkasi `types[0]`dan olinadi (matn builder'da filtrlanadi).
    const center = await Center.findById(entry.center).select("parentNotifications.showGrades").lean();
    const visible = filterHiddenGrades(types || [], center?.parentNotifications?.showGrades === false);
    if (!visible.length) return;
    await notify("badge", {
      student,
      entry,
      month,
      types: visible,
      dedupSuffix: month,
      data: { month, types: visible },
    });
  }),

  // WECOIN oy yakuni (coin.service.notifyMonth). Dedup: `{entryId}:{month}`.
  onCoins: safe(async ({ student, entry, month, amount, balance }) => {
    await notify("coin", {
      student,
      entry,
      month,
      amount,
      balance,
      dedupSuffix: month,
      data: { month, amount, centerId: String(entry.center) },
    });
  }),

  // Do'kon buyurtmasi topshirildi/qaytarildi (shop.service). Dedup: buyurtma + holat.
  onShopOrder: safe(async ({ student, entry, order }) => {
    await notify("shop", {
      student,
      entry,
      order,
      dedupSuffix: `${order._id}:${order.status}`,
      data: { orderId: String(order._id), status: order.status, centerId: String(entry.center) },
    });
  }),

  // Qarz kaskadi digesti — parent darajasida (jobs/parentDebt.job.js).
  onDebtDigest: safe(onDebtDigest),

  // Uyga vazifa (homework.service) va dars eslatmasi (lessonReminder.job) —
  // faqat o'quvchi roliga.
  onHomework: safe(onHomework),
  onHomeworkMissed: safe(onHomeworkMissed),
  onLessonReminder: safe(onLessonReminder),
  // Test (Quiz) — docs/API_CONTRACT_quiz.md §6.
  onQuizSent: safe(onQuizSent),
  onQuizResult: safe(onQuizResult),
  centerAllows,

  // Testlar/skriptlar uchun.
  _buildDebtDigestText: buildDebtDigestText,
  _buildPaymentText: buildPaymentText,
  _buildAttendanceText: buildAttendanceText,
  _buildLessonFinishedText: buildLessonFinishedText,
  _buildHomeworkText: buildHomeworkText,
  _buildHomeworkMissedText: buildHomeworkMissedText,
  _sendHomeworkMissed: sendHomeworkMissed,
  _buildLessonReminderText: buildLessonReminderText,
  _buildBadgeText: buildBadgeText,
  _findParents: findParents,
  _hasRecipients: async (student) => (await findParents(student)).length > 0,
  _Notification: Notification,
};
