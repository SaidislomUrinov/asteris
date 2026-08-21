const auditService = require("../services/audit.service");
const { sendExcel, THEME } = require("../utils/excel.util");

// `changes` massivini Excel katakchasi uchun bitta o'qiladigan matnga
// aylantiradi: "narx: 300000 → 350000".
const changesText = (changes = []) =>
  changes
    .map((c) => `${c.field}: ${c.from === null ? "—" : c.from} → ${c.to === null ? "—" : c.to}`)
    .join("\n") || "—";

const listParams = (query) => ({
  page: query.page,
  limit: query.limit,
  search: query.search,
  center: query.center,
  actorId: query.actorId,
  action: query.action,
  entityType: query.entityType,
  from: query.from,
  to: query.to,
});

module.exports = {
  changesText,
  listParams,

  list: async (req, res, next) => {
    try {
      const { data, meta } = await auditService.list(req.client._id, listParams(req.query));
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  filters: async (req, res, next) => {
    try {
      const data = await auditService.filters(req.client._id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const rows = await auditService.exportList(req.client._id, listParams(req.query));
      await sendExcel(res, "audit-jurnali", [
        {
          sheetName: "Audit jurnali",
          color: THEME.audit,
          title: "Audit jurnali",
          subtitle: `Jami: ${rows.length} ta yozuv`,
          columns: [
            { header: "Sana", width: 20, value: (r) => r.date },
            { header: "Kim", width: 22, value: (r) => r.actor.name || "—" },
            { header: "Rol", width: 14, value: (r) => r.actor.role || "—" },
            { header: "Amal", width: 22, value: (r) => r.action },
            { header: "Obyekt turi", width: 16, value: (r) => r.entity.type },
            { header: "Obyekt", width: 26, value: (r) => r.entity.label || "—" },
            { header: "Filial", width: 20, value: (r) => r.center?.name || "—" },
            { header: "O'zgarishlar", width: 42, value: (r) => changesText(r.changes) },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },
};
