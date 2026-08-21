const Center = require("../models/Center");
const Client = require("../models/Client");
const { getNow } = require("../utils/date.util");
const fileUtil = require("../utils/file.util");
const emit = require("../utils/emitter.util");
const audit = require("../utils/audit.util");
const { FOLDERS } = require("../configs/folder.config");

const PAGE_SIZE = 50;

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

module.exports = {
  DTO,
  assertActive,

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

    // Audit uchun o'zgarishdan OLDINGI holat (faqat kuzatiladigan maydonlar)
    const before = { name: center.name, slogan: center.slogan };

    if (body.name) center.name = body.name.trim();
    if (body.slogan) center.slogan = body.slogan.trim();

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
      changes: audit.diff(before, { name: center.name, slogan: center.slogan }),
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
