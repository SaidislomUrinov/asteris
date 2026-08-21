const { Router } = require("express");
const clientController = require("../controllers/client.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth);

router.post("/", requirePermission("client:create"), clientController.create);
router.get("/", requirePermission("client:view"), clientController.list);
router.get("/:id", requirePermission("client:view"), clientController.getOne);
router.patch("/:id", requirePermission("client:update"), clientController.update);
router.delete("/:id", requirePermission("client:delete"), clientController.remove);

router.patch("/:id/block", requirePermission("client:block"), clientController.block);
router.patch("/:id/unblock", requirePermission("client:block"), clientController.unblock);

router.post(
  "/:id/subscribe",
  requirePermission("client:subscribe"),
  clientController.subscribe,
);
router.post(
  "/:id/unsubscribe",
  requirePermission("client:subscribe"),
  clientController.unsubscribe,
);
router.patch(
  "/:id/change-tariff",
  requirePermission("client:subscribe"),
  clientController.changeTariff,
);

module.exports = router;
