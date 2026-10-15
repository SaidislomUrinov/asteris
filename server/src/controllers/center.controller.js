const centerService = require("../services/center.service");
const clientService = require("../services/client.service");
const { buildActor } = require("../utils/audit.util");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await centerService.create(
        req.client._id,
        req.body,
        req.files?.logo,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "center.created" });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search, scope } = req.query;
      // API_CONTRACT_multi_center.md §3.4: `scope=all` — filial almashtirgich va
      // Filiallar sahifasi (Owner: barchasi, Staff: o'z filiallari). Aks holda
      // faol filial konteksti bo'lsa FAQAT shu filial — sahifalardagi filial
      // filtrlari o'zi yashirinadi, dialoglar faol filialni o'zi tanlaydi.
      let onlyCenter = null;
      if (scope === "all") onlyCenter = req.staff ? req.staff.centers : null;
      else if (req.staff) onlyCenter = req.staff.center;
      else if (req.centerScope) onlyCenter = req.centerScope;
      const { data, meta } = await centerService.list(req.client._id, { page, search, onlyCenter });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      if (req.staff && !(req.staff.centers || [String(req.staff.center)]).map(String).includes(req.params.id))
        throw new Error("auth.forbidden");
      const data = await centerService.getOne(req.client._id, req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await centerService.update(
        req.client._id,
        req.params.id,
        req.body,
        req.files?.logo,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "center.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await centerService.remove(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, msg: "center.deleted" });
    } catch (error) {
      next(error);
    }
  },

  // Tarif pasayganda majburiy modal uchun holat (API_CONTRACT.md §7.1.1).
  // Holat CLIENT domeniga tegishli (tarif limiti + markazlar), shuning
  // uchun client.service'dan o'qiladi.
  overflow: async (req, res, next) => {
    try {
      const data = await clientService.getCenterOverflow(req.client._id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  resolveOverflow: async (req, res, next) => {
    try {
      const data = await centerService.resolveOverflow(
        req.client._id,
        req.body?.keep,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "center.overflowResolved" });
    } catch (error) {
      next(error);
    }
  },

  unblock: async (req, res, next) => {
    try {
      const data = await centerService.unblock(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "center.unblocked" });
    } catch (error) {
      next(error);
    }
  },
};
