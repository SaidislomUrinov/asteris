import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SectionLabel } from "../../components/Card";
import { CardsSkeleton } from "../components/WorkerSkeleton";
import { ErrorState } from "../../components/States";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr } from "../utils";
import { SummaryCard } from "./SummaryCard";

const count = (list) => {
  const c = { present: 0, absent: 0, excused: 0, late: 0 };
  (list || []).forEach((r) => {
    if (c[r.status] !== undefined) c[r.status] += 1;
    if (r.late && r.status === "present") c.late += 1;
  });
  return c;
};

// Davomat va baho xulosasi (details §3): har guruh uchun
// GET /attendance/:groupId/student/:studentId va (tarif `student.rate`)
// GET /grades/summary/:studentId. `groups` — [{ id, name }].
export const StudySummary = ({ studentId, groups }) => {
  const { t } = useTranslation();
  const { hasFeature } = useWorker();
  const withGrades = hasFeature("student.rate");
  const key = groups.map((g) => g.id).join(",");

  const load = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    const [att, grades] = await Promise.all([
      Promise.allSettled(ids.map((gid) => workerApi.studentAttendance(gid, studentId))),
      withGrades ? workerApi.gradeSummary(studentId).catch(() => []) : Promise.resolve([]),
    ]);
    const out = {};
    ids.forEach((gid, i) => {
      out[gid] = {
        att: att[i].status === "fulfilled" ? count(att[i].value) : null,
        grade: (grades || []).find((x) => String(x.group) === gid) || null,
      };
    });
    return out;
  }, [key, studentId, withGrades]);

  const { data, loading, error, reload } = useScopedLive(load, [load], {
    enabled: !!key,
    events: ["attendance:marked", "grade:set", "grade:removed"],
    match: (_ev, p) => p?.studentId === studentId,
  });

  if (!groups.length) return null;
  return (
    <>
      <SectionLabel>{t("worker.student.summary")}</SectionLabel>
      {loading && !data ? (
        <CardsSkeleton count={Math.min(groups.length, 2)} />
      ) : error && !data ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : (
        groups.map((g) => <SummaryCard key={g.id} name={g.name} att={data?.[g.id]?.att} grade={data?.[g.id]?.grade} />)
      )}
    </>
  );
};
