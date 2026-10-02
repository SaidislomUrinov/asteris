const Center = require("../models/Center");
const Client = require("../models/Client");
const { getNow } = require("../utils/date.util");
const fileUtil = require("../utils/file.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { FOLDERS } = require("../configs/folder.config");

const PAGE_SIZE = 50;

// Ota-ona xabarlari sozlamasi — DTO'da doim TO'LIQ shaklda (eski
// hujjatlarda sub-hujjat bo'lmasa schema default'lari bilan).
const PN_DEFAULT = {
  enabled: true,
  attendance: { enabled: true },
  lessonFinished: { enabled: true, includeGrade: true },
  payment: { enabled: true },
  badge: { enabled: true },
  debt: { enabled: true, daysBefore: 3, daysAfter: [0, 3, 7, 14] },
  showGrades: true,
  quietHours: { from: "21:00", to: "08:00" },
};

const parentNotificationsDTO = (pn) => {
  const p = pn?.toObject ? pn.toObject() : pn || {};
  return {
    enabled: p.enabled ?? PN_DEFAULT.enabled,
    attendance: { enabled: p.attendance?.enabled ?? true },
    lessonFinished: {
      enabled: p.lessonFinished?.enabled ?? true,
      includeGrade: p.lessonFinished?.includeGrade ?? true,
    },
    payment: { enabled: p.payment?.enabled ?? true },
    badge: { enabled: p.badge?.enabled ?? true },
    debt: {
      enabled: p.debt?.enabled ?? true,
      daysBefore: p.debt?.daysBefore ?? PN_DEFAULT.debt.daysBefore,
      daysAfter: Array.isArray(p.debt?.daysAfter) ? p.debt.daysAfter : PN_DEFAULT.debt.daysAfter,
    },
    showGrades: p.showGrades ?? true,
    quietHours: {
      from: p.quietHours?.from || PN_DEFAULT.quietHours.from,
      to: p.quietHours?.to || PN_DEFAULT.quietHours.to,
    },
  };
};

// PATCH body'dagi QISMAN `parentNotifications` obyektini tekshiradi va
// mavjud sozlama ustiga qo'llaydi (API_CONTRACT_parent.md §2). server/ da
// zod ulanmagan (calendar.controller.js izohiga qara) — qo'lda tekshiruv,
// xato kaliti bilan `throw`.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pickBool = (v, fallback) => {
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") throw new Error("center.parentNotifInvalid");
  return v;
};
const applyParentNotifications = (current, patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("center.parentNotifInvalid");
  const next = parentNotificationsDTO(current);

  next.enabled = pickBool(patch.enabled, next.enabled);
  next.showGrades = pickBool(patch.showGrades, next.showGrades);
  if (patch.attendance !== undefined)
    next.attendance.enabled = pickBool(patch.attendance?.enabled, next.attendance.enabled);
  if (patch.payment !== undefined) next.payment.enabled = pickBool(patch.payment?.enabled, next.payment.enabled);
  if (patch.badge !== undefined) next.badge.enabled = pickBool(patch.badge?.enabled, next.badge.enabled);
  if (patch.lessonFinished !== undefined) {
    next.lessonFinished.enabled = pickBool(patch.lessonFinished?.enabled, next.lessonFinished.enabled);
    next.lessonFinished.includeGrade = pickBool(patch.lessonFinished?.includeGrade, next.lessonFinished.includeGrade);
  }
  if (patch.debt !== undefined) {
    const d = patch.debt || {};
    next.debt.enabled = pickBool(d.enabled, next.debt.enabled);
    if (d.daysBefore !== undefined) {
      const n = Number(d.daysBefore);
      if (!Number.isInteger(n) || n < 0 || n > 14) throw new Error("center.parentNotifInvalid");
      next.debt.daysBefore = n;
    }
    if (d.daysAfter !== undefined) {
      if (!Array.isArray(d.daysAfter) || d.daysAfter.length > 20) throw new Error("center.parentNotifInvalid");
      const list = d.daysAfter.map(Number);
      if (list.some((n) => !Number.isInteger(n) || n < 0 || n > 60)) throw new Error("center.parentNotifInvalid");
      next.debt.daysAfter = [...new Set(list)].sort((a, b) => a - b);
    }
  }
  if (patch.quietHours !== undefined) {
    const q = patch.quietHours || {};
    for (const k of ["from", "to"]) {
      if (q[k] === undefined) continue;
      if (typeof q[k] !== "string" || !HHMM_RE.test(q[k])) throw new Error("center.parentNotifInvalid");
      next.quietHours[k] = q[k];
    }
  }
  return next;
};

const DTO = (data) => ({
  _id: data?._id,
  client: data?.client,
  name: data?.name,
  slogan: data?.slogan,
  logo: data?.logo,
  // Tarif pasayganda markaz o'chirilmaydi, `blocked` bo'ladi — frontend
  // kartochkani kulrang qilib "Faollashtirish" tugmasini ko'rsatishi uchun
  // status DTO'ga chiqariladi (API_CONTRACT.md §7.2).
  status: data?.status,
  parentNotifications: parentNotificationsDTO(data?.parentNotifications),
  date: data?.date,
  lastUpdate: data?.lastUpdate,
});

