// Bir martalik sinov skripti: bot/format.js orqali qurilgan xabarni (qisqa
// va uzun ro'yxat, ikkalasi ham) haqiqiy Telegram chatga yuboradi.
// Ishlatish: node scripts/testBotFormat.js <chatId>
require("dotenv").config();
const mongoose = require("mongoose");
const { getApiBot } = require("../src/bot");
const { sendAlert } = require("../src/bot/alert");
const { bulletList } = require("../src/bot/format");

const chatId = process.argv[2];
if (!chatId) {
  console.error("Chat ID kerak: node scripts/testBotFormat.js <chatId>");
  process.exit(1);
}

const run = async () => {
  // getApiBot() SystemSetting.telegram'ni Mongo'dan o'qiydi — ulanish shart.
  await mongoose.connect(process.env.MONGO_URI);
  const bot = await getApiBot();
  if (!bot) {
    console.error("Bot ishga tushmadi — SystemSetting.telegram.enabled/botToken tekshiring.");
    process.exit(1);
  }

  const longList = bulletList(
    Array.from({ length: 9 }, (_, i) => `Matematika - GRP-${100 + i} (14:0${i}–15:3${i})`),
  );

  const text = ["<b>Format sinovi</b>", "", "<b>Ro'yxat</b>", longList].join("\n");

  await bot.api.sendMessage(chatId, text, { parse_mode: "HTML", disable_web_page_preview: true });
  console.log("Format xabari yuborildi:", chatId);

  // Tizim ogohlantirishlari — `SystemSetting.telegram.alertChatIds` ichidagi
  // HAMMA chatga boradi (bu skript o'sha ro'yxatga alohida qo'shmaydi,
  // faqat mavjud sozlamadan foydalanadi). force+throttle:false — sinov
  // uchun cheklovlarni chetlab o'tadi.
  const alerts = [
    ["serverError", { title: "Server xatosi", body: "500 status kodi ko'p qaytmoqda.", meta: { Endpoint: "/api/payment", Soni: 12 } }],
    ["healthDegraded", { title: "Tizim holati yomonlashdi", body: "Infratuzilma komponentlaridan biri javob bermayapti.", meta: { Mongo: "down", Redis: "healthy" } }],
    ["subscriptionExpiring", { title: "Obuna eslatmasi", body: "Kunlik tekshiruv yakunlandi.", meta: { "Tugash arafasida": 3, Tugagan: 1, "Xabar berildi": 4 } }],
    ["newLead", { title: "Yangi lead", body: "Saytdan yangi murojaat tushdi.", meta: { Ism: "Aziz Karimov", Telefon: "+998901234567" } }],
    ["test", { title: "Sinov xabari", body: "Bu — sendAlert() orqali yuborilgan sinov xabari." }],
  ];

  for (const [type, payload] of alerts) {
    const res = await sendAlert(type, payload, { force: true, throttle: false });
    console.log(type, "->", res);
  }

  process.exit(0);
};

run().catch((error) => {
  console.error("Xato:", error.message);
  process.exit(1);
});
