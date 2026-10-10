import { useTranslation } from "react-i18next";
import { HiPlay } from "react-icons/hi2";
import Button from "../../ui/Button";
import { extractYouTubeId } from "../../utils/youtube";

// Bitta video kartasi: YouTube muqovasi, "#N Sarlavha", bo'lim nomi, "Ko'rish".
function VideoLessonCard({ number, title, sectionLabel, youtubeUrl, onWatch }) {
  const { t } = useTranslation();
  const videoId = extractYouTubeId(youtubeUrl);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none hover:border-slate-300 dark:hover:border-night-600 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200">
      <button
        type="button"
        onClick={onWatch}
        aria-label={`${t("videoLessons.watch")}: ${title}`}
        className="group relative block w-full aspect-video bg-slate-900 cursor-pointer overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      >
        {videoId && (
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-slate-900/40 via-transparent to-transparent group-hover:bg-slate-900/20 transition-colors">
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/95 text-blue-600 text-xl shadow-lg group-hover:scale-110 transition-transform duration-200">
            <HiPlay aria-hidden="true" />
          </span>
        </span>
      </button>
      <div className="flex flex-col flex-1 gap-3 p-4 border-t border-slate-100 dark:border-night-800">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            <span className="inline-flex items-center px-1.5 mr-1 rounded-md bg-blue-50 dark:bg-blue-500/15 text-[13px] text-blue-600 dark:text-blue-400 tabular-nums">#{number}</span>
            {title}
          </p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate">{sectionLabel}</p>
        </div>
        <div className="mt-auto">
          <Button onClick={onWatch}>
            <HiPlay />
            {t("videoLessons.watch")}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default VideoLessonCard;
