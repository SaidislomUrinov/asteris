const shopService = require("../services/shop.service");
const { buildActor } = require("../utils/audit.util");

// Filial do'koni — xodim tomoni (API_CONTRACT_wecoin.md §3).
const photoOf = (req) => {
  const file = req.files?.photo;
  return Array.isArray(file) ? file[0] : file || null;
};

module.exports = {
  // GET /shop/:centerId/products
  listProducts: async (req, res, next) => {
    try {
      const data = await shopService.listProducts(req.client._id, req.params.centerId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // POST /shop/:centerId/products (multipart)
  createProduct: async (req, res, next) => {
    try {
      const data = await shopService.createProduct(
        req.client._id,
        req.params.centerId,
        req.body,
        photoOf(req),
        buildActor(req),
      );
      return res.status(201).send({ ok: true, data, msg: "shop.productCreated" });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /shop/:centerId/products/:id (multipart)
  updateProduct: async (req, res, next) => {
    try {
      const data = await shopService.updateProduct(
        req.client._id,
        req.params.centerId,
        req.params.id,
        req.body,
        photoOf(req),
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "shop.productUpdated" });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /shop/:centerId/products/:id
  removeProduct: async (req, res, next) => {
    try {
      const data = await shopService.removeProduct(req.client._id, req.params.centerId, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "shop.productDeleted" });
    } catch (error) {
      next(error);
    }
  },

  // GET /shop/:centerId/orders?status=&page=
  listOrders: async (req, res, next) => {
    try {
      const data = await shopService.listOrders(req.client._id, req.params.centerId, {
        status: typeof req.query.status === "string" ? req.query.status : "",
        page: req.query.page,
      });
      return res.send({ ok: true, ...data });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /shop/:centerId/orders/:id/deliver
  deliverOrder: async (req, res, next) => {
    try {
      const data = await shopService.deliverOrder(req.client._id, req.params.centerId, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "shop.orderDelivered" });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /shop/:centerId/orders/:id/refund
  refundOrder: async (req, res, next) => {
    try {
      const data = await shopService.refundOrder(req.client._id, req.params.centerId, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "shop.orderRefunded" });
    } catch (error) {
      next(error);
    }
  },
};
