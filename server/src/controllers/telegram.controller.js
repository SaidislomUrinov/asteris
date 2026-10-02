const telegramService = require("../services/telegram.service");

// Har doim "o'zim" — Client Owner bo'lsa `client`, Staff bo'lsa `staff`
// (tenantAuth ikkalasini ham qo'yadi, staff.controller/teacher.controller
// bilan bir xil naqsh).
const selfOf = (req) => (req.staff ? { kind: "staff", id: req.staff._id } : { kind: "client", id: req.client._id });

module.exports = {
  link: async (req, res, next) => {
    try {
      const { kind, id } = selfOf(req);
      const data = await telegramService.startLink(kind, id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  botInfo: async (req, res, next) => {
    try {
      const data = await telegramService.botInfo();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  status: async (req, res, next) => {
    try {
      const { kind, id } = selfOf(req);
      const data = await telegramService.status(kind, id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  unlink: async (req, res, next) => {
    try {
      const { kind, id } = selfOf(req);
      await telegramService.unlink(kind, id);
      return res.send({ ok: true, msg: "telegram.unlinked" });
    } catch (error) {
      next(error);
    }
  },

  setLang: async (req, res, next) => {
    try {
      const { kind, id } = selfOf(req);
      const data = await telegramService.setLang(kind, id, req.body.lang);
      return res.send({ ok: true, data, msg: "telegram.langUpdated" });
    } catch (error) {
      next(error);
    }
  },
};
