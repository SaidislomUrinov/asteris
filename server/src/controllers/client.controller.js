const clientService = require("../services/client.service");
const tariffService = require("../services/tariff.service");
const subscriptionPaymentService = require("../services/subscriptionPayment.service");
const SubscriptionPayment = require("../models/SubscriptionPayment");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await clientService.create(req.body);
      return res.send({ ok: true, data, msg: "client.created" });
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
      const data = await clientService.update(req.params.id, req.body);
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
      const { data, access, refresh } = await clientService.signIn(req.body);
      return res.send({ ok: true, data, access, refresh, msg: "auth.success" });
    } catch (error) {
      next(error);
    }
  },

  refreshToken: async (req, res, next) => {
    try {
      const { refresh } = req.body;
      const { data, access, refresh: newRefresh } = await clientService.refreshToken(refresh);
      return res.send({ ok: true, data, access, refresh: newRefresh, msg: "auth.success" });
    } catch (error) {
      next(error);
    }
  },

  verify: (req, res, next) => {
    try {
      return res.send({ ok: true, data: req.client });
    } catch (error) {
      next(error);
    }
  },

  signOutSession: async (req, res, next) => {
    try {
      await clientService.signOutSession(req.client);
      return res.send({ ok: true, msg: "auth.signOut" });
    } catch (error) {
      next(error);
    }
  },

  listTariffs: async (req, res, next) => {
    try {
      const data = await tariffService.list();
      return res.send({ ok: true, data });
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
