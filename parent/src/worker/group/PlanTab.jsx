import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineQueueList } from "react-icons/hi2";
import { Card, Pill, SectionLabel } from "../../components/Card";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr } from "../utils";
import { PlanLesson } from "./PlanLesson";

// "Reja" tabi (details §2, `lesson:view` + tarif `lesson.planning`) — faqat
// o'qish: GET /syllabus/:groupId → modullar → darslar. O'tilgan darslar
// soni (`progress.doneCount`) davomatdan, joriy — `progress.nextNo`.
export const PlanTab = ({ group }) => {
  const { t } = useTranslation();
  const gid = String(group._id);
  const load = useCallback(() => workerApi.syllabus(group._id), [group._id]);
  const { data, loading, error, reload } = useScopedLive(load, [load], {
    events: ["syllabus:changed", "attendance:marked"],
    match: (_ev, p) => p?.groupId === gid,
  });

  if (loading && !data) return <RowsSkeleton count={4} />;
  if (error && !data) return <ErrorState error={asErr(error)} onRetry={reload} />;
  const modules = data?.modules || [];
  const p = data?.progress || {};
  if (!modules.some((m) => m.lessons?.length)) {
    return <EmptyState icon={HiOutlineQueueList} title={t("worker.group.plan.empty")} text={t("worker.group.plan.emptyText")} />;
  }

  // Har modulning birinchi darsi global raqami (darslar butun dastur bo'ylab 1..N).
  // Dastur tugagach ham davomat davom etadi (doneCount > totalLessons bo'lishi
  // mumkin) — client SyllabusTab'dagidek jamidan oshirilmaydi.
  const done = Math.min(p.doneCount || 0, p.totalLessons || 0);
  const starts = modules.reduce((acc, m, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (modules[i - 1].lessons?.length || 0)], []);
  return (
    <>
      <Card className="flex flex-col gap-2 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold">
            {t("worker.group.plan.progress", { done, total: p.totalLessons || 0 })}
          </span>
          {p.finished && <Pill tone="ok">{t("worker.group.plan.finished")}</Pill>}
        </div>
        <div className="h-2 rounded-full bg-ink/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-ok"
            style={{ width: `${p.totalLessons ? Math.round((done / p.totalLessons) * 100) : 0}%` }}
          />
        </div>
      </Card>
      {modules.map((m, mi) => (
        <div key={m._id} className="flex flex-col gap-1.5">
          <SectionLabel>{t("worker.group.plan.module", { n: mi + 1, title: m.title })}</SectionLabel>
          <Card className="py-1 px-3.5 divide-y divide-line/70">
            {(m.lessons || []).map((l, li) => {
              const no = starts[mi] + li + 1;
              return (
                <PlanLesson key={l._id} no={no} lesson={l} done={no <= (p.doneCount || 0)} current={no === p.nextNo} />
              );
            })}
            {!m.lessons?.length && <div className="py-2 text-[13px] text-hint">{t("worker.group.plan.noLessons")}</div>}
          </Card>
        </div>
      ))}
    </>
  );
};
