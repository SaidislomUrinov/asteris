const { Router } = require("express");
const calendarController = require("../controllers/calendar.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

router.get("/:centerId/:month", requireTenantPermission("calendar:view"), calendarController.list);
router.post("/:centerId/mark", requireTenantPermission("calendar:manage"), calendarController.mark);
router.delete("/:centerId/:date", requireTenantPermission("calendar:manage"), calendarController.unmark);

module.exports = router;
