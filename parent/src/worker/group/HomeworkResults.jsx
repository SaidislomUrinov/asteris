import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineLockClosed } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { haptic } from "../../lib/telegram";
import { workerApi } from "../api";
import { asErr, errText } from "../utils";
import { cn } from "../../utils/cn";
import { HomeworkResultRow } from "./HomeworkResultRow";
import { RESULT_OPTIONS, completionPercent } from "./homeworkResults";

// "Qabul qilish" — tanlangan kundagi vazifa natijalari
// (API_CONTRACT_worker_homework_results.md). Optimistik: tugma darhol
// yonadi, xato bo'lsa qaytadi. Server javobi `onSaved(date, results)` bilan
// tab ma'lumotiga yoziladi (socket ham shu yo'l bilan keladi).
export const HomeworkResults = ({ group, date, results, students, studentsState, writable, onSaved }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState({}); // "date|sid" → status | null
  const [saving, setSaving] = useState({});
  const [bulk, setBulk] = useState(false);

  const k = (sid) => `${date}|${sid}`;
  const statusOf = (sid) => (k(sid) in local ? local[k(sid)] : results?.[sid] || null);

  const send = async (ids, status) => {
    const keys = ids.map(k);
    const prev = Object.fromEntries(keys.filter((x) => x in local).map((x) => [x, local[x]]));
    setLocal((m) => ({ ...m, ...Object.fromEntries(keys.map((x) => [x, status])) }));
    try {
      const data = await workerApi.setHomeworkResults(
        group._id,
        date,
        ids.map((student) => ({ student, status })),
      );
      onSaved(date, data?.results || {});
      haptic(ids.length > 1 ? "success" : "light");
      if (ids.length > 1) toast.success(t("worker.homework.result.allSaved"));
    } catch (e) {
      haptic("error");
      toast.error(errText(e));
    } finally {
      // Server javobi (yoki xato) — local qatlam olib tashlanadi, manba `results`.
      setLocal((m) => {
        const next = { ...m };
        keys.forEach((x) => delete next[x]);
        return { ...next, ...prev };
      });
    }
  };

  const markOne = async (sid, status) => {
    setSaving((m) => ({ ...m, [sid]: true }));
    await send([sid], status);
    setSaving((m) => ({ ...m, [sid]: false }));
  };

  const unmarked = students.filter((s) => !statusOf(s._id));
  const markRest = async () => {
    setBulk(true);
    await send(unmarked.map((s) => s._id), "done");
    setBulk(false);
  };

  const counts = { done: 0, partial: 0, missed: 0 };
  students.forEach((s) => {
    const st = statusOf(s._id);
    if (st) counts[st] += 1;
  });
  const marked = students.length - unmarked.length;

  let body;
  if (!studentsState.allowed)
    body = <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noStudentAccess")} text={t("worker.group.noStudentAccessText")} />;
  else if (studentsState.pending) body = <RowsSkeleton count={4} />;
  else if (studentsState.error) body = <ErrorState error={asErr(studentsState.error)} onRetry={studentsState.reload} />;
  else if (!students.length) body = <EmptyState title={t("worker.att.noStudents")} />;
  else {
    const total = students.length;
    const pct = completionPercent(counts, total);
    body = (
      <Card className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <div className="text-[13px] font-extrabold">{t("worker.homework.result.title")}</div>
          <div className="tabular leading-none">
            <span className="text-[22px] font-extrabold text-ink">{marked > 0 ? pct : "–"}</span>
            {marked > 0 && <span className="text-[13px] font-bold text-hint">%</span>}
          </div>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink/8" role="img" aria-label={`${pct}%`}>
          {RESULT_OPTIONS.map((o) =>
            counts[o.key] > 0 ? (
              <div key={o.key} className={o.bar} style={{ width: `${(counts[o.key] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {RESULT_OPTIONS.map((o) =>
            counts[o.key] > 0 ? (
              <span key={o.key} className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full tabular", o.pill)}>
                {t(`worker.homework.result.count.${o.key}`, { count: counts[o.key] })}
              </span>
            ) : null,
          )}
          {unmarked.length > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink/6 text-hint tabular">
              {t("worker.homework.result.count.unmarked", { count: unmarked.length })}
            </span>
          )}
        </div>
        <div className="divide-y divide-line/70 border-t border-line/70">
          {students.map((s, i) => (
            <HomeworkResultRow
              key={s._id}
              name={s.fullName}
              photo={s.photo}
              tone={i}
              status={statusOf(s._id)}
              saving={!!saving[s._id] || bulk}
              disabled={!writable}
              onMark={(st) => markOne(s._id, st)}
            />
          ))}
        </div>
        {writable && unmarked.length > 0 && (
          <Button onClick={markRest} loading={bulk}>
            {t("worker.homework.result.markRest", { count: unmarked.length })}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <>
      {!studentsState.allowed || studentsState.pending || studentsState.error || !students.length ? (
        <SectionLabel>{t("worker.homework.result.title")}</SectionLabel>
      ) : null}
      {body}
    </>
  );
};
