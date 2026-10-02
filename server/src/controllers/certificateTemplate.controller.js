const certificateTemplateService = require("../services/certificateTemplate.service");
const { buildActor } = require("../utils/audit.util");

module.exports = {
  create: async (req, res, next) => {
    try {
      // Staff faqat o'z filialiga shablon yaratadi — body'dan kelgan
      // centerId e'tiborga olinmaydi (requireCenterMatch shablonni
      // O'QISH/YANGILASH uchun, YARATISHda hali hujjat yo'q).
      const centerId = req.staff?.center || req.body.centerId;
      const data = await certificateTemplateService.create(
        req.client._id,
        centerId,
        req.body,
        req.files?.background,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "certificateTemplate.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const centerId = req.staff?.center || req.query.center;
      const { data, limit } = await certificateTemplateService.list(req.client._id, centerId);
      return res.send({ ok: true, data, limit });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await certificateTemplateService.getOne(req.client._id, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await certificateTemplateService.update(
        req.client._id,
        req.params.id,
        req.body,
        req.files?.background,
      );
      return res.send({ ok: true, data, msg: "certificateTemplate.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await certificateTemplateService.remove(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "certificateTemplate.deleted" });
    } catch (error) {
      next(error);
    }
  },
};
