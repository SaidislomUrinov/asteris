const expenseService = require("../services/expense.service");
const { buildActor } = require("../utils/audit.util");
const { sendExcel, THEME } = require("../utils/excel.util");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await expenseService.create(req.client._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "expense.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, center, month, category } = req.query;
      const { data, totalAmount, meta } = await expenseService.list(req.client._id, {
        page,
        search,
        center,
        month,
        category,
      });
      return res.send({ ok: true, data, totalAmount, meta });
    } catch (error) {
      next(error);
    }
  },

  byCategory: async (req, res, next) => {
    try {
      const { center, month } = req.query;
      const data = await expenseService.byCategory(req.client._id, { center, month });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center, month, category } = req.query;
      const rows = await expenseService.exportList(req.client._id, { search, center, month, category });
      const CATEGORY_LABELS = {
        rent: "Ijara",
        utilities: "Kommunal",
        equipment: "Jihoz",
        marketing: "Marketing",
        repair: "Ta'mirlash",
        other: "Boshqa",
      };
      await sendExcel(res, "xarajatlar", [
        {
          sheetName: "Xarajatlar",
          color: THEME.expense,
          title: "Xarajatlar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "Nomi", width: 26, value: (r) => r.title },
            { header: "Kategoriya", width: 16, value: (r) => CATEGORY_LABELS[r.category] || r.category },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Summa (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.amount },
            { header: "Sana", width: 18, value: (r) => r.date },
            {
              header: "Holat",
              width: 14,
              value: (r) => (r.status === "cancelled" ? "Bekor qilingan" : "Faol"),
            },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await expenseService.update(req.client._id, req.params.id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "expense.updated" });
    } catch (error) {
      next(error);
    }
  },

  cancel: async (req, res, next) => {
    try {
      const data = await expenseService.cancel(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "expense.cancelled" });
    } catch (error) {
      next(error);
    }
  },
};
