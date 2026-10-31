const { Types } = require("mongoose");
const SmsTemplate = require("../models/SmsTemplate");
const SmsBatch = require("../models/SmsBatch");
const SmsLog = require("../models/SmsLog");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Center = require("../models/Center");
const Client = require("../models/Client");
const BillingSetting = require("../models/BillingSetting");
const Attendance = require("../models/Attendance");
const SmsPackage = require("../models/SmsPackage");
const SmsPurchase = require("../models/SmsPurchase");
const SmsTransaction = require("../models/SmsTransaction");
const SystemSetting = require("../models/SystemSetting");
const getsms = require("../utils/getsms.util");
const inpayUtil = require("../utils/inpay.util");
const { countSegments } = require("../utils/smsSegments.util");
const smsBalance = require("../utils/smsBalance.util");
const { appUrlOf } = require("../utils/brand.util");
const envConfig = require("../configs/env.config");
const emit = require("../utils/emitter.util");
const { getAdminIo } = require("../configs/socket.config");
const audit = require("../utils/audit.util");
const { normalizePhone } = require("../utils/phone.util");
const { getNow, currentMonthString, todayString } = require("../utils/date.util");

const PAGE_SIZE = 30;
const MIN_PRICE = 1000; // inPAY minimumi
const ALERT_INTERVAL = 12 * 3600;
const MAX_RECIPIENTS = 2000;
const STALE_SENDING_SECONDS = 30 * 60;
const DUPLICATE_WINDOW_SECONDS = 5 * 60;
const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktyabr", "Noyabr", "Dekabr",
];

