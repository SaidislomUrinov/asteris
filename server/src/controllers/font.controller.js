const fontService = require("../services/font.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await fontService.create(req.body, req.files?.font);
      return res.send({ ok: true, data, msg: "font.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const data = await fontService.list();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await fontService.remove(req.params.id);
      return res.send({ ok: true, data, msg: "font.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
