const fs = require("fs");
const path = require("path");

// `nodemailer` ixtiyoriy bog'liqlik sifatida yuklanadi — o'rnatilmagan
// bo'lsa server baribir ishga tushadi, email jimgina o'tkazib yuboriladi.
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}

const TEMPLATE_DIR = path.join(__dirname, "..", "templates");

// Keshlangan transport — har xatda qayta yasalmaydi. Sozlama o'zgarganda
// `resetTransport()` chaqiriladi (systemSetting.service.updateSettings).
let transport = null;
let transportKey = "";

// Oddiy {{key}} almashtirish — tashqi shablon engine yo'q (kontrakt §5.2).
const renderTemplate = (name, data = {}) => {
  const file = path.join(TEMPLATE_DIR, `${name}.html`);
  if (!fs.existsSync(file)) return null;

  let html = fs.readFileSync(file, "utf8");
  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value == null ? "" : String(value));
  }
  // To'ldirilmagan kalitlar bo'sh qoladi — xom `{{...}}` foydalanuvchiga ko'rinmasin.
  return html.replace(/\{\{\s*[\w.]+\s*\}\}/g, "");
};

const resetTransport = () => {
  transport = null;
  transportKey = "";
};

const getTransport = (smtp) => {
  const key = `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.user}:${smtp.pass}`;
  if (transport && transportKey === key) return transport;

  transport = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 465,
    secure: !!smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  transportKey = key;
  return transport;
};

/**
 * Xat yuboradi. HECH QACHON otmaydi — natijani obyekt sifatida qaytaradi,
 * chaqiruvchi (job/servis) uni tekshirishi ixtiyoriy.
 * sozlama o'chiq / paket yo'q / manzil yo'q → `{ ok:false, skipped:true }`.
 */
const sendMail = async ({ to, subject, template, data = {}, html = "" }) => {
  try {
    if (!nodemailer) return { ok: false, skipped: true, error: "mail.packageMissing" };
    if (!to) return { ok: false, skipped: true, error: "mail.noRecipient" };

    const settings = await require("../services/systemSetting.service").getRaw();
    const smtp = settings?.smtp || {};

    if (!smtp.enabled || !smtp.host) return { ok: false, skipped: true, error: "mail.disabled" };

    const body = html || renderTemplate(template, data);
    if (!body) return { ok: false, skipped: true, error: "mail.templateNotFound" };

    const from = smtp.fromEmail
      ? `${smtp.fromName || "WENET"} <${smtp.fromEmail}>`
      : smtp.user;

    const info = await getTransport(smtp).sendMail({ from, to, subject, html: body });
    return { ok: true, messageId: info?.messageId || "" };
  } catch (error) {
    // Email hech qachon asosiy oqimni buzmaydi.
    return { ok: false, error: error?.message || "mail.failed" };
  }
};

module.exports = { sendMail, resetTransport, renderTemplate };
