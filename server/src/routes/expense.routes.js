const { Router } = require("express");
const expenseController = require("../controllers/expense.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireCenterMatch,
} = require("../middlewares/authenticator.middleware");
const Expense = require("../models/Expense");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);
// Staff boshqa filialning xarajatini ID orqali tahrirlay/bekor qila olmaydi
router.use("/:id", requireCenterMatch(Expense));

router.post("/", requireTenantPermission("expense:create"), expenseController.create);
router.get("/", requireTenantPermission("expense:view"), expenseController.list);
router.get("/by-category", requireTenantPermission("expense:view"), expenseController.byCategory);
router.get(
  "/export",
  requireTenantPermission("expense:view"),
  requireTariffFeature("excel.export"),
  expenseController.exportList,
);
router.patch("/:id", requireTenantPermission("expense:update"), expenseController.update);
router.patch("/:id/cancel", requireTenantPermission("expense:update"), expenseController.cancel);

module.exports = router;
