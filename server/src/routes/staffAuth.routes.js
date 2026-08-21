const { Router } = require("express");
const staffController = require("../controllers/staff.controller");
const { staffAuth, fullStaffAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

router.post("/signin", staffController.signIn);
router.post("/refresh", staffController.refreshToken);
router.get("/verify", staffAuth, fullStaffAuth, staffController.verify);
router.post("/signout", staffAuth, fullStaffAuth, staffController.signOutSession);
router.patch("/profile", staffAuth, fullStaffAuth, staffController.updateOwnProfile);

module.exports = router;
