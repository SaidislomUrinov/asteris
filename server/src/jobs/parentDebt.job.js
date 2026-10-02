// QARZ KASKADI — ota-onaga kunlik BITTA birlashtirilgan qarz eslatmasi
// (API_CONTRACT_parent.md §3).
//
// Har daqiqada tekshiradi: Asia/Tashkent bo'yicha hozir ≥ SEND_HOUR (10:00)
// bo'lsa va bugun hali yuborilmagan bo'lsa ishga tushadi. Tick qulfi Redis
// (`schedulerLock("parentDebt", YYYY-MM-DD)`) — cluster'da faqat bitta
// worker, kuniga bir marta. Ota-ona darajasida esa `Notification.dedupKey`
// (`parent:{id}:debt:{YYYY-MM-DD}`) ikkinchi xabarni yo'q qiladi.
//
// Markazning `quietHours` (masalan 21:00–08:00) faqat shu rejalashtirilgan
// xabar uchun: 10:00 quiet ichida bo'lsa (g'alati sozlama) o'sha markaz
// itemlari bu daqiqada o'tkazib yuboriladi — keyingi daqiqalarda job yana
// tekshiradi, quiet tugagach yuboradi. Shuning uchun kunlik qulf FAQAT
// kamida bitta ota-onaga xabar ketgandan (yoki hech kimga kerak bo'lmasa)
// keyin qo'yiladi, oldin emas.
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const Parent = require("../models/Parent");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Center = require("../models/Center");
const BillingSetting = require("../models/BillingSetting");
const parentNotification = require("../services/parentNotification.service");
const { todayString, dateStringToUnix } = require("../utils/date.util");
const moment = require("moment-timezone");

const TZ = "Asia/Tashkent";
const SEND_HOUR = Number(process.env.PARENT_DEBT_SEND_HOUR) || 10;
const TICK_MINUTES = 1;

// "HH:mm" → daqiqalar. Quiet oynasi yarim tunni kesib o'tishi mumkin (21:00→08:00).
const toMin = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const inQuietHours = (center, nowMin) => {
  const q = center?.parentNotifications?.quietHours;
  const from = toMin(q?.from);
  const to = toMin(q?.to);
  if (from === null || to === null || from === to) return false;
  return from < to ? nowMin >= from && nowMin < to : nowMin >= from || nowMin < to;
};

// Bugun kaskad kunimi: diffDays = today - dueDate (kun).
const isCascadeDay = (center, dueDateUnix, todayUnix) => {
  const cfg = center?.parentNotifications?.debt || {};
  const daysBefore = Number.isInteger(cfg.daysBefore) ? cfg.daysBefore : 3;
  const daysAfter = Array.isArray(cfg.daysAfter) ? cfg.daysAfter : [0, 3, 7, 14];
  const diffDays = Math.round((todayUnix - dueDateUnix) / 86400);
  return diffDays === -daysBefore || daysAfter.includes(diffDays);
};

// Qarz boshlangan sana: `nextDueDate` bo'lmasa eng eski qarz siklining oyi
// boshi (`debtBreakdown[0].month` → 1-kun).
const dueDateOf = (billing) => {
  if (billing?.nextDueDate) return billing.nextDueDate;
  const first = billing?.debtBreakdown?.[0];
  if (first?.month) return dateStringToUnix(`${first.month}-01`);
  return null;
};

// Bitta ota-ona uchun qarz itemlari (kaskad kuniga tushganlar).
const collectItems = async (parent, caches, todayUnix, nowMin, ignoreCascade = false) => {
  const { computeBilling } = require("../services/student.service");
  const parentService = require("../services/parent.service");
  // Qarz xabari faqat OTA-ONA roliga (API_CONTRACT_student_role_homework.md §5).
  if ((await parentService.effectiveRole(parent)) !== "parent") return [];
  const students = await parentService.findStudentsOf(parent, "parent");
  const items = [];
  for (const student of students) {
    for (const entry of student.groups || []) {
      if (entry.status !== "active") continue;
      const center = await caches.center(entry.center);
      if (!center) continue;
      if (!parentNotification.centerAllows(center, "debt")) continue;
      if (inQuietHours(center, nowMin)) continue; // keyingi daqiqada yana tekshiriladi
      const group = await caches.group(entry.group);
      if (!group) continue;
      const cycleMode = await caches.cycleMode(entry.center);
      const billing = computeBilling(entry, group, cycleMode);
      if (!(billing.debt > 0)) continue;
      const dueDate = dueDateOf(billing);
      if (!dueDate || (!ignoreCascade && !isCascadeDay(center, dueDate, todayUnix))) continue;
      const subjectName = await caches.subjectName(group.subject);
      items.push({
        studentId: student._id,
        studentName: student.fullName,
        entryId: entry._id,
        clientId: entry.client,
        centerId: center._id,
        centerName: center.name,
        center,
        groupLabel: group.name || subjectName || "",
        debt: billing.debt,
        months: (billing.debtBreakdown || []).map((r) => r.month).filter(Boolean),
        dueDate,
      });
    }
  }
  return items;
};