// Client'ning faol obunasidan (Tariff jonli hujjatidan yoki snapshot'dan) centerLimit'ni
// aniqlaydi — xuddi client.service.js'dagi liveTariffSnapshot mantig'i kabi.
const getCenterLimit = async (clientId) => {
  const client = await Client.findOne({ _id: clientId, isDeleted: false }).populate({
    path: "subscription",
    populate: { path: "tariff" },
  });
  if (!client || !client.subscription) throw new Error("client.noActiveSubscription");

  const sub = client.subscription;
  const tariffDoc = sub.tariff?._id ? sub.tariff : null;
  const centerLimit = tariffDoc ? tariffDoc.centerLimit : sub.tariffSnapshot?.centerLimit;

  return centerLimit;
};

/**
 * Bloklangan markazda YANGI ma'lumot yaratib bo'lmaydi (API_CONTRACT.md
 * §7.1.2 "Yon ta'sirlar"). Boshqa servislar (guruh, o'quvchi, xona...)
 * shu funksiyani chaqiradi — tekshiruv bir joyda turadi.
 */
const assertActive = async (clientId, centerId) => {
  if (!centerId) return;
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false }).select(
    "status",
  );
  if (!center) throw new Error("center.notFound");
  if (center.status === "blocked") throw new Error("center.blocked");
};

/**
 * Tarif o'zgargandan keyin (admin change-tariff, subscribe, inPAY to'lov)
 * chaqiriladi: limit ruxsat bergan miqdorda bloklangan markazlar AVTOMATIK
 * qayta faollashtiriladi (eng eskisi birinchi). Limit hali ham kam bo'lsa
 * hech narsa qilinmaydi — ortiqcha holatni `getCenterOverflow` + majburiy
 * modal hal qiladi. Xato tashlamaydi: tarif o'zgarishi shu sabab to'xtamasin.
 */
const reconcileAfterTariffChange = async (clientId, actor = null) => {
  try {
    const limit = await getCenterLimit(clientId);
    const centers = await Center.find({ client: clientId, isDeleted: false }).sort({ createdAt: 1 });
    const activeCount = centers.filter((c) => c.status === "active").length;
    const blocked = centers.filter((c) => c.status === "blocked");
    if (!blocked.length) return { activated: [] };

    const room = limit === -1 ? blocked.length : Math.max(0, limit - activeCount);
    const toActivate = blocked.slice(0, room);
    if (!toActivate.length) return { activated: [] };

    await Center.updateMany(
      { _id: { $in: toActivate.map((c) => c._id) } },
      { $set: { status: "active" } },
    );
    for (const center of toActivate) {
      audit.log({
        actor,
        client: clientId,
        center: center._id,
        action: "center:unblocked",
        entity: { type: "Center", id: center._id, label: center.name },
      });
    }
    const activated = toActivate.map((c) => c._id);
    emit(`client:${clientId}`, "center:statusChanged", { blocked: [], active: activated });
    return { activated };
  } catch {
    return { activated: [] };
  }
};

