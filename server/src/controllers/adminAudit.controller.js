const auditService = require("../services/audit.service");
const auditController = require("./audit.controller");
const { sendExcel, THEME } = require("../utils/excel.util");

// Platform Admin uchun CROSS-TENANT audit jurnali. Tenant zanjiridan
// (audit.controller.js) ataylab ajratilgan: bu yerda `clientId` filtri
// ixtiyoriy (bo'sh = barcha tenantlar) va javobda `client` maydoni ham
// qaytadi — tenant javobida esa bunday narsa bo'lmasligi kerak.
const OPTS = { withClient: true };

const adminParams = (query) => ({
  ...auditController.listParams(query),
  actorKind: query.actorKind,
});

module.exports = {
  list: async (req, res, next) => {
    try {
      const { clientId } = req.query;
      const { data, meta } = await auditService.list(clientId || null, adminParams(req.query), OPTS);
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  filters: async (req, res, next) => {
    try {
      const data = await auditService.filters(req.query.clientId || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { clientId } = req.query;
      const rows = await auditService.exportList(clientId || null, adminParams(req.query), OPTS);
      await sendExcel(res, "audit-jurnali", [
        {
          sheetName: "Audit jurnali",
          color: THEME.audit,
          title: "Audit jurnali (barcha mijozlar)",
          subtitle: `Jami: ${rows.length} ta yozuv`,
          columns: [
            { header: "Sana", width: 20, value: (r) => r.date },
            { header: "Mijoz", width: 22, value: (r) => r.client?.name || "—" },
            { header: "Kim", width: 22, value: (r) => r.actor.name || "—" },
            { header: "Tur", width: 12, value: (r) => r.actor.kind },
            { header: "Amal", width: 22, value: (r) => r.action },
            { header: "Obyekt turi", width: 16, value: (r) => r.entity.type },
            { header: "Obyekt", width: 26, value: (r) => r.entity.label || "—" },
            { header: "Filial", width: 20, value: (r) => r.center?.name || "—" },
            {
              header: "O'zgarishlar",
              width: 42,
              value: (r) => auditController.changesText(r.changes),
            },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },
};
