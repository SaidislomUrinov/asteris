// `notify.js` va `format.js` ikkalasi ham shuni ishlatadi — alohida faylda,
// aks holda ikkalasi bir-birini talab qilib doiraviy require hosil bo'ladi
// (notify.js -> index.js -> commands.js -> format.js -> notify.js).
const escapeHtml = (text) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

module.exports = { escapeHtml };
