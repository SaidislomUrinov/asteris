const AuditLog = require("../models/AuditLog");
const { formatDate, dateStringToUnix } = require("../utils/date.util");

const PAGE_SIZE = 20;

// Jurnal FAQAT o'qish uchun — yozish `utils/audit.util.js` orqali ketadi
// (servislarning ichidan). Shuning uchun bu yerda create/update/delete yo'q.
const DTO = (data, { withClient = false } = {}) => {
  const base = {
    _id: data?._id,
    action: data?.action,
    createdAt: data?.createdAt,
    date: data?.createdAt ? formatDate(data.createdAt) : "",
    actor: {
      id: data?.actor?.id,
      kind: data?.actor?.kind,
      name: data?.actor?.name || "",
      role: data?.actor?.role || "",
    },
    entity: {
      type: data?.entity?.type,
      id: data?.entity?.id || null,
      label: data?.entity?.label || "",
    },
    changes: (data?.changes || []).map((c) => ({ field: c.field, from: c.from, to: c.to })),
    meta: data?.meta || {},
    center: data?.center?._id ? { _id: data.center._id, name: data.center.name } : null,
  };

  // `client` faqat Admin javobida — tenant o'z jurnalida o'zining nomini
  // takroran ko'rishi ortiqcha.
  if (withClient) {
    base.client = data?.client?._id ? { _id: data.client._id, name: data.client.name } : null;
  }

  return base;
};

// Umumiy filtr quruvchi. `clientId` null bo'lsa — cross-tenant (Admin).
// Tenant chaqiruvida `clientId` HAR DOIM beriladi (izolyatsiya sharti).
const buildFilter = (clientId, { search = "", center = "", actorId = "", actorKind = "", action = "", entityType = "", from = "", to = "" }) => {
  const filter = {};

  if (clientId) filter.client = clientId;
  if (center) filter.center = center;
  if (actorId) filter["actor.id"] = actorId;
  if (actorKind) filter["actor.kind"] = actorKind;
  if (action) filter.action = action;
  if (entityType) filter["entity.type"] = entityType;

  if (from || to) {
    filter.createdAt = {};
    // Sana matni ("YYYY-MM-DD") Asia/Tashkent bo'yicha kun boshiga
    // aylantiriladi; `to` — o'sha kunning OXIRIgacha kirsin uchun +1 kun.
    if (from) filter.createdAt.$gte = dateStringToUnix(from);
    if (to) filter.createdAt.$lt = dateStringToUnix(to) + 24 * 60 * 60;
  }

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ "actor.name": regex }, { "entity.label": regex }, { action: regex }];
  }

  return filter;
};

const populate = (query) =>
  query.populate({ path: "center", select: "name" }).populate({ path: "client", select: "name" });

module.exports = {
  DTO,

  list: async (clientId, params = {}, { withClient = false } = {}) => {
    const filter = buildFilter(clientId, params);

    const pageNum = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || PAGE_SIZE));
    const skip = (pageNum - 1) * limit;

    const [data, total] = await Promise.all([
      populate(AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => DTO(d, { withClient })),
      meta: {
        page: pageNum,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  // Filtr tanlagichlari uchun mavjud qiymatlar — frontend "amal turi" va
  // "xodim" ro'yxatlarini qattiq kodlab yozmasligi uchun (yangi action
  // qo'shilsa filtrda o'zi paydo bo'ladi).
  filters: async (clientId) => {
    const filter = clientId ? { client: clientId } : {};

    const [actorRows, actions, entityTypes] = await Promise.all([
      AuditLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$actor.id",
            name: { $last: "$actor.name" },
            role: { $last: "$actor.role" },
            kind: { $last: "$actor.kind" },
          },
        },
        { $sort: { name: 1 } },
        { $limit: 200 },
      ]),
      AuditLog.distinct("action", filter),
      AuditLog.distinct("entity.type", filter),
    ]);

    return {
      actors: actorRows.map((a) => ({
        _id: a._id,
        name: a.name || "",
        role: a.role || "",
        kind: a.kind || "",
      })),
      actions: actions.sort(),
      entityTypes: entityTypes.sort(),
    };
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz.
  exportList: async (clientId, params = {}, { withClient = false } = {}) => {
    const filter = buildFilter(clientId, params);
    const rows = await populate(AuditLog.find(filter).sort({ createdAt: -1 }).limit(5000));
    return rows.map((d) => DTO(d, { withClient }));
  },
};
