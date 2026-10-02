import { Fragment } from "react";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { haptic, openLink, openTelegramLink } from "../lib/telegram";

// Matndagi http(s):// va www. bilan boshlanuvchi manzillar.
const URL_RE = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;
// Gap oxiridagi tinish belgilari havolaga kirmaydi: "...com/x)." → "...com/x" + ")."
const TRAILING_RE = /[.,;:!?)\]}»"'’]+$/;

const toHref = (raw) => (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
const isTelegram = (href) => /^https?:\/\/(t\.me|telegram\.me)\//i.test(href);

const splitUrls = (text) => {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const tail = url.match(TRAILING_RE)?.[0] || "";
    // Ichida "(" bo'lgan manzilning yopuvchi qavsini kesib tashlamaymiz (wikipedia/..._(x))
    const keepParen = tail.startsWith(")") && url.includes("(");
    const cut = keepParen ? tail.slice(1) : tail;
    if (cut) url = url.slice(0, -cut.length);
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ url });
    last = m.index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};

// Ko'rinadigan matn: protokol va "www." olib tashlanadi, uzun manzil oxiridan
// qisqartiriladi — to'liq manzil baribir bosilganda ochiladi.
const MAX_LABEL = 42;
const toLabel = (url) => {
  const s = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}…` : s;
};

const LINK_CLS =
  "font-semibold text-link underline decoration-link/40 decoration-[1.5px] underline-offset-[3px] [overflow-wrap:anywhere] cursor-pointer active:opacity-60 [-webkit-tap-highlight-color:transparent]";

// Belgi oxirgi harf bilan bitta nowrap bo'lakda — alohida qatorga tushib qolmaydi.
const Label = ({ url }) => {
  const label = toLabel(url);
  return (
    <>
      {label.slice(0, -1)}
      <span className="whitespace-nowrap">
        {label.slice(-1)}
        <HiArrowTopRightOnSquare aria-hidden className="inline-block w-[0.85em] h-[0.85em] ml-0.5 -mt-0.5 align-middle" />
      </span>
    </>
  );
};

// Matn ichidagi URL'larni bosiladigan havolaga aylantiradi. Telegram ichida
// openLink/openTelegramLink orqali ochiladi (WebApp yopilmaydi).
// `nested` — havola <button>/<a> ichida turganda: <a> o'rniga role="link" span
// (ichma-ich interaktiv element bo'lmasligi uchun), bosish kartaga o'tmaydi.
export const LinkifiedText = ({ text, nested = false, className }) => {
  if (!text) return null;
  const parts = splitUrls(String(text));

  const open = (e, href) => {
    e.preventDefault();
    e.stopPropagation();
    haptic("light");
    if (isTelegram(href)) openTelegramLink(href);
    else openLink(href);
  };

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (!p.url) return <Fragment key={i}>{p.text}</Fragment>;
        const href = toHref(p.url);
        if (nested) {
          return (
            <span
              key={i}
              role="link"
              tabIndex={0}
              className={LINK_CLS}
              onClick={(e) => open(e, href)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e, href)}
            >
              <Label url={p.url} />
            </span>
          );
        }
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLS} onClick={(e) => open(e, href)}>
            <Label url={p.url} />
          </a>
        );
      })}
    </span>
  );
};
