const adminService = require("../services/admin.service");

module.exports = {
  signIn: async (req, res, next) => {
    try {
      const { data, access, refresh } = await adminService.signIn(req.body);

      return res.send({
        ok: true,
        data,
        access,
        refresh,
        msg: "auth.success",
      });
    } catch (error) {
      next(error);
    }
  },
  refresh: async (req, res, next) => {
    try {
      const { refresh } = req.body;
      const { data, access, refresh: newRefresh } =
        await adminService.refresh(refresh);

      return res.send({
        ok: true,
        data,
        access,
        refresh: newRefresh,
        msg: "auth.success",
      });
    } catch (error) {
      next(error);
    }
  },
  verify: (req, res, next) => {
    try {
      const data = req.admin;
      return res.send({
        ok: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
  getApiKey: async (req, res, next) => {
    try {
      const apiKey = await adminService.getApiKey(req.admin._id);
      return res.send({ ok: true, data: { apiKey } });
    } catch (error) {
      next(error);
    }
  },

  regenerateApiKey: async (req, res, next) => {
    try {
      const apiKey = await adminService.regenerateApiKey(req.admin._id);
      return res.send({ ok: true, data: { apiKey }, msg: "auth.apiKeyRegenerated" });
    } catch (error) {
      next(error);
    }
  },

  updateProfile: async (req, res, next) => {
    try {
      const data = await adminService.updateProfile(req.admin._id, req.body);
      return res.send({ ok: true, data, msg: "admin.profileUpdated" });
    } catch (error) {
      next(error);
    }
  },

  signOut: async (req, res, next) => {
    try {
      const admin = req.admin;
      await adminService.signOut(admin);

      return res.send({
        ok: true,
        msg: "auth.signOut",
      });
    } catch (error) {
      next(error);
    }
  },
};
