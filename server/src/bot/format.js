// Telegram Bot API HTML rejimida <ul>/<li> kabi list tegi YO'Q (rasmiy
// hujjatda tasdiqlangan) — ro'yxatlar har doim qo'lda "• " + qator bilan
// quriladi. Uzunligidan qat'iy nazar yig'ilmaydi (expandable emas) — hamma
// element to'liq ko'rinib turadi.
/**
 * @param {string[]} items - HTML uchun ALLAQACHON escape qilingan qatorlar (bullet'siz)
 * @returns {string} "• item1\n• item2..."
 */
const bulletList = (items) => {
  if (!items.length) return "";
  return items.map((item) => `• ${item}`).join("\n");
};

// Telegram'da haqiqiy jadval (chiziq/katak) tegi yo'q. Avval eng yaqin
// natija sifatida <pre> (monospace) ichida ustunlar tekislangan edi, lekin
// MOBIL Telegram'da bunday blok ekranga sig'maydi — uzun fan/guruh nomi
// qatorni cho'zib yuboradi va o'ng ustunlar (davomat raqamlari) ko'rinmay
// qoladi, <pre> esa avtomatik qatorga bo'linmaydi. Shuning uchun ustunlar
// o'rniga har yozuv VERTIKAL blok bilan beriladi: sarlavha qalin, ostida
// oddiy matn qatorlari (ular tor ekranda o'zi ko'chib bo'linadi).
/**
 * @param {{title: string, lines: string[]}[]} items - HTML uchun ALLAQACHON escape qilingan
 * @returns {string} bloklar, orasida bo'sh qator
 */
const blockList = (items) => {
  if (!items.length) return "";
  return items
    .map(({ title, lines }) => [`<b>${title}</b>`, ...lines.filter(Boolean)].join("\n"))
    .join("\n\n");
};

// "Ko'rsatkich: qiymat" juftliklari — jadval o'rniga oddiy qatorlar, mobil
// ekranda o'zi bo'linadi.
/**
 * @param {[string, string][]} rows - HTML uchun ALLAQACHON escape qilingan
 */
const keyValue = (rows) => rows.map(([key, value]) => `${key}: <b>${value}</b>`).join("\n");

// `InputRichMessage` uchun haqiqiy jadval bloki (`<table>/<tr>/<td>`) —
// Telegram'ning yangi Bot API 10.2 (sendRichMessage) orqali chiziq/katak
// bilan haqiqiy jadval endi mavjud, shuning uchun eski "• "/vertikal blok
// workaroundi kerak emas. Matn RichText (oddiy string) — HTML escape shart emas.
const tableCell = (text, { header = false, align = "left" } = {}) => ({
  text,
  align,
  valign: "middle",
  ...(header ? { is_header: true } : {}),
});

/**
 * @param {string[]|null} headers - `null` bo'lsa sarlavha qatorsiz (key-value jadval)
 * @param {string[][]} rows
 * @returns {{type: "table", is_bordered: true, is_striped: true, cells: object[][]}}
 */
const richTable = (headers, rows) => ({
  type: "table",
  is_bordered: true,
  is_striped: true,
  cells: [
    ...(headers ? [headers.map((h) => tableCell(h, { header: true }))] : []),
    ...rows.map((r) => r.map((c) => tableCell(c))),
  ],
});

module.exports = { bulletList, blockList, keyValue, richTable };
