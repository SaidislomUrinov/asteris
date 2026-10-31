const smsService = require("../services/sms.service");
const { buildActor } = require("../utils/audit.util");

// Filial konteksti: tenantAuth Staff uchun majburan o'z filialini, Owner uchun
// `x-center-id` headerini `req.query.center`ga qo'yadi.
const centerOf = (req) => req.query.center;

const wrap = (fn) => async (req, res, next) => {
  try {
    const payload = await fn(req);
    return res.send({ ok: true, ...payload });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // ── Client (Owner + Staff) ──
  templates: wrap(async () => ({ data: await smsService.listTemplates() })),
  summary: wrap(async (req) => ({ data: await smsService.summary(req.client._id, centerOf(req)) })),
  preview: wrap(async (req) => ({ data: await smsService.preview(req.client._id, centerOf(req), req.body) })),
  send: wrap(async (req) => ({
    data: await smsService.send(req.client._id, centerOf(req), req.body, buildActor(req)),
    msg: "sms.sending",
  })),
  batches: wrap(async (req) => ({
    ...(await smsService.listBatches(req.client._id, centerOf(req), { page: req.query.page })),
  })),
  batchDetail: wrap(async (req) => ({
    ...(await smsService.batchDetail(req.client._id, centerOf(req), req.params.id, {
      page: req.query.page,
      status: req.query.status,
    })),
  })),
  refreshBatch: wrap(async (req) => {
    await smsService.refreshBatch(req.client._id, centerOf(req), req.params.id);
    return {};
  }),

  packages: wrap(async () => ({ data: await smsService.listPackages() })),
  buy: wrap(async (req) => ({ ...(await smsService.buyPackage(req.client._id, centerOf(req), req.params.id)) })),
  purchaseStatus: wrap(async (req) => ({
    ...(await smsService.verifyAndCredit(req.params.orderId, req.client._id)),
  })),
  purchases: wrap(async (req) => ({ ...(await smsService.listPurchases(req.client._id, centerOf(req), req.query)) })),
  transactions: wrap(async (req) => ({ ...(await smsService.listTransactions(req.client._id, centerOf(req), req.query)) })),

  // ── Platform Admin ──
  adminPackages: wrap(async () => ({ data: await smsService.adminListPackages() })),
  adminCreatePackage: wrap(async (req) => ({ data: await smsService.adminCreatePackage(req.body), msg: "sms.packageSaved" })),
  adminUpdatePackage: wrap(async (req) => ({
    data: await smsService.adminUpdatePackage(req.params.id, req.body),
    msg: "sms.packageSaved",
  })),
  adminRemovePackage: wrap(async (req) => {
    await smsService.adminRemovePackage(req.params.id);
    return { msg: "sms.packageDeleted" };
  }),
  adminStats: wrap(async () => ({ data: await smsService.adminStats() })),
  adminUpdateStats: wrap(async (req) => ({ data: await smsService.adminUpdateStats(req.body), msg: "sms.statsSaved" })),
  adminPurchases: wrap(async (req) => ({ ...(await smsService.adminPurchases(req.query)) })),
  adminTemplates: wrap(async () => ({ data: await smsService.listTemplates({ onlyActive: false }) })),
  adminCreateTemplate: wrap(async (req) => ({ data: await smsService.createTemplate(req.body), msg: "sms.templateSaved" })),
  adminUpdateTemplate: wrap(async (req) => ({
    data: await smsService.updateTemplate(req.params.id, req.body),
    msg: "sms.templateSaved",
  })),
  adminRemoveTemplate: wrap(async (req) => {
    await smsService.removeTemplate(req.params.id);
    return { msg: "sms.templateDeleted" };
  }),
  adminBatches: wrap(async (req) => ({ ...(await smsService.adminBatches(req.query)) })),
  adminBatchDetail: wrap(async (req) => ({
    ...(await smsService.adminBatchDetail(req.params.id, { page: req.query.page, status: req.query.status })),
  })),
  adminClientCenters: wrap(async (req) => ({ data: await smsService.adminClientCenters(req.params.id) })),
  adminGrant: wrap(async (req) => ({ data: await smsService.adminGrant(req.body, buildActor(req)), msg: "sms.grantDone" })),
  adminTest: wrap(async (req) => ({ data: await smsService.adminTest(req.body), msg: "sms.testSent" })),
  adminTestStatus: wrap(async (req) => ({ data: await smsService.adminTestStatus(req.params.id) })),
};
