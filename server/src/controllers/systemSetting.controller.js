const systemSettingService = require("../services/systemSetting.service");

module.exports = {
  get: async (req, res, next) => {
    try {
      const data = await systemSettingService.getSettings();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await systemSettingService.updateSettings(req.body, req.admin?._id);
      return res.send({ ok: true, data, msg: "settings.updated" });
    } catch (error) {
      next(error);
    }
  },

  testSmtp: async (req, res, next) => {
    try {
      await systemSettingService.testSmtp(req.body?.to);
      return res.send({ ok: true, msg: "settings.smtpTestSent" });
    } catch (error) {
      next(error);
    }
  },

  testTelegram: async (req, res, next) => {
    try {
      await systemSettingService.testTelegram();
      return res.send({ ok: true, msg: "settings.telegramTestSent" });
    } catch (error) {
      next(error);
    }
  },

  runBackup: async (req, res, next) => {
    try {
      const data = await systemSettingService.runBackup();
      return res.send({ ok: true, data, msg: "settings.backupDone" });
    } catch (error) {
      next(error);
    }
  },

  listBackups: async (req, res, next) => {
    try {
      const data = await systemSettingService.listBackups();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
