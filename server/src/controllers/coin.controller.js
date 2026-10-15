const coinService = require("../services/coin.service");
const { buildActor } = require("../utils/audit.util");

// WECOIN — xodim tomoni (API_CONTRACT_wecoin.md §3).
module.exports = {
  // GET /coins/:centerId/settings
  getSettings: async (req, res, next) => {
    try {
      const data = await coinService.getSettings(req.client._id, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // PUT /coins/:centerId/settings — body { enabled, rules }
  updateSettings: async (req, res, next) => {
    try {
      const data = await coinService.updateSettings(req.client._id, req.params.centerId, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "coin.settingsSaved" });
    } catch (error) {
      next(error);
    }
  },

  // GET /coins/active-centers — individual switch uchun.
  activeCenters: async (req, res, next) => {
    try {
      const data = await coinService.activeCenters(req.client._id, req.centerScope || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // GET /coins/student/:studentId — o'quvchi detali uchun balans.
  studentWallets: async (req, res, next) => {
    try {
      const data = await coinService.studentWallets(req.client._id, req.params.studentId, req.centerScope || null);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // GET /coins/:centerId/students?search=&page=
  students: async (req, res, next) => {
    try {
      const data = await coinService.students(req.client._id, req.params.centerId, {
        search: typeof req.query.search === "string" ? req.query.search : "",
        page: req.query.page,
      });
      return res.send({ ok: true, ...data });
    } catch (error) {
      next(error);
    }
  },
};
