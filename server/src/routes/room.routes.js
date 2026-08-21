const { Router } = require("express");
const roomController = require("../controllers/room.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
} = require("../middlewares/authenticator.middleware");
const Room = require("../models/Room");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// Staff boshqa filialning xonasini ID orqali ocha/tahrirlay olmaydi
router.use("/:id", requireCenterMatch(Room));

router.post("/", requireTenantPermission("room:create"), roomController.create);
router.get("/", requireTenantPermission("room:view"), roomController.list);
router.get(
  "/export",
  requireTenantPermission("room:view"),
  requireTariffFeature("excel.export"),
  roomController.exportList,
);
router.get(
  "/:id/export",
  requireTenantPermission("room:view"),
  requireTariffFeature("excel.export"),
  roomController.exportSchedule,
);
router.get("/:id", requireTenantPermission("room:view"), roomController.getOne);
router.get("/:id/schedule", requireTenantPermission("room:view"), roomController.schedule);
router.patch("/:id", requireTenantPermission("room:update"), roomController.update);
router.delete("/:id", requireTenantPermission("room:delete"), roomController.remove);

module.exports = router;
