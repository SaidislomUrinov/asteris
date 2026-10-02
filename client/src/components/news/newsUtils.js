import { API } from "../../utils/fetching";
import i18n from "../../utils/i18n";
import { dateLocale } from "../../utils/locale";
import { extractYouTubeId } from "../../utils/youtube";

// Yangiliklar komponentlari uchun umumiy yordamchilar. Alohida faylda —
// komponent fayllaridan boshqa narsa eksport qilinsa Vite fast-refresh
// ogohlantiradi (utils/dialogState.js bilan bir xil sabab).

// Server `/uploads/news/...` kabi nisbiy yo'l qaytaradi — logo/avatar kabi
// boshqa joylardagi naqsh bilan API manziliga ulanadi.
export const mediaUrl = (url) => {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : `${API}${url}`;
};

export const youtubeIdOf = (media) => media?.youtubeId || extractYouTubeId(media?.url) || null;

export const youtubeThumb = (id) => (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");

export const youtubeEmbed = (id) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

// Ro'yxat kartasidagi kichik muqova: rasm → o'zi, YouTube → thumbnail,
// yuklangan video → rasm yo'q (ikonka ko'rsatiladi).
export const coverOf = (news) => {
  const first = news?.media?.[0];
  if (!first) return null;
  if (first.type === "image") return { type: "image", src: mediaUrl(first.url) };
  if (first.type === "youtube") return { type: "youtube", src: youtubeThumb(youtubeIdOf(first)) };
  return { type: "video", src: "" };
};

// Server vaqtlari unix SONIYA (`getNow()`, date.util.js). Ehtiyot uchun ms
// kelsa ham to'g'ri o'qiladi.
const toMs = (ts) => {
  const n = Number(ts);
  if (!n) return null;
  return n < 1e12 ? n * 1000 : n;
};

// "28 sentabr 2026, 10:13" — Toshkent vaqti. Oy nomi i18n'dan
// (`common.monthsGenitive`): Chrome'da `uz` Intl ma'lumoti to'liq emas va
// `month: "long"` "M09" qaytaradi.
export const formatNewsDate = (ts) => {
  const ms = toMs(ts);
  if (!ms) return "";
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tashkent",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(ms)
        .map((p) => [p.type, p.value]),
    );
    const months = i18n.t("common.monthsGenitive", { returnObjects: true });
    const month = Array.isArray(months) ? months[Number(parts.month) - 1] : parts.month;
    return `${parts.day} ${month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  } catch {
    return new Date(ms).toLocaleString(dateLocale());
  }
};

// Ro'yxatdagi qisqa matn uchun HTML'dan toza matn. Blok teglar orasiga
// bo'shliq qo'yiladi, aks holda "<p>a</p><p>b</p>" → "ab" bo'lib qolardi.
export const stripHtml = (html) => {
  if (!html) return "";
  const spaced = String(html).replace(/<\/(p|h[1-6]|li|blockquote|div)>|<br\s*\/?>/gi, " ");
  const text = new DOMParser().parseFromString(spaced, "text/html").body.textContent || "";
  return text.replace(/\s+/g, " ").trim();
};

// `news:new`/`news:updated` butun namespace'ga yuboriladi — kimga
// tegishliligini frontend o'zi tekshiradi (§4).
export const audienceMatches = (audience, authType) => {
  if (!audience || audience === "all") return true;
  if (audience === "owners") return authType === "owner";
  if (audience === "staff") return authType === "staff";
  return false;
};

export const isCritical = (news) => news?.level === "critical";
