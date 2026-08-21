const { Router } = require("express");
const clientController = require("../controllers/client.controller");
const { clientAuth, fullClientAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

router.post("/signin", clientController.signIn);
router.post("/refresh", clientController.refreshToken);
router.get("/verify", clientAuth, fullClientAuth, clientController.verify);
router.post("/signout", clientAuth, fullClientAuth, clientController.signOutSession);
router.get("/tariffs", clientAuth, fullClientAuth, clientController.listTariffs);
router.post("/subscription/initiate", clientAuth, fullClientAuth, clientController.initiateSubscription);
router.get("/subscription/status/:orderId", clientAuth, fullClientAuth, clientController.subscriptionStatus);

module.exports = router;
