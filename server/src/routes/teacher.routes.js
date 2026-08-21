const { Router } = require("express");
const teacherController = require("../controllers/teacher.controller");
const { tenantAuth, requireActiveSubscription } = require("../middlewares/authenticator.middleware");

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// O'qituvchi paneli bosh sahifasi — o'z guruhlari/xonalari/o'quvchilari va
// shu oygi oyligi. Staff o'zinikini ko'radi (controller shuni majburlaydi).
router.get("/dashboard", teacherController.dashboard);

// Hozir davom etayotgan dars (agar bo'lsa) — teacher/assistant "Dars"
// sahifasi shu endpointdan yuklanadi (API_CONTRACT.md).
router.get("/current-lesson", teacherController.currentLesson);

module.exports = router;
