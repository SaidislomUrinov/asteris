const { Router } = require("express");
const calendarController = require("../controllers/calendar.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireOwnCenterParam,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// Hodim faqat O'Z filiali kalendari.
router.get("/:centerId/:month", requireTenantPermission("calendar:view"), requireOwnCenterParam(), calendarController.list);
router.post("/:centerId/mark", requireTenantPermission("calendar:manage"), requireOwnCenterParam(), calendarController.mark);
router.delete("/:centerId/:date", requireTenantPermission("calendar:manage"), requireOwnCenterParam(), calendarController.unmark);

module.exports = router;
