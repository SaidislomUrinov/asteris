import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiPlay,
  HiXMark,
  HiChevronLeft,
  HiChevronRight,
  HiArrowTopRightOnSquare,
  HiArrowRight,
  HiPhoto,
} from "react-icons/hi2";
import {
  LEVEL_TONES,
  NEWS_HTML_CLASS,
  resolveMediaUrl,
  youtubeThumb,
  formatDateTime,
} from "./newsMeta";

function PreviewMedia({ item }) {
  if (item.type === "youtube") {
    return (
      <div className="relative w-full h-full">
        <img src={youtubeThumb(item.youtubeId)} alt="" className="w-full h-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="flex items-center justify-center w-14 h-10 rounded-xl bg-red-600 text-white shadow-lg">
            <HiPlay size={22} />
          </span>
        </span>
      </div>
    );
  }
  const src = item.previewUrl || resolveMediaUrl(item.url);
  if (item.type === "video") {
    return <video src={src} controls preload="metadata" className="w-full h-full object-contain bg-black" />;
  }
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}

// Client ilovasidagi NewsPopup'ning taxminiy nusxasi (§5/§6): media 16:9,
// daraja chip + sana, sarlavha, tavsif, resurslar, pastda "1 / N" footer.
export default function NewsPreview({ form }) {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);
  const media = form.media;
  const current = Math.min(slide, Math.max(media.length - 1, 0));
  const tone = LEVEL_TONES[form.level] || LEVEL_TONES.important;
  const isCritical = form.level === "critical";
  const resources = form.resources.filter((r) => r.label.trim());

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 overflow-hidden">
      {isCritical && <div className={`h-1 w-full ${tone.bar}`} />}

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">
          {t("news.preview.popupTitle")}
        </span>
        <span className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400">
          <HiXMark size={18} />
        </span>
      </div>

      {media.length > 0 ? (
        <div className="relative w-full aspect-video bg-slate-100">
          <PreviewMedia key={media[current]._key} item={media[current]} />
          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setSlide(Math.max(current - 1, 0))}
                disabled={current === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-slate-700 shadow disabled:opacity-0 cursor-pointer"
              >
                <HiChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => setSlide(Math.min(current + 1, media.length - 1))}
                disabled={current === media.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-slate-700 shadow disabled:opacity-0 cursor-pointer"
              >
                <HiChevronRight />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40">
                {media.map((m, i) => (
                  <span
                    key={m._key}
                    className={`h-1.5 rounded-full ${i === current ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center w-full aspect-[16/5] bg-slate-50 text-slate-300">
          <HiPhoto size={32} />
        </div>
      )}

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold uppercase ${tone.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            {t(`news.level.${form.level}`)}
          </span>
          <span className="text-[12px] text-slate-400">
            {form.publishedAt ? formatDateTime(form.publishedAt) : t("news.preview.now")}
          </span>
        </div>

        <h2 className={`text-[20px] font-bold leading-snug break-words ${form.title.trim() ? "text-slate-900" : "text-slate-300"}`}>
          {form.title.trim() || t("news.preview.untitled")}
        </h2>

        {form.description ? (
          <div
            className={`${NEWS_HTML_CLASS} max-h-72 overflow-y-auto text-[14px] text-slate-700 leading-relaxed break-words`}
            dangerouslySetInnerHTML={{ __html: form.description }}
          />
        ) : (
          <p className="text-[14px] text-slate-300">{t("news.preview.noDescription")}</p>
        )}

        {resources.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">
              {t("news.preview.resources")}
            </span>
            <div className="flex flex-wrap gap-2">
              {resources.map((r) => (
                <span
                  key={r._key}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-100 text-slate-700 text-[13px] font-medium"
                >
                  {r.label}
                  {r.kind === "external" ? (
                    <HiArrowTopRightOnSquare className="text-slate-400" />
                  ) : (
                    <HiArrowRight className="text-slate-400" />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-4 h-1.5 rounded-full bg-slate-800" />
          <span className="text-[12px] text-slate-500 tabular-nums">1 / 1</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase">
          <span className="px-3 h-8 inline-flex items-center rounded-lg text-slate-300">
            {t("news.preview.prev")}
          </span>
          <span className="px-3 h-8 inline-flex items-center rounded-lg bg-slate-800 text-white">
            {t("news.preview.next")}
          </span>
        </div>
      </div>
    </div>
  );
}
