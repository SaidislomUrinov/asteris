import { HiMegaphone, HiPlay, HiVideoCamera } from "react-icons/hi2";
import LazyImage from "../../ui/LazyImage";
import NewsLevelChip from "../../components/news/NewsLevelChip";
import { coverOf, formatNewsDate, stripHtml } from "../../components/news/newsUtils";

/**
 * "Yangiliklar" tabidagi bitta qator: kichik muqova + sarlavha + qisqa matn
 * + daraja + sana + o'qilmagan nuqtasi. NotificationItem bilan bir xil ritm.
 */
function NewsItem({ item, onOpen }) {
  const cover = coverOf(item);
  const excerpt = stripHtml(item.description);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={item.title}
      className={`flex items-start gap-3 py-3 text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-night-800 focus-visible:bg-slate-50 dark:focus-visible:bg-night-800 focus-visible:outline-none -mx-2 px-2 rounded-lg ${
        item.read ? "" : "bg-blue-50/40 dark:bg-blue-500/15"
      }`}
    >
      <span className="relative shrink-0 w-20 sm:w-28 aspect-video overflow-hidden rounded-lg bg-slate-100 dark:bg-night-800 ring-1 ring-slate-200/60 dark:ring-night-700/60">
        {cover?.src ? (
          <LazyImage src={cover.src} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600 text-2xl">
            {cover?.type === "video" ? <HiVideoCamera /> : <HiMegaphone />}
          </span>
        )}
        {cover && cover.type !== "image" && cover.src && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center size-7 rounded-full bg-black/55 text-white">
              <HiPlay className="text-sm translate-x-px" />
            </span>
          </span>
        )}
      </span>

      <span className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm truncate ${item.read ? "font-medium text-slate-700 dark:text-slate-300" : "font-semibold text-slate-900 dark:text-slate-100"}`}>
            {item.title}
          </span>
          {!item.read && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-blue-500" />}
        </span>
        {excerpt && <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words">{excerpt}</span>}
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          <NewsLevelChip level={item.level} size="sm" />
          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{formatNewsDate(item.publishedAt)}</span>
        </span>
      </span>
    </button>
  );
}

export default NewsItem;