module.exports = {
  DTO,
  assertActive,
  reconcileAfterTariffChange,

  create: async (clientId, body, file, actor = null) => {
    const { name, slogan } = body;
    if (!name) throw new Error("center.fillTheRows");

    const limit = await getCenterLimit(clientId);
    if (limit !== -1) {
      const count = await Center.countDocuments({ client: clientId, isDeleted: false });
      if (count >= limit) throw new Error("center.limitReached");
    }

    const logo = file ? await fileUtil.save(file, FOLDERS.LOGOS, name) : "";

    const center = await Center.create({
      client: clientId,
      name: name.trim(),
      slogan: slogan ? slogan.trim() : "",
      logo,
    });

    audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "center:create",
      entity: { type: "Center", id: center._id, label: center.name },
    });

    return DTO(center);
  },

  list: async (clientId, { page = 1, search = "", onlyCenter = null }) => {
    const trimmedSearch = search?.trim();
    const baseFilter = { client: clientId, isDeleted: false };
    if (onlyCenter) baseFilter._id = onlyCenter; // staff faqat o'z markazi

    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const data = await Center.find({
        ...baseFilter,
        $or: [{ name: regex }, { slogan: regex }],
      }).sort({ createdAt: -1 });

      return {
        data: data.map(DTO),
        meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      Center.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Center.countDocuments(baseFilter),
    ]);

    return {
      data: data.map(DTO),
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  getOne: async (clientId, id) => {
    const center = await Center.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");
    return DTO(center);
  },

  update: async (clientId, id, body, file, actor = null) => {
    const center = await Center.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");
    // Bloklangan filial Read-Only (tarif pasayganda) — faqat "Faollashtirish".
    if (center.status === "blocked") throw new Error("center.blocked");

    // Audit uchun o'zgarishdan OLDINGI holat (faqat kuzatiladigan maydonlar)
    const before = {
      name: center.name,
      slogan: center.slogan,
      parentNotifications: JSON.stringify(parentNotificationsDTO(center.parentNotifications)),
    };

    if (body.name) center.name = body.name.trim();
    if (body.slogan) center.slogan = body.slogan.trim();
    // Ota-ona xabarlari sozlamasi — qisman patch (API_CONTRACT_parent.md §2).
    // multipart (logo bilan) kelsa satr bo'lishi mumkin — JSON sifatida o'qiladi.
    if (body.parentNotifications !== undefined) {
      let patch = body.parentNotifications;
      if (typeof patch === "string") {
        try {
          patch = JSON.parse(patch);
        } catch {
          throw new Error("center.parentNotifInvalid");
        }
      }
      center.parentNotifications = applyParentNotifications(center.parentNotifications, patch);
    }

    if (file) {
      if (center.logo) await fileUtil.remove(center.logo);
      center.logo = await fileUtil.save(file, FOLDERS.LOGOS, body.name || center.name);
    }

    await center.save();

    audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "center:update",
      entity: { type: "Center", id: center._id, label: center.name },
      changes: audit.diff(before, {
        name: center.name,
        slogan: center.slogan,
        parentNotifications: JSON.stringify(parentNotificationsDTO(center.parentNotifications)),
      }),
    });

    return DTO(center);
  },

  remove: async (clientId, id, actor = null) => {
    const center = await Center.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    center.isDeleted = true;
    center.deletedAt = getNow();
    await center.save();

    audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "center:delete",
      entity: { type: "Center", id: center._id, label: center.name },
    });

    return true;
  },

  /**
   * Tarif pasayganda "qaysi filiallar qolsin" tanlovini qo'llaydi
   * (API_CONTRACT.md §7.1.2): `keep` dagilar `active`, qolganlari `blocked`.
   * Markaz HECH QACHON o'chirilmaydi — tarif ko'tarilsa qayta ochiladi.
   */
  resolveOverflow: async (clientId, keep = [], actor = null) => {
    const limit = await getCenterLimit(clientId);
    // Cheksiz tarifda umuman tanlov kerak emas
    if (limit === -1) throw new Error("center.noOverflow");

    const keepIds = [...new Set((Array.isArray(keep) ? keep : []).map(String))];

    // `keep.length` AYNAN limitga teng bo'lishi shart — kam bo'lsa ham xato:
    // foydalanuvchi o'zini keraksiz cheklab qo'ymasligi kerak.
    if (keepIds.length !== limit) throw new Error("center.keepCountMismatch");

    const centers = await Center.find({ client: clientId, isDeleted: false });
    if (centers.length <= limit) throw new Error("center.noOverflow");

    const validIds = new Set(centers.map((c) => String(c._id)));
    for (const id of keepIds) {
      if (!validIds.has(id)) throw new Error("center.notFound");
    }

    const blocked = [];
    const active = [];

    for (const center of centers) {
      const shouldKeep = keepIds.includes(String(center._id));
      const nextStatus = shouldKeep ? "active" : "blocked";
      if (center.status === nextStatus) {
        (shouldKeep ? active : blocked).push(center._id);
        continue;
      }

      center.status = nextStatus;
      await center.save();
      (shouldKeep ? active : blocked).push(center._id);

      audit.log({
        actor,
        client: clientId,
        center: center._id,
        action: shouldKeep ? "center:unblocked" : "center:blocked",
        entity: { type: "Center", id: center._id, label: center.name },
      });
    }

    audit.log({
      actor,
      client: clientId,
      action: "subscription:downgrade",
      entity: { type: "Subscription", id: null, label: `${limit} ta filial` },
      changes: [{ field: "activeCenters", from: centers.length, to: limit }],
    });

    emit(`client:${clientId}`, "center:statusChanged", { blocked, active });

    return { blocked, active, limit };
  },

  // Limit ruxsat bersa bloklangan markazni qayta ochadi (tarif ko'tarilgach
  // avtomatik ham ishlaydi — subscriptionPayment.service.js).
  unblock: async (clientId, id, actor = null) => {
    const center = await Center.findOne({ _id: id, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");
    if (center.status === "active") return DTO(center);

    const limit = await getCenterLimit(clientId);
    if (limit !== -1) {
      const activeCount = await Center.countDocuments({
        client: clientId,
        isDeleted: false,
        status: "active",
      });
      if (activeCount >= limit) throw new Error("center.limitReached");
    }

    center.status = "active";
    await center.save();

    audit.log({
      actor,
      client: clientId,
      center: center._id,
      action: "center:unblocked",
      entity: { type: "Center", id: center._id, label: center.name },
    });

    emit(`client:${clientId}`, "center:statusChanged", { blocked: [], active: [center._id] });

    return DTO(center);
  },
};
