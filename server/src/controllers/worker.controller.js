// Ishchi Telegram WebApp paneli (API_CONTRACT_worker_webapp.md §3) — faqat
// o'qish. Owner ham, Staff ham `tenantAuth` orqali keladi: hodim uchun
// `req.staff` (DTO), owner uchun `req.staff` yo'q.
const workerService = require("../services/worker.service");

const ctxOf = (req) => ({ client: req.client, staff: req.staff || null });

module.exports = {
  me: async (req, res, next) => {
    try {
      const data = await workerService.me(ctxOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  today: async (req, res, next) => {
    try {
      // Hodim uchun `centerId` e'tiborsiz — servis o'z filialini oladi.
      const centerId = typeof req.query.centerId === "string" ? req.query.centerId : "";
      const data = await workerService.today(ctxOf(req), { centerId });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
