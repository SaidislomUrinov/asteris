const billingSettingService = require("../services/billingSetting.service");

module.exports = {
  getSettings: async (req, res, next) => {
    try {
      const data = await billingSettingService.getSettings(req.client._id, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  updateSettings: async (req, res, next) => {
    try {
      const data = await billingSettingService.updateSettings(req.client._id, req.params.centerId, req.body);
      return res.send({ ok: true, data, msg: "billing.settingsUpdated" });
    } catch (error) {
      next(error);
    }
  },
};
