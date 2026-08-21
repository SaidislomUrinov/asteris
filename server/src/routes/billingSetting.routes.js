const { Router } = require("express");
const billingSettingController = require("../controllers/billingSetting.controller");
const {
  clientAuth,
  fullClientAuth,
  requireActiveSubscription,
} = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(clientAuth, fullClientAuth);
router.use(requireActiveSubscription);

router.get("/:centerId", billingSettingController.getSettings);
router.patch("/:centerId", billingSettingController.updateSettings);

module.exports = router;
