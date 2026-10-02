import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiArrowTopRightOnSquare, HiArrowRight, HiCalendarDays } from "react-icons/hi2";
import NewsLevelChip from "./NewsLevelChip";
import NewsMedia from "./NewsMedia";
import { formatNewsDate } from "./newsUtils";

// Tavsif serverda sanitize qilingan HTML (API_CONTRACT_news.md §2) — faqat
// tipografiya beriladi. `prose` plagini loyihada yo'q, shuning uchun
// ChatWidget'dagi kabi arbitrary variantlar.
const RICH_TEXT =
  "text-[15px] leading-relaxed text-slate-600 break-words " +
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700 " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 " +
  "[&_strong]:font-semibold [&_strong]:text-slate-800 [&_b]:font-semibold [&_b]:text-slate-800 " +
  "[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:text-[13px] [&_code]:text-slate-700";

/**
 * Bitta yangilik mazmuni — popup ham, Bildirishnomalar sahifasidagi tab ham
 * shuni ishlatadi. Sarlavha Dialog sarlavhasida (NewsDialog), bu yerda —
 * media, daraja + sana, tavsif va resurslar.
 *
 * @param {Function} [props.onInternalNavigate] - ichki resurs bosilganda
 *   (navigatsiyadan OLDIN) chaqiriladi — oynani yopish/o'qildi belgilash uchun.
 */
function NewsViewer({ news, onInternalNavigate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!news) return null;

  const resources = (news.resources || []).filter((r) => r?.url && r?.label);
  const hasText = !!news.description && news.description.replace(/<[^>]*>/g, "").trim().length > 0;

  const openInternal = (url) => {
    onInternalNavigate?.();
    navigate(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <NewsLevelChip level={news.level} />
        {news.publishedAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 tabular-nums">
            <HiCalendarDays className="text-sm" />
            {formatNewsDate(news.publishedAt)}
          </span>
        ) : null}
      </div>

      <NewsMedia key={news._id} media={news.media} title={news.title} />

      {hasText && (
        <div className={RICH_TEXT} dangerouslySetInnerHTML={{ __html: news.description }} />
      )}

      {resources.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t("news.resources")}
          </p>
          <div className="flex flex-wrap gap-2">
            {resources.map((r, i) =>
              r.kind === "internal" ? (
                <button
                  key={`${r.url}-${i}`}
                  type="button"
                  onClick={() => openInternal(r.url)}
                  className="inline-flex items-center gap-1.5 max-w-full h-9 px-3 rounded-xl bg-blue-50 text-blue-700 text-[13px] font-semibold cursor-pointer hover:bg-blue-100 active:scale-95 transition"
                >
                  <span className="truncate">{r.label}</span>
                  <HiArrowRight className="shrink-0" />
                </button>
              ) : (
                <a
                  key={`${r.url}-${i}`}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 max-w-full h-9 px-3 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-semibold hover:bg-slate-200 active:scale-95 transition"
                >
                  <span className="truncate">{r.label}</span>
                  <HiArrowTopRightOnSquare className="shrink-0" />
                </a>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NewsViewer;
