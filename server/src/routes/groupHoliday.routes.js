const { Router } = require("express");
const groupHolidayController = require("../controllers/groupHoliday.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireActiveSubscription,
  requireTeacherGroup,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// requireTeacherGroup — hodim faqat o'z filiali (o'qituvchi — o'z) guruhi.
router.get("/:groupId", requireTenantPermission("group:view"), requireTeacherGroup(), groupHolidayController.list);
router.post("/:groupId", requireTenantPermission("group:update"), requireTeacherGroup(), groupHolidayController.mark);
router.delete("/:groupId/:date", requireTenantPermission("group:update"), requireTeacherGroup(), groupHolidayController.unmark);

module.exports = router;
