const statsService = require("../services/stats.service");

module.exports = {
  publicStats: async (req, res, next) => {
    try {
      const data = await statsService.publicStats();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
