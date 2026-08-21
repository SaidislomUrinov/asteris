const dashboardService = require("../services/dashboard.service");

module.exports = {
  stats: async (req, res, next) => {
    try {
      const { center, month } = req.query;
      const data = await dashboardService.stats(req.client._id, { center, month });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  todayLessons: async (req, res, next) => {
    try {
      const { center } = req.query;
      const data = await dashboardService.todayLessons(req.client._id, { center });
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
