// Faqat dev: ota-ona WebApp'ini ODDIY BRAUZERDA sinash uchun HMAC-imzolangan
// initData yasaydi (bot tokeni bilan — prod'dagi tekshiruv bilan bir xil).
// Ishlatish: node scripts/parent-dev-link.js <telegramUserId> [webappUrl]
//   masalan: node scripts/parent-dev-link.js 5991285234 http://localhost:5175
// Chiqqan havolani brauzerda oching — Telegram SDK initData'ni #tgWebAppData dan o'qiydi.
require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");

(async () => {
  const [uid, base = "http://localhost:5175"] = process.argv.slice(2);
  if (!uid) { console.error("userId kerak"); process.exit(1); }
  if (process.env.NODE_ENV === "production") { console.error("prod'da ishlatilmaydi"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const tok = (await require("../src/services/systemSetting.service").getRaw())?.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!tok) { console.error("Bot token topilmadi"); process.exit(1); }
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "dev",
    user: JSON.stringify({ id: Number(uid), first_name: "Dev", language_code: "uz" }),
  });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(tok).digest();
  p.set("hash", crypto.createHmac("sha256", secret).update(dcs).digest("hex"));
  console.log(`${base}/#tgWebAppData=${encodeURIComponent(p.toString())}&tgWebAppVersion=7.0&tgWebAppPlatform=web`);
  process.exit(0);
})();
