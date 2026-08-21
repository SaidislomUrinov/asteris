const { Router } = require("express");
const tariffController = require("../controllers/tariff.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(adminAuth, fullAdminAuth);

router.post("/", requirePermission("tariff:create"), tariffController.create);
router.get("/", requirePermission("tariff:view"), tariffController.list);
router.get("/:id", requirePermission("tariff:view"), tariffController.getOne);
router.patch("/:id", requirePermission("tariff:update"), tariffController.update);
router.delete("/:id", requirePermission("tariff:delete"), tariffController.remove);

module.exports = router;
