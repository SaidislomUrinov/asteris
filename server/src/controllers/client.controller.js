const { isValidObjectId } = require("mongoose");
const clientService = require("../services/client.service");
const authService = require("../services/auth.service");
const tariffService = require("../services/tariff.service");
const subscriptionPaymentService = require("../services/subscriptionPayment.service");
const SubscriptionPayment = require("../models/SubscriptionPayment");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await clientService.create(req.body, req.files);
      return res.send({ ok: true, data, msg: "client.created" });
    } catch (error) {
      next(error);
    }
  },

  suggestSlug: async (req, res, next) => {
    try {
      const except = isValidObjectId(req.query.except) ? req.query.except : null;
      const data = await clientService.suggestSlug(String(req.query.name || ""), except);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  brand: async (req, res, next) => {
    try {
      const data = await clientService.brand(req.params.slug);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, search } = req.query;
      const { data, meta } = await clientService.list({ page, search });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const data = await clientService.getOne(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await clientService.update(req.params.id, req.body, req.files);
      return res.send({ ok: true, data, msg: "client.updated" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await clientService.remove(req.params.id);
      return res.send({ ok: true, msg: "client.deleted" });
    } catch (error) {
      next(error);
    }
  },

  block: async (req, res, next) => {
    try {
      const data = await clientService.setBlocked(req.params.id, true);
      return res.send({ ok: true, data, msg: "client.blockedSuccess" });
    } catch (error) {
      next(error);
    }
  },

  unblock: async (req, res, next) => {
    try {
      const data = await clientService.setBlocked(req.params.id, false);
      return res.send({ ok: true, data, msg: "client.unblocked" });
    } catch (error) {
      next(error);
    }
  },

  subscribe: async (req, res, next) => {
    try {
      const data = await clientService.subscribe(req.params.id, req.body, req.admin);
      return res.send({ ok: true, data, msg: "client.subscribed" });
    } catch (error) {
      next(error);
    }
  },

  unsubscribe: async (req, res, next) => {
    try {
      const data = await clientService.unsubscribe(req.params.id);
      return res.send({ ok: true, data, msg: "client.unsubscribed" });
    } catch (error) {
      next(error);
    }
  },

  changeTariff: async (req, res, next) => {
    try {
      const data = await clientService.changeTariff(req.params.id, req.body, req.admin);
      return res.send({ ok: true, data, msg: "client.tariffChanged" });
    } catch (error) {
      next(error);
    }
  },

  signIn: async (req, res, next) => {
    try {
      const { data, access } = await authService.ownerSession(req.body, req.headers["x-center-id"]);
      return res.send({ ok: true, data, access, msg: "auth.success" });
    } catch (error) {
      next(error);
    }
  },

  verify: async (req, res, next) => {
    try {
      const context = await clientService.sessionContext(req.client._id, { wanted: req.headers["x-center-id"] });
      return res.send({ ok: true, data: { ...req.client, ...context } });
    } catch (error) {
      next(error);
    }
  },

  updateOwnProfile: async (req, res, next) => {
    try {
      const data = await clientService.updateOwnProfile(req.client._id, req.body);
      return res.send({ ok: true, data, msg: "client.profileUpdated" });
    } catch (error) {
      next(error);
    }
  },

  markIntroSeen: async (req, res, next) => {
    try {
      await clientService.markIntroSeen(req.client._id);
      return res.send({ ok: true, msg: "auth.introSeen" });
    } catch (error) {
      next(error);
    }
  },

  signOutSession: async (req, res, next) => {
    try {
      await clientService.signOutSession(req.client, req.authChannel);
      return res.send({ ok: true, msg: "auth.signOut" });
    } catch (error) {
      next(error);
    }
  },

  listTariffs: async (req, res, next) => {
    try {
      const [data, activeCenterCount] = await Promise.all([
        tariffService.list(),
        clientService.getActiveCenterCount(req.client._id),
      ]);
      return res.send({ ok: true, data, activeCenterCount });
    } catch (error) {
      next(error);
    }
  },

  initiateSubscription: async (req, res, next) => {
    try {
      const result = await subscriptionPaymentService.initiate(
        req.client._id,
        req.body.tariffId,
        req.body.months,
      );
      return res.send({ ok: true, ...result });
    } catch (error) {
      console.error("[subscriptionPayment] initiateSubscription xato", error.message);
      next(error);
    }
  },

  subscriptionStatus: async (req, res, next) => {
    try {
      const txn = await SubscriptionPayment.findOne({ orderId: req.params.orderId, client: req.client._id });
      if (!txn) throw new Error("subscription.transactionNotFound");
      const result = await subscriptionPaymentService.verifyAndActivate(req.params.orderId);
      return res.send({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  },
};
