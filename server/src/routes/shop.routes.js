const { Router } = require("express");
const shopController = require("../controllers/shop.controller");
const {
  tenantAuth,
  requireActiveSubscription,
  requireTenantPermission,
  requireTariffFeature,
  requireOwnCenterParam,
} = require("../middlewares/authenticator.middleware");

// Filial do'koni — mahsulotlar va buyurtmalar (API_CONTRACT_wecoin.md §3).
const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
router.use(requireTariffFeature("gamification.coins"));

const view = [requireTenantPermission("coin:view"), requireOwnCenterParam()];
const manage = [requireTenantPermission("coin:manage"), requireOwnCenterParam()];

router.get("/:centerId/products", ...view, shopController.listProducts);
router.post("/:centerId/products", ...manage, shopController.createProduct);
router.patch("/:centerId/products/:id", ...manage, shopController.updateProduct);
router.delete("/:centerId/products/:id", ...manage, shopController.removeProduct);

router.get("/:centerId/orders", ...view, shopController.listOrders);
router.patch("/:centerId/orders/:id/deliver", ...manage, shopController.deliverOrder);
router.patch("/:centerId/orders/:id/refund", ...manage, shopController.refundOrder);

module.exports = router;
