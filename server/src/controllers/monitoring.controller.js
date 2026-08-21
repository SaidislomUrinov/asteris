const monitoringService = require("../services/monitoring.service");

module.exports = {
  snapshot: async (req, res, next) => {
    try {
      const data = await monitoringService.getSnapshot();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  history: async (req, res, next) => {
    try {
      // Express 5: `req.query` — getter, unga yozilmaydi, faqat o'qiladi.
      const data = await monitoringService.getHistory({ hours: req.query.hours });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
