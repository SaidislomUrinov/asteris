// Brend subdomeni (docs/API_CONTRACT_multi_center.md §5): har mijoz o'z
// manzilida — `{slug}.wenet.uz`. Barcha subdomenlar bitta build'ga qaraydi,
// mijoz hostname'dan aniqlanadi. Dev'da `{slug}.localhost:5174` (Chrome
// `*.localhost` ni qo'shimcha sozlashsiz ochadi).

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "wenet.uz";

// Platformaning o'z subdomenlari — brend emas.
const PLATFORM_HOSTS = new Set(["app", "www", "api", "console", "parent", "admin"]);

const isLocalHost = (host) => host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";

/** Joriy manzildagi brend slug'i; umumiy manzilda (app.wenet.uz, localhost) — null. */
export const getBrandSlug = () => {
  const host = window.location.hostname.toLowerCase();
  let label = null;
  if (host.endsWith(".localhost")) label = host.slice(0, -".localhost".length);
  else if (host.endsWith(`.${ROOT_DOMAIN}`)) label = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!label || label.includes(".") || PLATFORM_HOSTS.has(label)) return null;
  return label;
};

/** Brend manzili (yo'lsiz): `https://prime.wenet.uz` yoki dev'da `http://prime.localhost:5174`. */
export const brandUrl = (slug) => {
  const { protocol, hostname, port } = window.location;
  if (isLocalHost(hostname)) return `${protocol}//${slug}.localhost${port ? `:${port}` : ""}`;
  return `https://${slug}.${ROOT_DOMAIN}`;
};

/** Umumiy (slug'siz) kirish manzili: `https://app.wenet.uz` (dev: `http://localhost:5174`). */
export const platformUrl = () => {
  const { protocol, hostname, port } = window.location;
  if (isLocalHost(hostname)) return `${protocol}//localhost${port ? `:${port}` : ""}`;
  return `https://app.${ROOT_DOMAIN}`;
};

// Qo'llab-quvvatlash kontaktlari (.env): VITE_SUPPORT_TELEGRAM — username,
// VITE_SUPPORT_PHONES — vergul bilan bir nechta raqam.
export const supportTelegram = () => import.meta.env.VITE_SUPPORT_TELEGRAM || "Saidweb";
export const supportPhones = () =>
  String(import.meta.env.VITE_SUPPORT_PHONES || "+998931042255")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
// "+998931042255" → "+998 93 104 22 55"
export const formatSupportPhone = (p) =>
  /^\+998\d{9}$/.test(p) ? `+998 ${p.slice(4, 6)} ${p.slice(6, 9)} ${p.slice(9, 11)} ${p.slice(11)}` : p;

/** Manzil ko'rinishi (ekranda): `prime.wenet.uz`. */
export const brandHost = (slug) => `${slug}.${isLocalHost(window.location.hostname) ? "localhost" : ROOT_DOMAIN}`;

/** Slug'ni kiritilgan matndan tozalash ("Prime.wenet.uz/" → "prime"). */
export const normalizeSlugInput = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[./]/)[0]
    .replace(/[^a-z0-9-]/g, "");

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
