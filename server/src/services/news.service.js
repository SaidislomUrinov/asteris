const path = require("path");
const { isValidObjectId } = require("mongoose");
const News = require("../models/News");
const NewsRead = require("../models/NewsRead");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const emit = require("../utils/emitter.util");
const fileUtil = require("../utils/file.util");
const auditUtil = require("../utils/audit.util");
const { getNow } = require("../utils/date.util");
const { getAdminIo } = require("../configs/socket.config");
const { FOLDERS } = require("../configs/folder.config");

// Yangiliklar moduli (API_CONTRACT_news.md). Admin (`/admin/news`) va Client
// (`/news`) tomonlari BITTA servisni ishlatadi — bir domen uchun bitta zanjir
// (CLAUDE.md "Modul ketma-ketligi").

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const UNREAD_POPUP_MAX = 20;

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VIDEO_EXTS = [".mp4", ".webm"];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const paginate = ({ page, limit }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
  return { pageNum, size, skip: (pageNum - 1) * size };
};

const metaOf = (pageNum, size, total) => ({
  page: pageNum,
  limit: size,
  total,
  totalPages: Math.ceil(total / size) || 1,
});

const mediaDTO = (m) => ({
  type: m.type,
  url: m.url,
  ...(m.type === "youtube" ? { youtubeId: m.youtubeId } : {}),
});

const resourceDTO = (r) => ({ label: r.label, url: r.url, kind: r.kind });

// Client'ga qaytadigan shakl (§3) — audience/createdBy/status YO'Q.
const clientDTO = (doc, readAt = null) => ({
  _id: doc._id,
  title: doc.title,
  description: doc.description || "",
  media: (doc.media || []).map(mediaDTO),
  resources: (doc.resources || []).map(resourceDTO),
  level: doc.level,
  publishedAt: doc.publishedAt,
  read: !!readAt,
  readAt: readAt || null,
});

const adminDTO = (doc, { readCount = 0, audienceCount = 0 } = {}) => ({
  _id: doc._id,
  title: doc.title,
  description: doc.description || "",
  media: (doc.media || []).map(mediaDTO),
  resources: (doc.resources || []).map(resourceDTO),
  level: doc.level,
  audience: doc.audience,
  status: doc.status,
  publishedAt: doc.publishedAt,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  readCount,
  audienceCount,
});

// ---- Socket ----

const emitAdmin = (event, payload) => {
  try {
    getAdminIo().emit(event, payload);
  } catch {
    // Admin socket hali ko'tarilmagan bo'lishi mumkin — ma'lumot baribir saqlangan.
  }
};

// O'qish hodisalari ko'p bo'lishi mumkin (popup ochilganda yuzlab foydalanuvchi
// bir vaqtda) — admin ro'yxati har biriga qayta yuklanmasligi uchun har
// yangilik bo'yicha 1 soniyada ko'pi bilan bitta `news:changed`.
const ADMIN_THROTTLE_MS = 1000;
const pendingAdminChanges = new Set();
const notifyAdminChanged = (newsId) => {
  const id = String(newsId);
  if (pendingAdminChanges.has(id)) return;
  pendingAdminChanges.add(id);
  setTimeout(() => {
    pendingAdminChanges.delete(id);
    emitAdmin("news:changed", { id });
  }, ADMIN_THROTTLE_MS).unref?.();
};

// Butun `/client` namespace'ga (to bo'sh → io.emit). Frontend audience +
// authType + createdAt bo'yicha o'zi filtrlaydi (§4).
const broadcast = (event, payload) => emit("", event, payload);

// ---- Visibility (§1) ----

// Reader = { id, kind: "client"|"staff" }. `createdAt` token/DTO'da yo'q
// (tenantAuth staff uchun req.client'ni { _id } ga almashtiradi), shuning
// uchun bazadan bitta yengil so'rov bilan olinadi.
const resolveReader = async ({ id, kind }) => {
  const Model = kind === "staff" ? Staff : Client;
  const doc = await Model.findById(id).select("createdAt").lean();
  return { id, kind, createdAt: doc?.createdAt || 0 };
};

const newsVisibilityFilter = (reader) => ({
  status: "published",
  isDeleted: false,
  audience: { $in: ["all", reader.kind === "staff" ? "staff" : "owners"] },
  publishedAt: { $gte: reader.createdAt || 0 },
});

const readNewsIds = (readerId) => NewsRead.distinct("news", { "reader.id": readerId });

const countUnread = async (reader) => {
  const readIds = await readNewsIds(reader.id);
  return News.countDocuments({ ...newsVisibilityFilter(reader), _id: { $nin: readIds } });
};

