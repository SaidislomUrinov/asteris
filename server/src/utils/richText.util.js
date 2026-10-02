const sanitizeHtml = require("sanitize-html");

// Admin chatdan yuboriladigan rich-text xabarlar uchun qat'iy whitelist —
// faqat b/strong, i/em, ul/ol/li, blockquote, a (href), br, p. Boshqa hamma
// narsa (script, style, on* atributlar, img va h.k.) kesib tashlanadi —
// natija client tomonda `dangerouslySetInnerHTML` bilan ko'rsatiladi.
const OPTIONS = {
  allowedTags: ["b", "strong", "i", "em", "ul", "ol", "li", "blockquote", "a", "br", "p"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
  // Bo'sh <p></p>/<div></div> qatorlar ko'p bo'lib qolmasligi uchun
  // ketma-ket bo'sh bloklarni siqadi (contentEditable ko'p shunday chiqaradi).
  exclusiveFilter: (frame) =>
    ["p", "div"].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren?.length,
};

const sanitizeChatHtml = (html) => sanitizeHtml(String(html || ""), OPTIONS).trim();

// Yangiliklar (API_CONTRACT_news.md §2) — chat whitelist'i + sarlavha (h3),
// tagiga chizish (u), ustidan chizish (s), inline kod (code). img/iframe/
// script/style bu yerda ham YO'Q — media alohida `News.media` maydonida.
// Chat OPTIONS o'zgarmaydi: bu alohida nusxa.
const NEWS_OPTIONS = {
  ...OPTIONS,
  allowedTags: [...OPTIONS.allowedTags, "h3", "u", "s", "code"],
};

const sanitizeNewsHtml = (html) => sanitizeHtml(String(html || ""), NEWS_OPTIONS).trim();

// Suhbatlar ro'yxati/preview uchun HTML'dan sof matn (teglarsiz, qisqa).
const stripHtml = (html) =>
  sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

module.exports = { sanitizeChatHtml, sanitizeNewsHtml, stripHtml };
