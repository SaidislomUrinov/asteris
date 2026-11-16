/**
 * send-test-telegram.js — InputRichMessage (Bot API 10.2 sendRichMessage)
 * uslubida dars eslatmasi namunasini berilgan chatId'ga yuboradi.
 *
 * DB/Redis ulanishi shart emas — to'g'ridan-to'g'ri `bot.api.sendRichMessage`
 * chaqiradi, shuning uchun jobs/services qatlamiga tegmaydi.
 *
 * Ishlatish (server/ papkasidan):
 *   node --env-file=.env scripts/send-test-telegram.js <chatId>
 */
const { Bot } = require("grammy");

const chatId = process.argv[2];
if (!chatId) {
  console.error("Ishlatish: node scripts/send-test-telegram.js <chatId>");
  process.exit(1);
}

const run = async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN .env'da yo'q");
    process.exit(1);
  }
  const bot = new Bot(token);

  const cell = (text, header = false) => ({ text, align: "left", valign: "middle", ...(header ? { is_header: true } : {}) });

  await bot.api.sendRichMessage(chatId, {
    blocks: [
      { type: "heading", size: 3, text: "🔔 Darsingizga 60 daqiqa qoldi" },
      { type: "paragraph", text: { type: "bold", text: "Matematika - MAT-24" } },
      {
        type: "table",
        is_bordered: true,
        is_striped: true,
        cells: [
          [cell("Vaqt"), cell("14:00")],
          [cell("Filial"), cell("Chilonzor")],
          [cell("Xona"), cell("3-xona")],
          [cell("Mavzu"), cell("Kvadrat tenglamalar")],
        ],
      },
      { type: "divider" },
      { type: "footer", text: "WENET — test xabar (InputRichMessage, table)" },
    ],
  });

  console.log("Yuborildi:", chatId);
};

run()
  .catch((error) => {
    console.error("Xato:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
