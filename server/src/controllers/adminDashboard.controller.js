const adminDashboardService = require("../services/adminDashboard.service");

module.exports = {
  get: async (req, res, next) => {
    try {
      const data = await adminDashboardService.getDashboard();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
