// Bot buyruqlari — /start, /chatid, /status.
// Barcha handlerlar o'z xatosini yutadi: Telegram tomonidagi muammo hech
// qachon serverga qaytmasligi kerak.

const getAlertChatIds = async () => {
  try {
    const settings = await require("../services/systemSetting.service").getRaw();
    return (settings?.telegram?.alertChatIds || []).map(String);
  } catch {
    return [];
  }
};

const isAllowed = async (ctx) => {
  const ids = await getAlertChatIds();
  return ids.includes(String(ctx.chat?.id));
};

const registerCommands = (bot) => {
  // "/start" ikki xil holatda keladi:
  // 1) Ilova ichidan "Telegramni ulash" havolasi orqali — `t.me/{bot}?start={token}`,
  //    Telegram buni "/start {token}" qilib yuboradi (`ctx.match` = token).
  //    Shu holatda shaxsiy bog'lanish (Client/Staff.telegram.chatId) o'rnatiladi.
  // 2) Botga to'g'ridan-to'g'ri, payload'siz kirilganda — umumiy ma'lumot.
  bot.command("start", async (ctx) => {
    const token = (ctx.match || "").trim();

    if (token) {
      try {
        const telegramService = require("../services/telegram.service");
        const result = await telegramService.resolveLink(token, ctx.chat.id);
        await ctx.reply(result.message);
      } catch {
        // ...
      }
      return;
    }

    try {
      await ctx.reply(
        "Asteris tizim boti.\n\n" +
          "Bu bot ham platforma darajasidagi texnik ogohlantirishlar, ham " +
          "Asteris ilovasiga ulangan Client/Xodimlarning shaxsiy bildirishnomalari " +
          "(dars eslatmalari, kunlik hisobotlar) uchun ishlaydi.\n\n" +
          "Shaxsiy bildirishnomalarni ulash uchun ilovadagi \"Bildirishnomalar\" " +
          "bo'limidan \"Telegramni ulash\" tugmasini bosing.\n\n" +
          "/chatid — shu chat ID sini ko'rsatadi\n" +
          "/status — server holati (faqat ruxsat etilgan chatlar uchun)",
      );
    } catch {
      // javob bermasa ham muhim emas
    }
  });

  // Admin bu ID ni sozlamadagi `alertChatIds` ga qo'lda kiritadi.
  bot.command("chatid", async (ctx) => {
    try {
      await ctx.reply(`Chat ID: <code>${ctx.chat?.id}</code>`, { parse_mode: "HTML" });
    } catch {
      // ...
    }
  });

  bot.command("status", async (ctx) => {
    try {
      if (!(await isAllowed(ctx))) {
        await ctx.reply("Bu buyruq faqat ruxsat etilgan chatlar uchun.");
        return;
      }

      const snap = await require("../services/monitoring.service").getSnapshot();
      const icon = { healthy: "🟢", degraded: "🟡", down: "🔴" }[snap.status] || "⚪️";

      const lines = [
        `${icon} <b>Asteris — ${snap.status}</b>`,
        `Uptime: ${Math.floor(snap.uptime / 3600)} soat`,
        `Mongo: ${snap.mongo.status} (${snap.mongo.latencyMs} ms)`,
        `Redis: ${snap.redis.status} (${snap.redis.latencyMs} ms)`,
        `Socket: ${snap.socket.connectedSockets} ulanish`,
        `API: ${snap.api.rpm} rpm · ${snap.api.avgLatencyMs} ms · xato ${snap.api.errorRate}%`,
        `RAM: ${snap.process.memoryMb} MB`,
        `Mijozlar: ${snap.tenants.clients} · faol obuna: ${snap.tenants.activeSubscriptions}`,
      ];

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    } catch (error) {
      try {
        await ctx.reply(`Holatni olishda xato: ${error?.message || "noma'lum"}`);
      } catch {
        // ...
      }
    }
  });
};

module.exports = registerCommands;
