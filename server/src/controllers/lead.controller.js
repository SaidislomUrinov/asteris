const leadService = require("../services/lead.service");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await leadService.create(req.body);
      return res.send({ ok: true, data, msg: "lead.created" });
    } catch (error) {
      next(error);
    }
  },

  // Website "Bepul boshlash" modali — oddiy spam-botlar uchun honeypot:
  // ko'rinmas `company` maydoni to'ldirilgan bo'lsa jimgina "muvaffaqiyat"
  // qaytariladi, lead esa yaratilmaydi (bot signalini olmaydi).
  createPublic: async (req, res, next) => {
    try {
      // Honeypot: `_gotcha` (yangi) yoki `company` (eski sayt build'i).
      // "company" nomini brauzer autofill'i haqiqiy odamda to'ldirib
      // qo'yishi mumkin edi — shuning uchun sayt endi `_gotcha` yuboradi.
      if (req.body._gotcha || req.body.company) {
        return res.send({ ok: true, data: null, msg: "lead.created" });
      }
      const data = await leadService.createPublic(req.body);
      return res.send({ ok: true, data, msg: "lead.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, status } = req.query;
      const { data, meta } = await leadService.list({ page, search, status });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await leadService.getOne(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const data = await leadService.updateStatus(
        req.params.id,
        req.body,
        req.admin,
      );
      return res.send({ ok: true, data, msg: "lead.statusUpdated" });
    } catch (error) {
      next(error);
    }
  },

  createClient: async (req, res, next) => {
    try {
      const data = await leadService.createClient(
        req.params.id,
        req.body,
        req.admin,
      );
      return res.send({ ok: true, data, msg: "lead.clientCreated" });
    } catch (error) {
      next(error);
    }
  },
};