// ---- Admin statistikasi ----

const readCountsFor = async (ids) => {
  if (!ids.length) return new Map();
  const rows = await NewsRead.aggregate([
    { $match: { news: { $in: ids } } },
    { $group: { _id: "$news", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

// Taxminiy: bloklanmagan/o'chirilmagan Client + Staff, `createdAt <= publishedAt`
// (qoralama uchun — hozirgi holat).
const audienceCountFor = async (doc) => {
  const at = doc.publishedAt || getNow();
  const base = { isDeleted: false, blocked: false, createdAt: { $lte: at } };
  const [owners, staff] = await Promise.all([
    doc.audience === "staff" ? 0 : Client.countDocuments(base),
    doc.audience === "owners" ? 0 : Staff.countDocuments(base),
  ]);
  return owners + staff;
};

const withStats = async (docs) => {
  const counts = await readCountsFor(docs.map((d) => d._id));
  const audienceCounts = await Promise.all(docs.map(audienceCountFor));
  return docs.map((d, i) =>
    adminDTO(d, { readCount: counts.get(String(d._id)) || 0, audienceCount: audienceCounts[i] }),
  );
};

const findActive = async (id) => {
  if (!isValidObjectId(id)) throw new Error("news.notFound");
  const doc = await News.findOne({ _id: id, isDeleted: false });
  if (!doc) throw new Error("news.notFound");
  return doc;
};

const EDITABLE = ["title", "description", "media", "resources", "level", "audience"];

module.exports = {
  // Controller validatsiyasi uchun (controller Model'ni to'g'ridan-to'g'ri ko'rmaydi).
  LEVELS: News.LEVELS,
  AUDIENCES: News.AUDIENCES,
  MEDIA_TYPES: News.MEDIA_TYPES,
  RESOURCE_KINDS: News.RESOURCE_KINDS,

  newsVisibilityFilter,

  // ================= Admin =================

  adminList: async ({ page, limit, search, status } = {}) => {
    const { pageNum, size, skip } = paginate({ page, limit });
    const filter = { isDeleted: false };
    if (status && News.STATUSES.includes(status)) filter.status = status;
    if (search && String(search).trim()) {
      filter.title = { $regex: escapeRegex(String(search).trim()), $options: "i" };
    }

    const [docs, total] = await Promise.all([
      News.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(size).lean(),
      News.countDocuments(filter),
    ]);

    return { data: await withStats(docs), meta: metaOf(pageNum, size, total) };
  },

  adminGetOne: async (id) => {
    const doc = await findActive(id);
    const [data] = await withStats([doc]);
    return data;
  },

  // `payload` controller'da tekshirilgan va normallashtirilgan.
  create: async (payload, { publish = false } = {}, actor) => {
    const doc = await News.create({
      ...payload,
      createdBy: actor?.id || null,
      status: publish ? "published" : "draft",
      publishedAt: publish ? getNow() : null,
    });

    auditUtil.log({
      actor,
      action: publish ? "news:publish" : "news:create",
      entity: { type: "News", id: doc._id, label: doc.title },
      meta: { audience: doc.audience, level: doc.level },
    });

    if (publish) broadcast("news:new", { news: clientDTO(doc), audience: doc.audience });
    emitAdmin("news:changed", { id: String(doc._id) });

    const [data] = await withStats([doc]);
    return data;
  },

  update: async (id, payload, actor) => {
    const doc = await findActive(id);
    const before = doc.toObject();

    for (const key of EDITABLE) {
      if (payload[key] !== undefined) doc[key] = payload[key];
    }
    // Chop etilgan yangilikda publishedAt va o'qilganlik saqlanadi (§2).
    await doc.save();

    const changes = auditUtil.diff(before, doc.toObject(), EDITABLE);
    if (changes.length) {
      auditUtil.log({
        actor,
        action: "news:update",
        entity: { type: "News", id: doc._id, label: doc.title },
        changes,
      });
    }

    if (doc.status === "published") {
      broadcast("news:updated", { news: clientDTO(doc), audience: doc.audience });
    }
    emitAdmin("news:changed", { id: String(doc._id) });

    const [data] = await withStats([doc]);
    return data;
  },

  publish: async (id, actor) => {
    const doc = await findActive(id);

    // Idempotent: allaqachon yuborilgan bo'lsa qayta `news:new` chiqmaydi.
    if (doc.status !== "published") {
      doc.status = "published";
      doc.publishedAt = getNow();
      await doc.save();

      auditUtil.log({
        actor,
        action: "news:publish",
        entity: { type: "News", id: doc._id, label: doc.title },
        meta: { audience: doc.audience, level: doc.level },
      });

      broadcast("news:new", { news: clientDTO(doc), audience: doc.audience });
      emitAdmin("news:changed", { id: String(doc._id) });
    }

    const [data] = await withStats([doc]);
    return data;
  },

  // Soft delete — fayllar o'chirilmaydi (§2).
  remove: async (id, actor) => {
    const doc = await findActive(id);
    const wasPublished = doc.status === "published";

    doc.isDeleted = true;
    doc.deletedAt = getNow();
    await doc.save();

    auditUtil.log({
      actor,
      action: "news:delete",
      entity: { type: "News", id: doc._id, label: doc.title },
    });

    if (wasPublished) broadcast("news:removed", { id: String(doc._id) });
    emitAdmin("news:changed", { id: String(doc._id) });

    return { _id: doc._id };
  },

  uploadMedia: async (file) => {
    if (!file || Array.isArray(file)) throw new Error("news.invalidMedia");

    const ext = path.extname(file.name || "").toLowerCase();
    const type = IMAGE_EXTS.includes(ext) ? "image" : VIDEO_EXTS.includes(ext) ? "video" : null;
    if (!type) throw new Error("news.fileType");

    const max = type === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.truncated || file.size > max) throw new Error("news.fileTooLarge");

    const url = await fileUtil.save(file, FOLDERS.NEWS, "news");
    return { type, url };
  },

  // ================= Client (Owner + Staff) =================

  list: async (readerRef, { page, limit } = {}) => {
    const reader = await resolveReader(readerRef);
    const { pageNum, size, skip } = paginate({ page, limit });
    const filter = newsVisibilityFilter(reader);

    const [docs, total] = await Promise.all([
      News.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(size).lean(),
      News.countDocuments(filter),
    ]);

    const reads = await NewsRead.find({
      "reader.id": reader.id,
      news: { $in: docs.map((d) => d._id) },
    })
      .select("news readAt")
      .lean();
    const readMap = new Map(reads.map((r) => [String(r.news), r.readAt]));

    return {
      data: docs.map((d) => clientDTO(d, readMap.get(String(d._id)))),
      meta: metaOf(pageNum, size, total),
    };
  },

  // Popup navbati: "critical" avval, keyin eski → yangi (publishedAt o'sish).
  unread: async (readerRef) => {
    const reader = await resolveReader(readerRef);
    const readIds = await readNewsIds(reader.id);
    const base = { ...newsVisibilityFilter(reader), _id: { $nin: readIds } };

    const critical = await News.find({ ...base, level: "critical" })
      .sort({ publishedAt: 1 })
      .limit(UNREAD_POPUP_MAX)
      .lean();
    const rest =
      critical.length < UNREAD_POPUP_MAX
        ? await News.find({ ...base, level: { $ne: "critical" } })
            .sort({ publishedAt: 1 })
            .limit(UNREAD_POPUP_MAX - critical.length)
            .lean()
        : [];

    return [...critical, ...rest].map((d) => clientDTO(d));
  },

  unreadCount: async (readerRef) => {
    const reader = await resolveReader(readerRef);
    return countUnread(reader);
  },

  markRead: async (readerRef, id) => {
    const reader = await resolveReader(readerRef);
    if (!isValidObjectId(id)) throw new Error("news.notFound");

    const visible = await News.exists({ ...newsVisibilityFilter(reader), _id: id });
    if (!visible) throw new Error("news.notFound");

    const res = await NewsRead.updateOne(
      { news: id, "reader.id": reader.id },
      { $setOnInsert: { news: id, reader: { id: reader.id, kind: reader.kind }, readAt: getNow() } },
      { upsert: true },
    );

    const unread = await countUnread(reader);
    emit(`user:${reader.id}`, "news:read", { id: String(id), unread });
    if (res.upsertedCount) notifyAdminChanged(id);

    return { unread };
  },

  markAllRead: async (readerRef) => {
    const reader = await resolveReader(readerRef);
    const readIds = await readNewsIds(reader.id);
    const ids = await News.distinct("_id", {
      ...newsVisibilityFilter(reader),
      _id: { $nin: readIds },
    });

    if (ids.length) {
      const readAt = getNow();
      await NewsRead.bulkWrite(
        ids.map((newsId) => ({
          updateOne: {
            filter: { news: newsId, "reader.id": reader.id },
            update: {
              $setOnInsert: { news: newsId, reader: { id: reader.id, kind: reader.kind }, readAt },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      ids.forEach(notifyAdminChanged);
    }

    emit(`user:${reader.id}`, "news:read", { all: true, unread: 0 });
    return { unread: 0 };
  },
};
