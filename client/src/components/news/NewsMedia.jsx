import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import LazyImage from "../../ui/LazyImage";
import YouTubeSlide from "./YouTubeSlide";
import { mediaUrl, youtubeIdOf } from "./newsUtils";

/**
 * Yangilik media karuseli (16:9). Faqat joriy slayd render qilinadi —
 * boshqa slaydga o'tilganda video/iframe unmount bo'lib o'z-o'zidan to'xtaydi.
 * Yangilik almashganda ota komponent `key` orqali qayta mount qiladi.
 */
function NewsMedia({ media = [], title }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const items = media.filter((m) => m?.url || m?.youtubeId);
  if (!items.length) return null;

  const i = Math.min(index, items.length - 1);
  const current = items[i];
  const multiple = items.length > 1;

  let slide = null;
  if (current.type === "image") {
    slide = (
      <LazyImage
        src={mediaUrl(current.url)}
        alt={title || ""}
        className="absolute inset-0 w-full h-full object-contain"
      />
    );
  } else if (current.type === "video") {
    slide = (
      <video
        src={mediaUrl(current.url)}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full bg-black object-contain"
      />
    );
  } else {
    const id = youtubeIdOf(current);
    slide = id ? <YouTubeSlide id={id} title={title} /> : null;
  }

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/60">
      <div key={i} className="absolute inset-0">
        {slide}
      </div>

      {multiple && (
        <>
          <button
            type="button"
            onClick={() => setIndex((n) => (n - 1 + items.length) % items.length)}
            aria-label={t("news.prevMedia")}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-9 rounded-full bg-white/90 text-slate-700 shadow-md cursor-pointer hover:bg-white active:scale-95 transition"
          >
            <HiChevronLeft className="text-lg" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((n) => (n + 1) % items.length)}
            aria-label={t("news.nextMedia")}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-9 rounded-full bg-white/90 text-slate-700 shadow-md cursor-pointer hover:bg-white active:scale-95 transition"
          >
            <HiChevronRight className="text-lg" />
          </button>
          <span className="absolute top-2 right-2 px-2 h-6 inline-flex items-center rounded-full bg-black/55 text-white text-[11px] font-semibold tabular-nums">
            {i + 1} / {items.length}
          </span>
        </>
      )}
    </div>
  );
}

export default NewsMedia;
