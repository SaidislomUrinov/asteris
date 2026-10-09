import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineBookOpen,
  HiOutlineSun,
  HiCheck,
  HiChevronDown,
} from "react-icons/hi2";
import { Card, Pill, SectionLabel } from "../../components/Card";
import { ListSkeleton, Skeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { fmtDate, weekdayKey } from "../../utils/format";
import { cn } from "../../utils/cn";

// Dars rejasi — o'quvchi va ota-ona uchun bir xil. Sana→mavzu moslashuvi
// serverda (o'qituvchi panelidagi bilan aynan bir xil), shu sabab dam olish
// kuni bo'lsa mavzu keyingi darsga surilgani ro'yxatda o'z-o'zidan ko'rinadi.
// state: useRequest natijasi (Group sahifasi bir marta so'raydi — tab
// ko'rinishi ham shu javobga bog'liq).

// "YYYY-MM-DD" → "dd.mm" (sana ustuni uchun ixcham, tilga bog'liq emas).
const ddmm = (ymd) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;

const LessonMeta = ({ lesson }) => {
  const { t } = useTranslation();
  return (
    <div className="text-[11px] font-bold text-hint tabular">
      {t("plan.lessonNo", { no: lesson.no })}
      {lesson.moduleTitle ? ` · ${lesson.moduleTitle}` : ""}
    </div>
  );
};

const DateCol = ({ date, muted }) => {
  const { t } = useTranslation();
  return (
    <div className={cn("w-12 shrink-0 text-center tabular", muted && "opacity-70")}>
      <div className="text-[11px] font-bold uppercase text-hint">{t(`days.${weekdayKey(date)}`)}</div>
      <div className="text-[13px] font-extrabold">{ddmm(date)}</div>
    </div>
  );
};

const TodayCard = ({ item }) => {
  const { t } = useTranslation();
  if (item.type === "holiday") {
    return (
      <Card className="border-l-4 border-l-warn bg-warn-bg/40">
        <div className="flex items-center gap-2">
          <HiOutlineSun className="w-5 h-5 text-warn shrink-0" />
          <div className="font-bold flex-1 min-w-0">{t("plan.todayHoliday")}</div>
          <Pill tone="warn">{t("plan.today")}</Pill>
        </div>
        {item.note ? <div className="text-sm mt-1 break-words">{item.note}</div> : null}
        <div className="text-xs text-hint mt-1.5">{t("plan.shiftHint")}</div>
      </Card>
    );
  }
  return (
    <Card className="border-l-4 border-l-accent bg-accent/5">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-accent flex-1">
          {t("plan.todayLesson")}
        </div>
        <Pill tone="acc">{fmtDate(item.date)}</Pill>
      </div>
      {item.lesson ? (
        <>
          <div className="font-title text-[17px] font-bold mt-1 break-words">{item.lesson.title}</div>
          <LessonMeta lesson={item.lesson} />
          {item.lesson.description ? (
            <div className="text-sm text-ink/80 mt-1.5 whitespace-pre-wrap break-words">{item.lesson.description}</div>
          ) : null}
        </>
      ) : (
        <div className="text-sm text-hint mt-1">{t("plan.noTopic")}</div>
      )}
    </Card>
  );
};

const UpcomingRow = ({ item }) => {
  const { t } = useTranslation();
  if (item.type === "holiday") {
    return (
      <div className="flex items-center gap-3 py-2.5 px-1">
        <DateCol date={item.date} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-warn font-bold text-sm">
            <HiOutlineSun className="w-4 h-4 shrink-0" />
            {t("plan.holiday")}
          </div>
          <div className="text-xs text-hint break-words">{item.note || t("plan.shiftHint")}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <DateCol date={item.date} />
      <div className="flex-1 min-w-0">
        {item.lesson ? (
          <>
            <div className="text-sm font-bold break-words">{item.lesson.title}</div>
            <LessonMeta lesson={item.lesson} />
          </>
        ) : (
          <div className="text-sm text-hint">{t("plan.noTopic")}</div>
        )}
      </div>
    </div>
  );
};

const ModuleBlock = ({ module, defaultOpen }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const done = module.lessons.filter((l) => l.state === "done").length;
  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="font-title font-bold text-sm break-words">{module.title}</div>
          <div className="text-[11px] text-hint tabular">
            {t("plan.moduleProgress", { done, total: module.lessons.length })}
          </div>
        </div>
        <HiChevronDown className={cn("w-4 h-4 text-hint shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-line/70">
          {module.lessons.map((l) => (
            <div
              key={l.no}
              className={cn(
                "flex items-center gap-2.5 px-3.5 py-2 text-sm",
                l.state === "current" && "bg-accent/5",
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-lg grid place-items-center text-[11px] font-extrabold shrink-0 tabular",
                  l.state === "done" && "bg-ok-bg text-ok",
                  l.state === "current" && "bg-accent text-accent-fg",
                  l.state === "upcoming" && "bg-ink/6 text-hint",
                )}
              >
                {l.state === "done" ? <HiCheck className="w-3.5 h-3.5" /> : l.no}
              </span>
              <span className={cn("flex-1 min-w-0 break-words", l.state === "done" && "text-hint")}>{l.title}</span>
              {l.state === "current" && <Pill tone="acc">{t("plan.current")}</Pill>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const LessonPlanTab = ({ state }) => {
  const { t } = useTranslation();
  const { data, loading, error, reload } = state;

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <>
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <ListSkeleton count={3} />
      </>
    );
  if (!data?.hasPlan)
    return <EmptyState icon={HiOutlineBookOpen} title={t("plan.empty")} text={t("plan.emptyText")} />;

  const { progress, todayItem, upcoming = [], past = [], modules = [] } = data;
  const pct = progress.totalLessons ? Math.round((progress.doneCount / progress.totalLessons) * 100) : 0;

  return (
    <div className={cn("space-y-3", loading && "opacity-60")}>
      <Card>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 font-bold text-sm">
            {progress.finished
              ? t("plan.finished")
              : t("plan.progress", {
                  module: Math.min(progress.currentModuleIndex + 1, progress.moduleCount),
                  moduleCount: progress.moduleCount,
                  no: progress.nextNo,
                })}
          </div>
          <div className="text-xs font-bold text-hint tabular">
            {progress.doneCount}/{progress.totalLessons}
          </div>
        </div>
        <div className="h-2 rounded-full bg-ink/6 mt-2 overflow-hidden">
          <div
            className={cn("h-full rounded-full", progress.finished ? "bg-ok" : "bg-accent")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {todayItem && <TodayCard item={todayItem} />}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t("plan.upcoming")}</SectionLabel>
          <Card className="py-1 divide-y divide-line/70">
            {upcoming.map((it) => (
              <UpcomingRow key={it.date} item={it} />
            ))}
          </Card>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t("plan.past")}</SectionLabel>
          <Card className="py-1 divide-y divide-line/70">
            {past.map((it) => (
              <div key={it.date} className="flex items-center gap-3 py-2.5 px-1">
                <DateCol date={it.date} muted />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink/70 break-words">{it.lesson.title}</div>
                  <LessonMeta lesson={it.lesson} />
                </div>
                <HiCheck className="w-4 h-4 text-ok shrink-0" />
              </div>
            ))}
          </Card>
        </div>
      )}

      {modules.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t("plan.program")}</SectionLabel>
          {modules.map((m, i) => (
            <ModuleBlock key={`${i}-${m.title}`} module={m} defaultOpen={i === progress.currentModuleIndex && !progress.finished} />
          ))}
        </div>
      )}
    </div>
  );
};
