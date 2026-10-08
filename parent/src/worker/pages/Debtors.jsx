import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiMagnifyingGlass, HiOutlineCheckCircle } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { money } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { useGroupNames } from "../useGroupNames";
import { workerApi } from "../api";
import { asErr } from "../utils";
import { ListRow } from "../components/ListRow";

const debtOf = (s) =>
  (s.groups || [])
    .filter((g) => (g.status === "active" || g.status === "left") && (g.debt || 0) > 0)
    .reduce((sum, g) => sum + g.debt, 0);

// Resepshn — Qarzdorlar: GET /students?debtStatus=debtor (ReceptionHome bilan
// bir xil manba). Bosilganda o'quvchi detali (details §1) — to'lov o'sha yerda.
export const Debtors = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { centerId } = useWorker();
  const [q, setQ] = useState("");
  const load = useCallback(() => workerApi.debtors(centerId), [centerId]);
  const { data, loading, error, reload } = useLive(load, [load]);

  const rows = useMemo(() => {
    const list = (data?.data || data || []).map((s) => ({ s, debt: debtOf(s) }));
    const needle = q.trim().toLowerCase();
    return list
      .filter(({ s }) => !needle || `${s.fullName} ${s.phone}`.toLowerCase().includes(needle))
      .sort((a, b) => b.debt - a.debt);
  }, [data, q]);
  const total = rows.reduce((sum, r) => sum + r.debt, 0);
  const nameOf = useGroupNames(rows.flatMap(({ s }) => (s.groups || []).filter((g) => (g.debt || 0) > 0).map((g) => g.group)));

  return (
    <WorkerPage title={t("worker.debtors.title")} subtitle={!loading && !error ? t("worker.debtors.summary", { count: rows.length, amount: money(total) }) : null}>
      <label className="flex items-center gap-2 rounded-2xl bg-card border border-line px-3.5 h-11 focus-within:border-accent">
        <HiMagnifyingGlass className="w-5 h-5 text-hint shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("worker.debtors.searchPh")}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-hint/70"
        />
      </label>
      {loading ? (
        <ListSkeleton count={6} />
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={HiOutlineCheckCircle} title={t("worker.debtors.empty")} text={q ? null : t("worker.debtors.emptyText")} />
      ) : (
        <Card className="py-1 divide-y divide-line/70">
          {rows.map(({ s, debt }) => (
            <ListRow
              key={s._id}
              title={s.fullName}
              sub={[
                s.phone,
                ...(s.groups || []).filter((g) => (g.debt || 0) > 0).map((g) => nameOf(g.group)),
              ].join(" · ")}
              right={money(debt)}
              rightTone="bad"
              onClick={() => navigate(`/students/${s._id}`)}
            />
          ))}
        </Card>
      )}
    </WorkerPage>
  );
};
