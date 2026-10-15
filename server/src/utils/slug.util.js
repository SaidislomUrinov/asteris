// Brend subdomeni (`{slug}.wenet.uz`) — API_CONTRACT_multi_center.md §1.
// Slug: 3–32 belgi, faqat lotin kichik harf/raqam/chiziqcha, chetlarida chiziqcha yo'q.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

// Infra va platforma uchun band nomlar — mijozga berilmaydi (aks holda
// `api.wenet.uz` kabi manzil o'g'irlanardi yoki chalg'ituvchi bo'lardi).
const RESERVED = new Set([
  "api", "app", "www", "admin", "console", "parent", "mail", "smtp", "ftp", "ns", "ns1", "ns2",
  "auth", "static", "cdn", "assets", "uploads", "test", "dev", "staging", "demo", "help", "support",
  "blog", "status", "wenet", "asteris", "docs", "billing", "pay", "www2", "webmail", "_acme-challenge",
]);

// O'zbek lotin/kirill va rus harflari → lotin.
const MAP = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o",
  ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const isValid = (slug) => SLUG_RE.test(slug) && !slug.includes("--");
const isReserved = (slug) => RESERVED.has(slug);

/**
 * Tekshiradi va normallashgan slug'ni qaytaradi; xato bo'lsa i18n kalit bilan Error.
 * @param {string} value
 * @returns {string}
 */
const assertSlug = (value) => {
  const slug = normalize(value);
  if (!isValid(slug)) throw new Error("client.slugInvalid");
  if (isReserved(slug)) throw new Error("client.slugReserved");
  return slug;
};

/**
 * Nomdan slug yasaydi: "Prime Academy" → "prime-academy", "Ilm ziyo" → "ilm-ziyo".
 * @param {string} name
 * @returns {string} bo'sh bo'lishi mumkin (nomda lotin/kirill harf bo'lmasa)
 */
const fromName = (name) => {
  const latin = normalize(name)
    .replace(/[ʻʼ'`‘’]/g, "")
    .split("")
    .map((ch) => (MAP[ch] !== undefined ? MAP[ch] : ch))
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
};

/**
 * Bandligini tekshirib, birinchi bo'sh variantni qaytaradi (`nom`, `nom-2`, ...).
 * @param {string} name
 * @param {(slug: string) => Promise<boolean>} isTaken
 * @returns {Promise<string>}
 */
const suggest = async (name, isTaken) => {
  let base = fromName(name);
  if (base.length < 3) base = `${base || "markaz"}-uz`.replace(/^-/, "");
  base = base.slice(0, 29).replace(/-+$/g, "");
  for (let i = 1; i < 100; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!isValid(candidate) || isReserved(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 32);
};

module.exports = { RESERVED, isValid, isReserved, assertSlug, fromName, suggest, normalize };
