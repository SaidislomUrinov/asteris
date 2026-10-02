const tariffService = require("../services/tariff.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await tariffService.create(req.body);
      return res.send({ ok: true, data, msg: "tariff.created" });
    } catch (error) {
      next(error);
    }
  },

  publicList: async (req, res, next) => {
    try {
      const data = await tariffService.publicList();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const data = await tariffService.list();
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await tariffService.getOne(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await tariffService.update(req.params.id, req.body);
      return res.send({ ok: true, data, msg: "tariff.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await tariffService.remove(req.params.id);
      return res.send({ ok: true, msg: "tariff.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