const makeCaches = () => {
  const centers = new Map();
  const groups = new Map();
  const subjects = new Map();
  const cycles = new Map();
  const memo = async (map, key, loader) => {
    const k = String(key);
    if (!map.has(k)) map.set(k, await loader());
    return map.get(k);
  };
  return {
    center: (id) => memo(centers, id, () => Center.findOne({ _id: id, isDeleted: false }).lean()),
    group: (id) =>
      memo(groups, id, () =>
        Group.findById(id).select("name subject status activatedAt finishedAt lessonOffset days center").lean(),
      ),
    subjectName: (id) => memo(subjects, id, async () => (await Subject.findById(id).select("name").lean())?.name || ""),
    cycleMode: (centerId) =>
      memo(cycles, centerId, async () => (await BillingSetting.findOne({ center: centerId }).select("cycleMode").lean())?.cycleMode || "anchor"),
  };
};

// `force` — qo'lda/sinov uchun: soat va kunlik qulfga qaramaydi (dedupKey
// baribir ishlaydi). Natija: { sent, parents }.
const run = async ({ force = false } = {}) => {
  const now = moment.tz(TZ);
  const date = todayString();
  if (!force) {
    if (now.hour() < SEND_HOUR) return { sent: 0, parents: 0, skipped: "beforeHour" };
    if (await redis.get(keyConfig.schedulerLock("parentDebt", date))) return { sent: 0, parents: 0, skipped: "done" };
  }
  // Bir daqiqalik ish qulfi — cluster'da parallel worker'lar bir vaqtda kirmasin.
  const tickKey = keyConfig.schedulerLock("parentDebt:tick", Math.floor(now.unix() / (TICK_MINUTES * 60)));
  if ((await redis.set(tickKey, "1", "EX", 120, "NX")) !== "OK") return { sent: 0, parents: 0, skipped: "tick" };

  const todayUnix = dateStringToUnix(date);
  const nowMin = now.hour() * 60 + now.minute();
  const caches = makeCaches();
  const parents = await Parent.find({ "telegram.blockedAt": null, "mute.debt": false });

  let sent = 0;
  let deferred = false;
  for (const parent of parents) {
    try {
      const items = await collectItems(parent, caches, todayUnix, nowMin);
      if (!items.length) continue;
      const created = await parentNotification.onDebtDigest({ parent, items, date });
      if (created) sent++;
    } catch (error) {
      console.error("parentDebt parent:", parent._id, error?.message || error);
    }
  }
  // Quiet-hours sabab kechiktirilgan markaz bo'lsa kunlik qulf qo'yilmaydi —
  // keyingi daqiqalarda qayta urinadi (dedupKey takrorni oldini oladi).
  if (!force) {
    const centers = await Center.find({ isDeleted: false, "parentNotifications.enabled": { $ne: false } })
      .select("parentNotifications")
      .lean();
    deferred = centers.some((c) => inQuietHours(c, nowMin));
    if (!deferred) {
      const ttl = Math.max(60, moment.tz(TZ).endOf("day").unix() - now.unix() + 60);
      await redis.set(keyConfig.schedulerLock("parentDebt", date), "1", "EX", ttl);
    }
  }
  return { sent, parents: parents.length, deferred };
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("parentDebt:", error.message));
  }, TICK_MINUTES * 60 * 1000);
  timer.unref?.();
  console.log(`Parent debt scheduler started (daily at ${String(SEND_HOUR).padStart(2, "0")}:00)`);
};

// Sinov/skript uchun: bitta ota-ona bo'yicha kaskadni hisoblab yuboradi
// (soat/qulfga qaramaydi; `ignoreCascade` — kaskad kuniga qaramay barcha
// qarzlarni oladi).
const runForParent = async (parent, { ignoreCascade = false } = {}) => {
  const now = moment.tz(TZ);
  const date = todayString();
  const items = await collectItems(parent, makeCaches(), dateStringToUnix(date), now.hour() * 60 + now.minute(), ignoreCascade);
  if (!items.length) return { items: [], created: null };
  const created = await parentNotification.onDebtDigest({ parent, items, date });
  return { items, created };
};

module.exports = { start, run, runForParent, isCascadeDay, inQuietHours, dueDateOf };
