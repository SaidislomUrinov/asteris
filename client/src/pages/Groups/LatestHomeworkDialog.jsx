import { useTranslation } from "react-i18next";
import { HiCalendarDays, HiChartPie, HiClipboardDocumentList, HiUser } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { RESULT_OPTIONS, formatHomeworkDate } from "./homeworkResults";

const pad = (n) => String(n).padStart(2, "0");
// updatedAt soniyada keladi (getNow) — "15.10 14:32"
const formatStamp = (ts) => {
  if (!ts) return "";
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// TodayLessonDialog'dagi qator bilan bir xil ko'rinish.
function Row({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="grid place-items-center size-8 shrink-0 rounded-lg bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <div className="text-sm text-slate-800 dark:text-slate-100 break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * "Oxirgi vazifa" — to'liq matn, kim yozgani va natijalar xulosasi.
 * LatestHomeworkCard'dagi "Batafsil" tugmasidan ochiladi.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.item - /homework/:groupId/latest DTO
 * @param {Object} props.counts - { done, partial, missed, unmarked }
 * @param {() => void} props.onOpenTab - "Uyga vazifa" tabiga o'tish
 */
function LatestHomeworkDialog({ open, onClose, item, counts, onOpenTab }) {
  const { t } = useTranslation();
  const stamp = [item?.updatedBy?.name, formatStamp(item?.updatedAt)].filter(Boolean).join(" · ");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("homework.latest")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button
            color="blue"
            onClick={() => {
              onClose();
              onOpenTab();
            }}
          >
            {t("homework.openTab")}
          </Button>
        </>
      }
    >
      {item && (
        <div className="flex flex-col gap-4 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Row icon={<HiCalendarDays />} label={t("group.lessonDate")}>
              {formatHomeworkDate(t, item.date)}
            </Row>
            {stamp && (
              <Row icon={<HiUser />} label={t("homework.author")}>
                <span className="tabular-nums">{stamp}</span>
              </Row>
            )}
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3">
            <Row icon={<HiClipboardDocumentList />} label={t("homework.tab")}>
              <p className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-100">
                {item.text}
              </p>
            </Row>
          </div>

          <Row icon={<HiChartPie />} label={t("homework.results.title")}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {RESULT_OPTIONS.map((o) => (
                <div
                  key={o.key}
                  className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-night-800/60"
                >
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${o.text}`}>
                    <o.icon className="text-sm shrink-0" />
                    <span className="truncate">{t(`homework.results.${o.key}`)}</span>
                  </span>
                  <span
                    className={`text-lg font-space font-bold tabular-nums leading-none ${
                      counts[o.key] ? o.text : "text-slate-300 dark:text-night-600"
                    }`}
                  >
                    {counts[o.key]}
                  </span>
                </div>
              ))}
              <div className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-night-800/60">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  <span className="size-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-night-600" />
                  <span className="truncate">{t("homework.results.unmarked")}</span>
                </span>
                <span className="text-lg font-space font-bold tabular-nums leading-none text-slate-400 dark:text-slate-500">
                  {counts.unmarked}
                </span>
              </div>
            </div>
          </Row>
        </div>
      )}
    </Dialog>
  );
}

export default LatestHomeworkDialog;
