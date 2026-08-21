const { Router } = require("express");
const groupHolidayController = require("../controllers/groupHoliday.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

router.get("/:groupId", requireTenantPermission("group:view"), groupHolidayController.list);
router.post("/:groupId", requireTenantPermission("group:update"), groupHolidayController.mark);
router.delete("/:groupId/:date", requireTenantPermission("group:update"), groupHolidayController.unmark);

module.exports = router;