const GIFT_PACKAGE_NAME = "Sovg'a";
const isText = (v) => typeof v === "string";
const fmtSum = (n) => `${Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
const monthLabel = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  return m >= 1 && m <= 12 ? `${MONTH_NAMES[m - 1]} ${y}` : "";
};

const templateDTO = (t) => ({
  _id: t._id,
  title: t.title,
  topic: t.topic,
  text: t.text,
  active: t.active,
  order: t.order,
});

const batchDTO = (b) => ({
  _id: b._id,
  center: b.center,
  template: b.template,
  templateTitle: b.templateTitle,
  topic: b.topic,
  audience: b.audience,
  filters: b.filters,
  createdBy: b.createdBy,
  total: b.total,
  sent: b.sent,
  delivered: b.delivered,
  failed: b.failed,
  skipped: b.skipped,
  segments: b.segments || 0,
  refundedSegments: b.refundedSegments || 0,
  status: b.status,
  startedAt: b.startedAt,
  finishedAt: b.finishedAt,
});

const logDTO = (l) => ({
  _id: l._id,
  studentName: l.studentName,
  phone: /^\d+$/.test(l.phone) ? `+${l.phone}` : l.phone,
  text: l.text,
  status: l.status,
  error: l.error,
  sentAt: l.sentAt,
  deliveredAt: l.deliveredAt,
});

// {o'zgaruvchi}lar faqat ruxsat etilgan ro'yxatdan bo'lishi shart.
const validateTemplateBody = (body) => {
  const { title, topic, text, active, order } = body || {};
  if (!title || !text) throw new Error("sms.fillTheRows");
  if (!isText(title) || !isText(text)) throw new Error("sms.invalidValue");
  if (topic && !SmsTemplate.TOPICS.includes(topic)) throw new Error("sms.invalidTopic");
  if (text.trim().length > 1000) throw new Error("sms.textTooLong");
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (used.some((v) => !SmsTemplate.VARIABLES.includes(v))) throw new Error("sms.unknownVariable");
  return {
    title: title.trim(),
    topic: topic || "info",
    text: text.trim(),
    active: active !== false,
    order: Number(order) || 0,
  };
};

const render = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));

const requireCenter = async (clientId, centerId) => {
  if (!centerId || !Types.ObjectId.isValid(centerId)) throw new Error("sms.centerRequired");
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false }).select("name");
  if (!center) throw new Error("center.notFound");
  return center;
};

// Tizim darajasidagi getsms akkaunti (env). Filialga bog'liq emas.
const systemCreds = () => {
  const { GETSMS_LOGIN, GETSMS_PASSWORD, GETSMS_NICKNAME } = envConfig;
  if (!GETSMS_LOGIN || !GETSMS_PASSWORD) return null;
  return { login: GETSMS_LOGIN, password: GETSMS_PASSWORD, nickname: GETSMS_NICKNAME || "" };
};

const requireCreds = async () => {
  const creds = systemCreds();
  if (!creds) throw new Error("sms.notConfigured");
  return creds;
};

const getTemplate = async (templateId) => {
  if (!templateId || !Types.ObjectId.isValid(templateId)) throw new Error("sms.templateNotFound");
  const tpl = await SmsTemplate.findOne({ _id: templateId, active: true });
  if (!tpl) throw new Error("sms.templateNotFound");
  return tpl;
};

// Preview va send uchun YAGONA qabul qiluvchilar yig'uvchi.
const buildRecipients = async (clientId, center, tpl, opts) => {
  const { studentService } = { studentService: require("./student.service") };
  const audience = opts.audience === "students" ? "students" : "parents";
  const usesDebt = /\{debt\}/.test(tpl.text);
  const debtOnly = !!opts.debtOnly || usesDebt;
  const month = /^\d{4}-\d{2}$/.test(opts.month || "") ? opts.month : currentMonthString();
  const groupIds = (Array.isArray(opts.groupIds) ? opts.groupIds : [])
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const entryMatch = { client: clientId, center: center._id, status: "active" };
  if (groupIds.length) entryMatch.group = { $in: groupIds };
  const students = await Student.find({ isDeleted: false, groups: { $elemMatch: entryMatch } })
    .select("fullName phone parentPhone groups")
    .lean();

  const gIds = [...new Set(students.flatMap((s) => s.groups.map((g) => String(g.group))))];
  const groups = await Group.find({ _id: { $in: gIds } })
    .select("name status activatedAt finishedAt center days lessonOffset subject")
    .lean();
  const groupMap = Object.fromEntries(groups.map((g) => [String(g._id), g]));
  const cycle = await BillingSetting.findOne({ center: center._id }).select("cycleMode").lean();
  const cycleMode = cycle?.cycleMode || "anchor";

  // "Darsga kelmadi" mavzusi: faqat tanlangan kuni davomatda `absent` bo'lganlar.
  const isAbsentTopic = tpl.topic === "absent";
  const absentDate = /^\d{4}-\d{2}-\d{2}$/.test(opts.date || "") ? opts.date : todayString();
  const dateText = absentDate.split("-").reverse().join(".");
  let absentSet = null;
  if (isAbsentTopic) {
    const sessions = await Attendance.find({ client: clientId, center: center._id, date: absentDate })
      .select("group records")
      .lean();
    absentSet = new Set(
      sessions.flatMap((a) =>
        a.records.filter((r) => r.status === "absent").map((r) => `${a.group}|${r.student}`),
      ),
    );
  }

  const wanted = new Set(groupIds.map(String));
  const seen = new Set();
  const items = [];
  let skipped = 0;
  for (const s of students) {
    for (const entry of s.groups) {
      if (String(entry.client) !== String(clientId) || String(entry.center) !== String(center._id)) continue;
      if (entry.status !== "active") continue;
      if (wanted.size && !wanted.has(String(entry.group))) continue;
      const group = groupMap[String(entry.group)];
      if (!group) continue;
      if (absentSet && !absentSet.has(`${entry.group}|${s._id}`)) continue;

      let debt = 0;
      let debtMonths = [];
      if (debtOnly || usesDebt) {
        const billing = studentService.computeBilling(entry, group, cycleMode);
        debt = billing.debt || 0;
        debtMonths = (billing.debtBreakdown || []).map((r) => r.month).filter(Boolean);
        if (debtOnly && !(debt > 0)) continue;
      }

      const rawPhone = audience === "parents" ? s.parentPhone : s.phone;
      const phone = getsms.toGatewayPhone(normalizePhone(rawPhone));
      if (!phone) {
        skipped += 1;
        items.push({ studentId: s._id, name: s.fullName, phone: normalizePhone(rawPhone) || "", text: "", skip: true });
        continue;
      }

      const monthText = debtMonths.length ? debtMonths.map(monthLabel).join(", ") : monthLabel(month);
      const text = render(tpl.text, {
        center: center.name,
        student: s.fullName,
        group: group.name || "",
        price: fmtSum(entry.price),
        debt: fmtSum(debt),
        month: monthText,
        date: dateText,
      });
      const key = `${phone}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ studentId: s._id, name: s.fullName, phone, text, segments: countSegments(text) });
    }
  }
  return { items, skipped, debtOnly, forcedDebtOnly: usesDebt && !opts.debtOnly, absentDate: isAbsentTopic ? absentDate : null };
};

const packageDTO = (p) => ({
  _id: p._id,
  name: p.name,
  smsCount: p.smsCount,
  price: p.price,
  validityDays: p.validityDays,
  pricePerSms: Math.round((p.price / p.smsCount) * 100) / 100,
});

const adminPackageDTO = (p) => ({ ...packageDTO(p), active: p.active, order: p.order });

const purchaseDTO = (p) => ({
  _id: p._id,
  orderId: p.orderId,
  packageName: p.packageName,
  smsCount: p.smsCount,
  remaining: p.remaining,
  price: p.price,
  status: p.status,
  expiresAt: p.expiresAt ?? null,
  paidAt: p.paidAt ?? null,
  createdAt: p.createdAt,
});

const pageMeta = (page, total) => ({
  page,
  limit: PAGE_SIZE,
  total,
  totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
});

// Platform Admin ilovasiga: yangi paket (sotuv yoki sovg'a) — Sotuvlar/Zaxira jadvallari yangilansin.
const emitAdminPurchase = (purchase) => {
  try {
    getAdminIo().emit("sms:purchase", { _id: purchase._id, client: purchase.client, center: purchase.center, smsCount: purchase.smsCount });
  } catch {
    // Admin socket ko'tarilmagan bo'lishi mumkin — ma'lumot baribir saqlangan.
  }
};

