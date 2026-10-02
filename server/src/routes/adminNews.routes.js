const { Router } = require("express");
const fileUpload = require("express-fileupload");
const newsController = require("../controllers/news.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Platform Admin — yangiliklar (API_CONTRACT_news.md §2). `["all"]` avtomatik o'tadi.
router.use(adminAuth, fullAdminAuth, requirePermission("news:manage"));

// Video ≤100MB — shu yo'l app.js'dagi global 10MB fileUpload'dan chetlab
// o'tadi. Limit oshsa busboy oqimi to'xtatiladi va loyiha formatida
// `news.fileTooLarge` qaytadi (abortOnLimit default'dagi 413 matn o'rniga).
// Rasm uchun 10MB cheklov servisda (`file.size`) tekshiriladi.
const newsMediaUpload = fileUpload({
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  abortOnLimit: true,
  limitHandler: (req, res) => {
    if (!res.headersSent) res.send({ ok: false, msg: "news.fileTooLarge" });
  },
});

// Literal yo'llar `/:id` dan OLDIN.
router.post("/media", newsMediaUpload, newsController.uploadMedia);

router.get("/", newsController.adminList);
router.post("/", newsController.create);
router.get("/:id", newsController.adminGetOne);
router.patch("/:id", newsController.update);
router.post("/:id/publish", newsController.publish);
router.delete("/:id", newsController.remove);

module.exports = router;
