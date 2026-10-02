// OTA-ONA oqimi — bitta bot, hodim/owner ulanishi bilan yonma-yon yashaydi
// (project_parent_telegram_webapp_plan). Kirish nuqtasi `commands.js`dagi
// bo'sh `/start` (chat hodimga ulanmagan bo'lsa) yoki `/parent`.
//
// Bosqichlar (holat Redis'da, `bot:state:{chatId}`, 1 soat):
//   lang    → inline tugma bilan til tanlash
//   contact → `request_contact` klaviaturasi; kelgan raqam bo'yicha
//             `availableRoles` (parentTelegramPhone / telegramPhone mosliklari soni)
//   role    → "Ota-ona / O'quvchi" inline tugmalari (`prole:*`) —
//             API_CONTRACT_student_role_homework.md §2
//
// Raqam qo'lda kiritilmaydi — faqat Telegram bergan contact, va u o'zining
// (`contact.user_id === from.id`) bo'lishi shart.
const { InlineKeyboard, Keyboard } = require("grammy");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");
const parentService = require("../services/parent.service");
const { t } = require("./i18n");
const { escapeHtml } = require("./escapeHtml");
// Aylanma import: parentNotification.service → notify → bot/index →
// commands → parentFlow → notify (hali yuklanmagan) — shuning uchun lazy.
const parentWebAppMarkup = (...args) => require("./notify").parentWebAppMarkup(...args);
const { normalizeTelegramPhone } = require("../utils/phone.util");

const STATE_TTL = 3600;
const LANGS = ["uz", "ru", "en"];
const LANG_LABEL = { uz: "O'zbekcha", ru: "Русский", en: "English" };

