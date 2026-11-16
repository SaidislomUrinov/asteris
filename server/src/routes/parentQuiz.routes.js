const { Router } = require("express");
const parentQuizController = require("../controllers/parentQuiz.controller");
const { parentAuth } = require("../middlewares/authenticator.middleware");

// Test (Quiz) — Ota-ona/O'quvchi WebApp tomoni (docs/API_CONTRACT_quiz.md),
// `parent.routes.js` bilan bir xil auth naqshi, alohida fayl (quiz uchun
// endpoint ko'p, mavjud faylni shishirmaslik uchun).
const router = Router();

router.use(parentAuth);

// Path-param collision yo'q ("active" 1 segment, boshqalari 2+), lekin
// aniqlik uchun param-route'lardan OLDIN qo'yiladi.
router.get("/active", parentQuizController.active);
router.get("/history", parentQuizController.history);

router.get("/:entryId/:quizId/state", parentQuizController.state);
router.post("/:entryId/:quizId/start", parentQuizController.start);
router.put("/:entryId/:quizId/answer", parentQuizController.answer);
router.post("/:entryId/:quizId/finish", parentQuizController.finish);
router.get("/:entryId/:quizId/result", parentQuizController.result);

module.exports = router;