// Balans o'zgargach (spend/refund/topup) `client:{id}` xonasiga yangi balansni yuboradi.
const emitBalance = async (clientId, centerId) => {
  try {
    emit.toCenter(clientId, centerId, "sms:balance", {
      center: String(centerId),
      balance: await smsBalance.getBalance(clientId, centerId),
    });
  } catch (error) {
    console.error("[sms] emitBalance", error);
  }
};

// Getsms zaxirasi kam qolsa Telegram ogohlantirishi (12 soatda ko'pi bilan bir marta).
const gatewayStats = async () => {
  const [setting, agg] = await Promise.all([
    SystemSetting.findOne({ key: "global" }).select("sms").lean(),
    SmsTransaction.aggregate([
      { $match: { type: { $in: ["spend", "refund"] } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
  ]);
  const sum = Object.fromEntries(agg.map((r) => [r._id, r.total]));
  const gatewayPurchased = setting?.sms?.gatewayPurchased || 0;
  const lowThreshold = setting?.sms?.lowThreshold ?? 1000;
  const sentSegments = (sum.spend || 0) - (sum.refund || 0);
  const refundedSegments = sum.refund || 0;
  const gatewayRemaining = gatewayPurchased - sentSegments;
  return {
    gatewayPurchased,
    lowThreshold,
    sentSegments,
    refundedSegments,
    gatewayRemaining,
    // Zaxira kiritilmagan (0) bo'lsa "kam" deb hisoblanmaydi.
    low: gatewayPurchased > 0 && gatewayRemaining <= lowThreshold,
  };
};

const checkLowStock = async () => {
  try {
    const g = await gatewayStats();
    if (!g.low) return;
    const now = getNow();
    const claimed = await SystemSetting.findOneAndUpdate(
      { key: "global", $or: [{ "sms.lastAlertAt": null }, { "sms.lastAlertAt": { $lte: now - ALERT_INTERVAL } }] },
      { $set: { "sms.lastAlertAt": now } },
    );
    if (!claimed) return;
    await require("./systemSetting.service").invalidate();
    await require("../bot/alert").sendAlert(
      "smsStock",
      {
        title: "SMS zaxirasi kam qoldi",
        body: "Getsms'dan SMS sotib olish kerak.",
        meta: { Qoldi: g.gatewayRemaining, Chegara: g.lowThreshold, Sotib_olingan: g.gatewayPurchased },
      },
      { throttle: false },
    );
  } catch (error) {
    console.error("[sms] checkLowStock", error);
  }
};

const emitBatch = (batch) => {
  emit.toCenter(batch.client, batch.center, "sms:batch", { ...batchDTO(batch), center: batch.center });
};

// Fon rejimida yuborish: 100 tadan bo'lib, natijani SmsLog/SmsBatch'ga yozadi.
// Shlyuz qabul qilmagan (yuborish paytida failed) SMS segmentlari oxirida balansga qaytariladi.
const processBatch = async (batchId) => {
  const batch = await SmsBatch.findById(batchId);
  if (!batch) return;
  let refundSegments = 0;
  try {
    const creds = await requireCreds();
    const logs = await SmsLog.find({ batch: batchId, status: "queued" }).sort({ _id: 1 });
    for (let i = 0; i < logs.length; i += getsms.MAX_BATCH) {
      const chunk = logs.slice(i, i + getsms.MAX_BATCH);
      let results;
      try {
        results = await getsms.send(creds, chunk.map((l) => ({ phone: l.phone, text: l.text })));
      } catch (error) {
        results = chunk.map(() => ({ ok: false, error: error.message }));
      }
      const now = getNow();
      await Promise.all(
        chunk.map((log, idx) => {
          const r = results[idx];
          log.status = r.ok ? "sent" : "failed";
          log.error = r.ok ? "" : String(r.error || "");
          log.requestId = r.requestId || "";
          log.sentAt = now;
          if (!r.ok) refundSegments += log.segments || 1;
          return log.save();
        }),
      );
      batch.sent += results.filter((r) => r.ok).length;
      batch.failed += results.filter((r) => !r.ok).length;
      await batch.save();
      emitBatch(batch);
    }
    batch.status = batch.sent === 0 && batch.failed > 0 ? "failed" : "done";
  } catch (error) {
    console.error("[sms] processBatch", error);
    batch.status = "failed";
    // Hali yuborilmay qolganlar (masalan akkaunt sozlanmagan) — hammasi qaytariladi.
    const left = await SmsLog.find({ batch: batchId, status: "queued" }).select("segments");
    if (left.length) {
      refundSegments += left.reduce((n, l) => n + (l.segments || 1), 0);
      await SmsLog.updateMany(
        { batch: batchId, status: "queued" },
        { $set: { status: "failed", error: String(error.message || "failed") } },
      );
      batch.failed += left.length;
    }
  }
  batch.finishedAt = getNow();
  try {
    await refundBatch(batch, refundSegments);
  } catch (error) {
    console.error("[sms] refundBatch", error);
  }
  await batch.save();
  emitBatch(batch);
  await emitBalance(batch.client, batch.center);
  void checkLowStock();
};

// Batch.allocations bo'yicha qaytarish + `refund` tranzaksiyasi (batch hujjatini mutatsiya qiladi).
const refundBatch = async (batch, amount) => {
  if (amount < 1) return;
  const given = await smsBalance.refundToAllocations(batch.allocations, amount);
  if (given < 1) return;
  batch.markModified("allocations");
  batch.refundedSegments = (batch.refundedSegments || 0) + given;
  const names = await SmsPurchase.find({ _id: { $in: batch.allocations.filter((a) => a.refunded > 0).map((a) => a.purchase) } })
    .select("packageName")
    .lean();
  await SmsTransaction.create({
    client: batch.client,
    center: batch.center,
    type: "refund",
    amount: given,
    batch: batch._id,
    purchase: batch.allocations.length === 1 ? batch.allocations[0].purchase : null,
    packageName: [...new Set(names.map((n) => n.packageName).filter(Boolean))].join(", "),
    note: "gateway",
  });
};

// request_id bo'yicha yetkazilish holatini yangilaydi (qo'lda yoki job).
const refreshLogs = async (logs) => {
  let changed = 0;
  const batchIds = new Set();
  const creds = systemCreds();
  if (!creds) return 0;
  for (const log of logs) {
    if (!log.requestId) continue;
    try {
      const { status, description } = await getsms.status(creds, log.requestId);
      if (status === "delivered") {
        log.status = "delivered";
        log.deliveredAt = getNow();
      } else if (["failed", "rejected", "undelivered", "expired"].includes(status)) {
        log.status = "failed";
        log.error = description || status;
      } else continue;
      await log.save();
      changed += 1;
      if (log.batch) batchIds.add(String(log.batch));
    } catch {
      // shlyuz vaqtincha javob bermasa — keyingi urinishda qayta tekshiriladi
    }
  }
  for (const id of batchIds) {
    const [delivered, failed] = await Promise.all([
      SmsLog.countDocuments({ batch: id, status: "delivered" }),
      SmsLog.countDocuments({ batch: id, status: "failed" }),
    ]);
    const batch = await SmsBatch.findByIdAndUpdate(id, { delivered, failed }, { returnDocument: "after" });
    if (batch) emitBatch(batch);
  }
  return changed;
};

// Paket tanasi: soni/narxi/muddati noto'g'ri bo'lsa `sms.invalidPackage`, narx < 1000 bo'lsa `sms.minAmount`.
const validatePackageBody = (body) => {
  const { name, smsCount, price, validityDays, active, order } = body || {};
  if (!isText(name) || !name.trim()) throw new Error("sms.fillTheRows");
  const isInt = (v) => typeof v === "number" && Number.isInteger(v);
  if (!isInt(smsCount) || smsCount < 1) throw new Error("sms.invalidPackage");
  if (typeof price !== "number" || !Number.isFinite(price)) throw new Error("sms.invalidPackage");
  if (price < MIN_PRICE) throw new Error("sms.minAmount");
  const days = validityDays === undefined ? 30 : validityDays;
  if (!isInt(days) || days < 0) throw new Error("sms.invalidPackage");
  return {
    name: name.trim().slice(0, 100),
    smsCount,
    price: Math.round(price),
    validityDays: days,
    active: active !== false,
    order: Number(order) || 0,
  };
};

module.exports = {
  templateDTO,
  refreshLogs,

  // ── Shablonlar ──────────────────────────────────────────────────────────
  listTemplates: async ({ onlyActive = true } = {}) => {
    const rows = await SmsTemplate.find(onlyActive ? { active: true } : {}).sort({ order: 1, createdAt: 1 }).lean();
    return rows.map(templateDTO);
  },

  createTemplate: async (body) => templateDTO(await SmsTemplate.create(validateTemplateBody(body))),

  updateTemplate: async (id, body) => {
    const tpl = await SmsTemplate.findById(id);
    if (!tpl) throw new Error("sms.templateNotFound");
    Object.assign(tpl, validateTemplateBody(body));
    await tpl.save();
    return templateDTO(tpl);
  },

  removeTemplate: async (id) => {
    const tpl = await SmsTemplate.findByIdAndDelete(id);
    if (!tpl) throw new Error("sms.templateNotFound");
  },

  // ── Filial darajasi ─────────────────────────────────────────────────────
  summary: async (clientId, centerId) => {
    await requireCenter(clientId, centerId);
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const [last, agg] = await Promise.all([
      SmsBatch.findOne({ client: clientId, center: centerId }).sort({ createdAt: -1 }).lean(),
      SmsBatch.aggregate([
        { $match: { client: new Types.ObjectId(clientId), center: new Types.ObjectId(centerId), createdAt: { $gte: monthStart } } },
        { $group: { _id: null, batches: { $sum: 1 }, sent: { $sum: "$sent" }, delivered: { $sum: "$delivered" }, failed: { $sum: "$failed" } } },
      ]),
    ]);
    const m = agg[0] || { batches: 0, sent: 0, delivered: 0, failed: 0 };
    const balance = await smsBalance.getBalance(clientId, centerId);
    return {
      balance,
      last: last ? batchDTO(last) : null,
      month: { batches: m.batches, sent: m.sent, delivered: m.delivered, failed: m.failed },
    };
  },

  preview: async (clientId, centerId, body) => {
    const center = await requireCenter(clientId, centerId);
    const tpl = await getTemplate(body?.templateId);
    const r = await buildRecipients(clientId, center, tpl, body || {});
    const valid = r.items.filter((i) => !i.skip);
    const totalSegments = valid.reduce((n, i) => n + i.segments, 0);
    const balance = await smsBalance.getTotal(clientId, center._id);
    return {
      total: valid.length,
      totalSegments,
      balance,
      enough: balance >= totalSegments,
      noPhone: r.skipped,
      debtOnly: r.debtOnly,
      forcedDebtOnly: r.forcedDebtOnly,
      sample: valid.slice(0, 5).map((i) => ({ name: i.name, phone: i.phone, text: i.text })),
    };
  },

  send: async (clientId, centerId, body, actor = null) => {
    const center = await requireCenter(clientId, centerId);
    const tpl = await getTemplate(body?.templateId);
    const audience = body?.audience === "students" ? "students" : "parents";
    await requireCreds();

    const running = await SmsBatch.findOne({
      client: clientId,
      center: centerId,
      status: "sending",
      startedAt: { $gte: getNow() - STALE_SENDING_SECONDS },
    }).select("_id");
    if (running) throw new Error("sms.alreadySending");

    const r = await buildRecipients(clientId, center, tpl, body || {});
    const valid = r.items.filter((i) => !i.skip);
    if (!valid.length) throw new Error("sms.noRecipients");

    // Tasodifiy ikki marta bosish: xuddi shu shablon/auditoriya/filtr 5 daqiqa ichida qayta yuborilmaydi.
    const groupKey = (ids) => (ids || []).map(String).sort().join(",");
    const recent = await SmsBatch.find({
      client: clientId,
      center: centerId,
      template: tpl._id,
      audience,
      createdAt: { $gte: getNow() - DUPLICATE_WINDOW_SECONDS },
    })
      .select("filters")
      .lean();
    const wantedGroups = groupKey((body.groupIds || []).filter((id) => Types.ObjectId.isValid(id)));
    if (
      recent.some(
        (b) =>
          groupKey(b.filters?.groupIds) === wantedGroups &&
          !!b.filters?.debtOnly === r.debtOnly &&
          (b.filters?.date || "") === (r.absentDate || ""),
      )
    ) {
      throw new Error("sms.duplicateRecently");
    }
    if (valid.length > MAX_RECIPIENTS) throw new Error("sms.tooManyRecipients");

    const totalSegments = valid.reduce((n, i) => n + i.segments, 0);
    if ((await smsBalance.getTotal(clientId, center._id)) < totalSegments) throw new Error("sms.insufficientBalance");

    const batch = await SmsBatch.create({
      client: clientId,
      center: center._id,
      template: tpl._id,
      templateTitle: tpl.title,
      topic: tpl.topic,
      audience,
      filters: {
        groupIds: (body.groupIds || []).filter((id) => Types.ObjectId.isValid(id)),
        debtOnly: r.debtOnly,
        month: body.month || "",
        date: r.absentDate || "",
      },
      createdBy: { id: actor?.id || null, kind: actor?.kind || "", name: actor?.name || "" },
      total: r.items.length,
      skipped: r.skipped,
      segments: totalSegments,
    });

    const now = getNow();
    await SmsLog.insertMany(
      r.items.map((i) => ({
        batch: batch._id,
        client: clientId,
        center: center._id,
        student: i.studentId,
        studentName: i.name,
        phone: i.phone,
        text: i.text,
        segments: i.skip ? 0 : i.segments,
        status: i.skip ? "skipped" : "queued",
        error: i.skip ? "noPhone" : "",
        createdAt: now,
      })),
    );

    // Yechish yuborishdan OLDIN, atomar. Poyga tufayli yetmay qolsa partiya bekor qilinadi.
    let allocations;
    try {
      allocations = await smsBalance.deduct(clientId, center._id, totalSegments);
    } catch (error) {
      batch.status = "failed";
      batch.finishedAt = getNow();
      await batch.save();
      await SmsLog.updateMany({ batch: batch._id, status: "queued" }, { $set: { status: "failed", error: error.message } });
      throw error;
    }
    batch.allocations = allocations.map((a) => ({ purchase: a.purchase, count: a.count, refunded: 0 }));
    await batch.save();
    await SmsTransaction.create({
      client: clientId,
      center: center._id,
      type: "spend",
      amount: totalSegments,
      batch: batch._id,
      purchase: allocations.length === 1 ? allocations[0].purchase : null,
      packageName: [...new Set(allocations.map((a) => a.packageName).filter(Boolean))].join(", "),
      note: tpl.title,
    });
    void emitBalance(clientId, center._id);
    void checkLowStock();

    void audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "sms:send",
      entity: { type: "sms", id: batch._id, label: tpl.title },
      meta: { total: valid.length, audience },
    });

    void processBatch(batch._id);
    return batchDTO(batch);
  },

  listBatches: async (clientId, centerId, { page = 1 } = {}) => {
    await requireCenter(clientId, centerId);
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = { client: clientId, center: centerId };
    const [rows, total] = await Promise.all([
      SmsBatch.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      SmsBatch.countDocuments(filter),
    ]);
    return {
      data: rows.map(batchDTO),
      meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  },

  batchDetail: async (clientId, centerId, batchId, { page = 1, status = "" } = {}) => {
    const batch = await SmsBatch.findOne({ _id: batchId, client: clientId, center: centerId }).lean();
    if (!batch) throw new Error("sms.batchNotFound");
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = { batch: batch._id };
    if (status) filter.status = status;
    const [rows, total] = await Promise.all([
      SmsLog.find(filter).sort({ _id: 1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      SmsLog.countDocuments(filter),
    ]);
    return {
      batch: batchDTO(batch),
      data: rows.map(logDTO),
      meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  },

  // Qo'lda "Holatni yangilash" — shu partiyaning yetkazilmagan SMS'lari.
  refreshBatch: async (clientId, centerId, batchId) => {
    const batch = await SmsBatch.findOne({ _id: batchId, client: clientId, center: centerId }).select("_id");
    if (!batch) throw new Error("sms.batchNotFound");
    const logs = await SmsLog.find({ batch: batch._id, status: "sent" }).limit(500);
    await refreshLogs(logs);
  },

  // ── Platform Admin ──────────────────────────────────────────────────────
  adminBatches: async ({ page = 1, client = "", center = "" } = {}) => {
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = {};
    if (client && Types.ObjectId.isValid(client)) filter.client = client;
    if (center && Types.ObjectId.isValid(center)) filter.center = center;
    const [rows, total] = await Promise.all([
      SmsBatch.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      SmsBatch.countDocuments(filter),
    ]);
    const [clients, centers] = await Promise.all([
      Client.find({ _id: { $in: rows.map((r) => r.client) } }).select("name").lean(),
      Center.find({ _id: { $in: rows.map((r) => r.center) } }).select("name").lean(),
    ]);
    const cn = Object.fromEntries(clients.map((c) => [String(c._id), c.name]));
    const ccn = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));
    return {
      data: rows.map((r) => ({
        ...batchDTO(r),
        clientName: cn[String(r.client)] || "",
        centerName: ccn[String(r.center)] || "",
      })),
      meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  },

  adminBatchDetail: async (batchId, { page = 1, status = "" } = {}) => {
    const batch = await SmsBatch.findById(batchId).select("client center");
    if (!batch) throw new Error("sms.batchNotFound");
    return module.exports.batchDetail(batch.client, batch.center, batchId, { page, status });
  },

  // Bitta raqamga test SMS (admin panel) — tizim akkaunti bilan.
  adminTest: async ({ phone, text } = {}) => {
    if (!isText(text) || !text.trim()) throw new Error("sms.fillTheRows");
    if (text.length > 1000) throw new Error("sms.textTooLong");
    const gw = getsms.toGatewayPhone(normalizePhone(phone));
    if (!gw) throw new Error("sms.invalidPhone");

    const creds = await requireCreds();
    const log = await SmsLog.create({ phone: gw, text: text.trim(), isTest: true, studentName: "TEST" });
    const [r] = await getsms.send(creds, [{ phone: gw, text: text.trim() }]);
    log.status = r.ok ? "sent" : "failed";
    log.error = r.ok ? "" : String(r.error || "");
    log.requestId = r.requestId || "";
    log.sentAt = getNow();
    await log.save();
    return logDTO(log);
  },

  adminTestStatus: async (logId) => {
    const log = await SmsLog.findOne({ _id: logId, isTest: true });
    if (!log) throw new Error("sms.batchNotFound");
    if (log.status === "sent") await refreshLogs([log]);
    return logDTO(await SmsLog.findById(logId));
  },

  // ── SMS paketlar: Client ────────────────────────────────────────────────
  listPackages: async () => {
    const rows = await SmsPackage.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
    return rows.map(packageDTO);
  },

  // Owner paketni tanlaydi: inPAY to'lovi yaratiladi, SmsPurchase(pending) yoziladi.
  buyPackage: async (clientId, centerId, packageId) => {
    const center = await requireCenter(clientId, centerId);
    if (!packageId || !Types.ObjectId.isValid(packageId)) throw new Error("sms.packageNotFound");
    const pkg = await SmsPackage.findOne({ _id: packageId, active: true });
    if (!pkg) throw new Error("sms.packageNotFound");
    if (pkg.price < MIN_PRICE) throw new Error("sms.minAmount");
    const client = await Client.findOne({ _id: clientId, isDeleted: false }).select("slug phone");
    if (!client) throw new Error("client.notFound");

    const { payUrl, orderId } = await inpayUtil.createPayment({
      amount: pkg.price,
      description: `WENET SMS paket — ${pkg.name} (${pkg.smsCount} ta) · ${center.name}`,
      callbackUrl: `${envConfig.SERVER_URL}/api/inpay/callback`,
      returnUrl: `${appUrlOf(client.slug)}/sms`,
      phone: client.phone,
    });

    await SmsPurchase.create({
      client: client._id,
      center: center._id,
      package: pkg._id,
      packageName: pkg.name,
      smsCount: pkg.smsCount,
      remaining: 0,
      price: pkg.price,
      validityDays: pkg.validityDays,
      orderId,
      payUrl,
      status: "pending",
    });
    return { payUrl, orderId };
  },

  // order_id SMS sotuviga tegishlimi (inPAY webhook marshrutlash uchun).
  isSmsOrder: async (orderId) => !!(await SmsPurchase.exists({ orderId })),

  // Webhook va qo'lda polling ikkalasi ham shuni chaqiradi — idempotent. Holat har doim
  // inPAY'dan qayta so'raladi, `pending` → `paid` o'tishi atomar (bitta marta kreditlanadi).
  // `clientId` berilsa sotuv shu clientniki ekani tekshiriladi.
  verifyAndCredit: async (orderId, clientId = null) => {
    const purchase = await SmsPurchase.findOne({ orderId });
    if (!purchase || (clientId && String(purchase.client) !== String(clientId))) {
      throw new Error("sms.purchaseNotFound");
    }

    const paidResult = async (p) => ({
      status: "paid",
      credited: true,
      smsCount: p.smsCount,
      balance: await smsBalance.getBalance(p.client, p.center),
    });

    if (purchase.status === "paid") return paidResult(purchase);
    if (purchase.status !== "pending") return { status: purchase.status, credited: false };

    const status = await inpayUtil.getTransactionStatus(orderId);

    if (status === "paid") {
      const now = getNow();
      const credited = await SmsPurchase.findOneAndUpdate(
        { orderId, status: "pending" },
        {
          $set: {
            status: "paid",
            remaining: purchase.smsCount,
            paidAt: now,
            expiresAt: purchase.validityDays > 0 ? now + purchase.validityDays * 86400 : null,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
      // Parallel chaqiruv allaqachon kreditlagan — qayta kreditlanmaydi.
      if (!credited) return paidResult(await SmsPurchase.findOne({ orderId }));

      await SmsTransaction.create({
        client: credited.client,
        center: credited.center,
        type: "topup",
        amount: credited.smsCount,
        purchase: credited._id,
        packageName: credited.packageName,
      });
      const balance = await smsBalance.getBalance(credited.client, credited.center);
      emit.toCenter(credited.client, credited.center, "sms:credited", {
        center: String(credited.center),
        smsCount: credited.smsCount,
        expiresAt: credited.expiresAt,
        packageName: credited.packageName,
        balance,
      });
      emitAdminPurchase(credited);
      return { status: "paid", credited: true, smsCount: credited.smsCount, balance };
    }

    if (status === "cancelled" || status === "failed") {
      await SmsPurchase.updateOne({ orderId, status: "pending" }, { $set: { status, updatedAt: getNow() } });
      return { status, credited: false };
    }
    return { status: "pending", credited: false };
  },

  listPurchases: async (clientId, centerId, { page = 1 } = {}) => {
    await requireCenter(clientId, centerId);
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = { client: clientId, center: centerId };
    const [rows, total] = await Promise.all([
      SmsPurchase.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      SmsPurchase.countDocuments(filter),
    ]);
    return { data: rows.map(purchaseDTO), meta: pageMeta(pageNum, total) };
  },

  listTransactions: async (clientId, centerId, { page = 1, type = "" } = {}) => {
    await requireCenter(clientId, centerId);
    await smsBalance.expireDue(clientId);
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = { client: clientId, center: centerId };
    if (["topup", "spend", "refund", "expire"].includes(type)) filter.type = type;
    const [rows, total] = await Promise.all([
      SmsTransaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("batch", "templateTitle")
        .lean(),
      SmsTransaction.countDocuments(filter),
    ]);
    return {
      data: rows.map((t) => ({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        packageName: t.packageName,
        batchTitle: t.batch?.templateTitle || undefined,
        center: t.center,
        createdAt: t.createdAt,
      })),
      meta: pageMeta(pageNum, total),
    };
  },

  // ── SMS paketlar: Platform Admin ────────────────────────────────────────
  adminListPackages: async () => {
    const rows = await SmsPackage.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return rows.map(adminPackageDTO);
  },

  adminCreatePackage: async (body) => adminPackageDTO(await SmsPackage.create(validatePackageBody(body))),

  adminUpdatePackage: async (id, body) => {
    if (!Types.ObjectId.isValid(id)) throw new Error("sms.packageNotFound");
    const pkg = await SmsPackage.findById(id);
    if (!pkg) throw new Error("sms.packageNotFound");
    Object.assign(pkg, validatePackageBody(body), { updatedAt: getNow() });
    await pkg.save();
    return adminPackageDTO(pkg);
  },

  adminRemovePackage: async (id) => {
    if (!Types.ObjectId.isValid(id)) throw new Error("sms.packageNotFound");
    const pkg = await SmsPackage.findByIdAndDelete(id);
    if (!pkg) throw new Error("sms.packageNotFound");
  },

  adminStats: async () => {
    const [g, paid] = await Promise.all([
      gatewayStats(),
      SmsPurchase.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, sold: { $sum: "$smsCount" }, revenue: { $sum: "$price" } } },
      ]),
    ]);
    return {
      sold: paid[0]?.sold || 0,
      sentSegments: g.sentSegments,
      refundedSegments: g.refundedSegments,
      gatewayPurchased: g.gatewayPurchased,
      gatewayRemaining: g.gatewayRemaining,
      lowThreshold: g.lowThreshold,
      low: g.low,
      revenue: paid[0]?.revenue || 0,
    };
  },

  adminUpdateStats: async (body) => {
    const { gatewayPurchased, lowThreshold } = body || {};
    const $set = {};
    for (const [key, v] of [["gatewayPurchased", gatewayPurchased], ["lowThreshold", lowThreshold]]) {
      if (v === undefined) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("sms.invalidValue");
      $set[`sms.${key}`] = Math.floor(v);
    }
    if (Object.keys($set).length) {
      $set.updatedAt = getNow();
      await SystemSetting.findOneAndUpdate({ key: "global" }, { $set }, { upsert: true });
      await require("./systemSetting.service").invalidate();
    }
    void checkLowStock();
    return module.exports.adminStats();
  },

  adminPurchases: async ({ page = 1, client = "" } = {}) => {
    const pageNum = Math.max(1, Number(page) || 1);
    const filter = { status: "paid" };
    if (client && Types.ObjectId.isValid(client)) filter.client = client;
    const [rows, total] = await Promise.all([
      SmsPurchase.find(filter).sort({ paidAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      SmsPurchase.countDocuments(filter),
    ]);
    const clients = await Client.find({ _id: { $in: rows.map((r) => r.client) } }).select("name").lean();
    const cn = Object.fromEntries(clients.map((c) => [String(c._id), c.name]));
    const centers = await Center.find({ _id: { $in: rows.map((r) => r.center).filter(Boolean) } }).select("name").lean();
    const ctn = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));
    return {
      data: rows.map((r) => ({
        ...purchaseDTO(r),
        client: r.client,
        clientName: cn[String(r.client)] || "",
        centerName: ctn[String(r.center)] || "",
      })),
      meta: pageMeta(pageNum, total),
    };
  },
  // Admin: mijozning tanlangan filialiga to'lovsiz SMS paket sovg'a qilish.
  adminClientCenters: async (clientId) => {
    if (!Types.ObjectId.isValid(clientId)) throw new Error("sms.clientNotFound");
    const rows = await Center.find({ client: clientId, isDeleted: false }).select("name status").sort({ createdAt: 1 }).lean();
    return rows.map((c) => ({ _id: String(c._id), name: c.name, status: c.status }));
  },

  adminGrant: async ({ client, center, smsCount, validityDays, note } = {}, actor = null) => {
    if (!client || !Types.ObjectId.isValid(client)) throw new Error("sms.clientNotFound");
    const count = Number(smsCount);
    if (!Number.isInteger(count) || count < 1 || count > 1000000) throw new Error("sms.grantCountInvalid");
    const days = Number(validityDays ?? 0);
    if (!Number.isInteger(days) || days < 0 || days > 3650) throw new Error("sms.grantDaysInvalid");
    const cleanNote = isText(note) ? note.trim().slice(0, 200) : "";

    const owner = await Client.findOne({ _id: client }).select("name").lean();
    if (!owner) throw new Error("sms.clientNotFound");
    const ctr = await requireCenter(client, center);

    const now = getNow();
    const purchase = await SmsPurchase.create({
      client,
      center: ctr._id,
      packageName: GIFT_PACKAGE_NAME,
      smsCount: count,
      remaining: count,
      price: 0,
      validityDays: days,
      orderId: `gift-${now}-${Math.random().toString(36).slice(2, 10)}`,
      status: "paid",
      paidAt: now,
      expiresAt: days > 0 ? now + days * 86400 : null,
    });
    await SmsTransaction.create({
      client,
      center: ctr._id,
      type: "topup",
      amount: count,
      purchase: purchase._id,
      packageName: GIFT_PACKAGE_NAME,
      note: [ctr.name, cleanNote].filter(Boolean).join(" · "),
    });

    const balance = await smsBalance.getBalance(client, ctr._id);
    emit.toCenter(client, ctr._id, "sms:credited", {
      center: String(ctr._id),
      smsCount: count,
      expiresAt: purchase.expiresAt,
      packageName: GIFT_PACKAGE_NAME,
      balance,
    });
    void audit.log({
      actor,
      client,
      center: ctr._id,
      action: "sms:grant",
      entity: { type: "sms", id: purchase._id, label: owner.name },
      meta: { smsCount: count, validityDays: days, note: cleanNote },
    });
    emitAdminPurchase(purchase);
    return { ...purchaseDTO(purchase.toObject()), center: String(ctr._id), centerName: ctr.name, balance };
  },

};