const getState = async (chatId) => {
  try {
    const raw = await redis.get(keyConfig.botState(chatId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("bot parent getState:", error?.message || error);
    return null;
  }
};
const setState = async (chatId, state) => {
  try {
    await redis.set(keyConfig.botState(chatId), JSON.stringify(state), "EX", STATE_TTL);
  } catch (error) {
    // holat saqlanmasa oqim /start dan qayta boshlanadi — xato emas
    console.error("bot parent setState:", error?.message || error);
  }
};
const clearState = async (chatId) => {
  try {
    await redis.del(keyConfig.botState(chatId));
  } catch (error) {
    console.error("bot parent clearState:", error?.message || error);
  }
};

const langKeyboard = (prefix) => {
  const kb = new InlineKeyboard();
  LANGS.forEach((l) => kb.text(LANG_LABEL[l], `${prefix}:${l}`));
  return kb;
};

const contactKeyboard = (lang) =>
  new Keyboard().requestContact(t(lang, "parentShareButton")).resized().oneTime();

const ROLE_NAME_KEY = { parent: "parentRoleNameParent", student: "parentRoleNameStudent" };
const roleName = (lang, role) => t(lang, ROLE_NAME_KEY[role] || ROLE_NAME_KEY.parent);
const withRole = (lang, key, role) => t(lang, key).replace("{role}", () => roleName(lang, role));

// Callback handler xatosi — jim yutilmaydi (§6.4), lekin foydalanuvchiga
// ham chiqmaydi.
const logError = (where) => (error) => console.error(`bot parent ${where}:`, error?.message || error);

// Farzandlar ro'yxati matni:
//   parent  → "• Ali Karimov — Chilonzor filiali (2 guruh)"
//   student → "• Chilonzor filiali — Matematika, IELTS"
const childrenText = (lang, children, role = "parent") => {
  if (role === "student") {
    return children
      .flatMap((c) => c.centers)
      .map((x) => `• <b>${escapeHtml(x.centerName)}</b> — ${escapeHtml((x.groupNames || []).join(", ")) || "—"}`)
      .join("\n");
  }
  return children
    .map((c) => {
      const centers = c.centers
        .map((x) => `${escapeHtml(x.centerName)} (${x.groupCount} ${t(lang, "parentGroups")})`)
        .join(", ");
      const self = c.isSelf ? ` ${t(lang, "parentFoundSelf")}` : "";
      return `• <b>${escapeHtml(c.fullName)}</b>${self} — ${centers || "—"}`;
    })
    .join("\n");
};

const foundKey = (role) => (role === "student" ? "studentFound" : "parentFound");
const linkedKey = (role) => (role === "student" ? "studentLinked" : "parentLinked");

const roleKeyboard = (lang, prefix) =>
  new InlineKeyboard()
    .text(t(lang, "parentRoleParent"), `${prefix}:parent`)
    .text(t(lang, "parentRoleStudent"), `${prefix}:student`);

// WebApp tugmasi (+ ikkala rol mavjud bo'lsa "Rolni almashtirish" qatori).
// Telegram guruh havolasi botda chiqmaydi — faqat WebApp guruh sahifasida.
const linkedMarkup = async (lang, bothRoles) => {
  const markup = await parentWebAppMarkup(t(lang, "parentOpenApp"));
  if (!bothRoles) return markup;
  const rows = [...(markup?.inline_keyboard || []), [{ text: t(lang, "parentRoleSwitch"), callback_data: "proleswitch" }]];
  return { inline_keyboard: rows };
};

// 1-bosqich: til so'rash.
const askLang = async (ctx) => {
  await setState(ctx.chat.id, { step: "lang" });
  await ctx.reply(t("uz", "parentAskLang"), { reply_markup: langKeyboard("plang") });
};

// 2-bosqich: raqam so'rash.
const askContact = async (ctx, lang) => {
  await setState(ctx.chat.id, { step: "contact", lang });
  await ctx.reply(t(lang, "parentAskContact"), { reply_markup: contactKeyboard(lang) });
};

// 3-bosqich: rol so'rash. Ikkala tugma DOIM chiqadi (§2.1).
const askRole = async (ctx, lang, phone) => {
  await setState(ctx.chat.id, { step: "role", lang, phone });
  await ctx.reply(t(lang, "parentAskRole"), { reply_markup: roleKeyboard(lang, "prole") });
};

// Allaqachon ulangan foydalanuvchi uchun salomlashish + ro'yxat.
const greetLinked = async (ctx, parent) => {
  const lang = parent.telegram.lang || "uz";
  if (parent.telegram.blockedAt) await parentService.unblock(ctx.chat.id);
  const counts = await parentService.availableRoles(parent.phone);
  const role = await parentService.effectiveRole(parent, counts);
  const bothRoles = counts.parent > 0 && counts.student > 0;
  const children = await parentService.findChildren(parent.phone, role);
  const head = `${t(lang, "parentWelcomeBack")}, ${escapeHtml(parent.name || "")}`.trim();
  const reply_markup = await linkedMarkup(lang, bothRoles);
  if (!children.length) {
    await ctx.reply(`${head}\n\n${t(lang, "parentNoChildren")}`, { parse_mode: "HTML", reply_markup });
    return;
  }
  await ctx.reply(`${head}\n\n${t(lang, foundKey(role))}\n${childrenText(lang, children, role)}`, {
    parse_mode: "HTML",
    reply_markup,
  });
};

// Raqam bo'yicha rollarni tekshiradi: hech biri yo'q → "topilmadi" + "Qayta
// tekshirish"; aks holda rol so'raladi. `removeKeyboard` — contact
// klaviaturasini olib tashlovchi birinchi xabar (Telegram bitta xabarda reply
// va inline klaviaturani birga bermaydi).
const proceedWithPhone = async (ctx, lang, phone, { removeKeyboard }) => {
  const counts = await parentService.availableRoles(phone);
  if (!counts.parent && !counts.student) {
    // Raqam holatda qoladi — "Qayta tekshirish" shu raqamni qayta qidiradi.
    await setState(ctx.chat.id, { step: "recheck", lang, phone });
    await ctx.reply(t(lang, "parentNotFound"), {
      reply_markup: new InlineKeyboard().text(t(lang, "parentRecheckButton"), "precheck"),
    });
    return;
  }
  if (removeKeyboard) await ctx.reply(t(lang, "parentContactReceived"), { reply_markup: { remove_keyboard: true } });
  await askRole(ctx, lang, phone);
};

// Contact qabul qilish — bosqichdan qat'i nazar (foydalanuvchi "Qayta
// tekshirish" o'rniga raqamni qayta yuborsa ham ishlaydi).
const handleContact = async (ctx) => {
  const contact = ctx.message?.contact;
  if (!contact) return;
  const state = (await getState(ctx.chat.id)) || {};
  const existing = await parentService.findByChat(ctx.chat.id);
  const lang = state.lang || existing?.telegram?.lang || "uz";

  // `user_id` SHART: Telegram'da akkaunti yo'q raqam kontakt sifatida
  // ulashilsa `user_id` bo'lmaydi — aks holda begona raqam (masalan eski
  // ota-ona raqami) bilan uning farzandlari ma'lumotiga ulanib olish mumkin edi.
  if (!contact.user_id || String(contact.user_id) !== String(ctx.from?.id)) {
    await ctx.reply(t(lang, "parentContactNotOwn"), { reply_markup: contactKeyboard(lang) });
    return;
  }

  // Xorijiy raqamlar ham (`+` bilan yoki `+`siz) — API_CONTRACT_telegram_phone.md §2.
  await proceedWithPhone(ctx, lang, normalizeTelegramPhone(contact.phone_number) || "", { removeKeyboard: true });
};

// `/role` va "Rolni almashtirish" tugmasi — ikkala rol mavjud bo'lsa tanlov.
const showRoleMenu = async (ctx, parent) => {
  const lang = parent.telegram.lang || "uz";
  const counts = await parentService.availableRoles(parent.phone);
  const role = await parentService.effectiveRole(parent, counts);
  if (!(counts.parent > 0 && counts.student > 0)) {
    await ctx.reply(withRole(lang, "parentRoleOnlyOne", role));
    return;
  }
  await ctx.reply(withRole(lang, "parentRoleCurrent", role), { reply_markup: roleKeyboard(lang, "psetrole") });
};

const register = (bot) => {
  // Til tanlandi (birinchi kirish).
  bot.callbackQuery(/^plang:(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(logError("plang edit"));
      await askContact(ctx, lang);
    } catch (error) {
      logError("plang")(error);
    }
  });

  // /lang orqali til almashtirish (ulangan foydalanuvchi).
  bot.callbackQuery(/^psetlang:(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    try {
      await ctx.answerCallbackQuery();
      const parent = await parentService.setLang(ctx.chat.id, lang);
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(logError("psetlang edit"));
      await ctx.reply(parent ? t(lang, "parentLangSaved") : t(lang, "parentNoChildren"));
    } catch (error) {
      logError("psetlang")(error);
    }
  });

  // "Qayta tekshirish" — oxirgi yuborilgan raqam bilan qayta qidiruv.
  bot.callbackQuery("precheck", async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const state = await getState(ctx.chat.id);
      const lang = state?.lang || "uz";
      if (!state?.phone) {
        await askContact(ctx, lang);
        return;
      }
      await proceedWithPhone(ctx, lang, state.phone, { removeKeyboard: true });
    } catch (error) {
      logError("precheck")(error);
    }
  });

  // Rol tanlandi (ulanish oqimi) — shu rolda o'quvchi bo'lsa Parent saqlanadi.
  bot.callbackQuery(/^prole:(parent|student)$/, async (ctx) => {
    const role = ctx.match[1];
    try {
      await ctx.answerCallbackQuery();
      const state = await getState(ctx.chat.id);
      const lang = state?.lang || "uz";
      if (!state?.phone) {
        await askContact(ctx, lang);
        return;
      }
      const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
      const result = await parentService.linkByContact({
        chatId: ctx.chat.id,
        userId: ctx.from?.id,
        phone: state.phone,
        name,
        lang,
        role,
      });
      if (!result.ok) {
        // Tanlangan rolda topilmadi — rol tugmalari QAYTA chiqadi.
        await ctx.reply(withRole(lang, "parentRoleNotFound", role), { reply_markup: roleKeyboard(lang, "prole") });
        return;
      }
      await clearState(ctx.chat.id);
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(logError("prole edit"));
      const counts = await parentService.availableRoles(state.phone);
      await ctx.reply(`${t(lang, foundKey(role))}\n${childrenText(lang, result.children, role)}`, { parse_mode: "HTML" });
      await ctx.reply(t(lang, linkedKey(role)), {
        reply_markup: await linkedMarkup(lang, counts.parent > 0 && counts.student > 0),
      });
    } catch (error) {
      logError("prole")(error);
    }
  });

  // Ulangan foydalanuvchi rolini almashtirdi (`/role` → tugma).
  bot.callbackQuery(/^psetrole:(parent|student)$/, async (ctx) => {
    const role = ctx.match[1];
    try {
      await ctx.answerCallbackQuery();
      const parent = await parentService.findByChat(ctx.chat.id);
      if (!parent) {
        await askLang(ctx);
        return;
      }
      const lang = parent.telegram.lang || "uz";
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(logError("psetrole edit"));
      try {
        await parentService.setRole(parent, role);
      } catch (error) {
        if (error?.message === "parent.roleNotAvailable" || error?.message === "parent.invalidRole") {
          await ctx.reply(withRole(lang, "parentRoleOnlyOne", await parentService.effectiveRole(parent)));
          return;
        }
        throw error;
      }
      await ctx.reply(withRole(lang, "parentRoleSaved", role));
      await greetLinked(ctx, parent);
    } catch (error) {
      logError("psetrole")(error);
    }
  });

  // greetLinked ostidagi "Rolni almashtirish" — `/role` bilan bir xil.
  bot.callbackQuery("proleswitch", async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const parent = await parentService.findByChat(ctx.chat.id);
      if (!parent) {
        await askLang(ctx);
        return;
      }
      await showRoleMenu(ctx, parent);
    } catch (error) {
      logError("proleswitch")(error);
    }
  });

  bot.on("message:contact", async (ctx) => {
    try {
      await handleContact(ctx);
    } catch (error) {
      logError("contact")(error);
    }
  });

  // Hodim sifatida ulangan chat ham ota-ona/o'quvchi bo'lishi mumkin.
  bot.command("parent", async (ctx) => {
    try {
      const parent = await parentService.findByChat(ctx.chat.id);
      if (parent) await greetLinked(ctx, parent);
      else await askLang(ctx);
    } catch (error) {
      logError("/parent")(error);
    }
  });

  bot.command("children", async (ctx) => {
    try {
      const parent = await parentService.findByChat(ctx.chat.id);
      if (!parent) {
        await askLang(ctx);
        return;
      }
      await greetLinked(ctx, parent);
    } catch (error) {
      logError("/children")(error);
    }
  });

  bot.command("role", async (ctx) => {
    try {
      const parent = await parentService.findByChat(ctx.chat.id);
      if (!parent) {
        await askLang(ctx);
        return;
      }
      await showRoleMenu(ctx, parent);
    } catch (error) {
      logError("/role")(error);
    }
  });

  bot.command("lang", async (ctx) => {
    try {
      const parent = await parentService.findByChat(ctx.chat.id);
      if (!parent) {
        await askLang(ctx);
        return;
      }
      await ctx.reply(t(parent.telegram.lang, "parentAskLang"), { reply_markup: langKeyboard("psetlang") });
    } catch (error) {
      logError("/lang")(error);
    }
  });

  bot.command("unlink", async (ctx) => {
    try {
      const parent = await parentService.findByChat(ctx.chat.id);
      const lang = parent?.telegram?.lang || "uz";
      await parentService.unlink(ctx.chat.id);
      await clearState(ctx.chat.id);
      await ctx.reply(t(lang, "parentUnlinked"), { reply_markup: { remove_keyboard: true } });
    } catch (error) {
      logError("/unlink")(error);
    }
  });
};

module.exports = { register, askLang, greetLinked };
