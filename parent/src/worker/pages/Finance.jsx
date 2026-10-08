import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiOutlineBanknotes, HiChevronRight } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, SectionLabel } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { KpiSkeleton } from "../components/WorkerSkeleton";
import { fmtMonth, money } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr, compactMoney } from "../utils";
import { CenterChips } from "../components/CenterChips";
import { StatGrid } from "../components/StatGrid";
import { ListRow } from "../components/ListRow";

// Boshliq — Moliya: GET /dashboard?center= (joriy oy tushum/xarajat/qarzdorlik
// + oxirgi to'lovlar).
export const Finance = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { centerId } = useWorker();
  const load = useCallback(() => workerApi.dashboard(centerId), [centerId]);
  const { data, loading, error, reload } = useLive(load, [load]);

  return (
    <WorkerPage title={t("worker.finance.title")} subtitle={data?.month ? fmtMonth(data.month) : null}>
      <CenterChips />
      {loading ? (
        <>
          <KpiSkeleton cols={2} count={4} />
          <ListSkeleton count={4} />
        </>
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : (
        <>
          <StatGrid
            items={[
              { key: "rev", label: t("worker.finance.revenue"), value: compactMoney(data?.monthRevenue), tone: "ok" },
              { key: "exp", label: t("worker.finance.expenses"), value: compactMoney(data?.monthExpenses) },
              { key: "debt", label: t("worker.finance.debt"), value: compactMoney(data?.totalDebt), tone: data?.totalDebt > 0 ? "bad" : undefined },
              { key: "net", label: t("worker.finance.net"), value: compactMoney((data?.monthRevenue || 0) - (data?.monthExpenses || 0)) },
              { key: "st", label: t("worker.finance.students"), value: money(data?.activeStudents) },
              { key: "gr", label: t("worker.finance.groups"), value: money(data?.activeGroups) },
            ]}
          />
          <Card as="button" onClick={() => navigate("/report")} className="flex items-center justify-between gap-3">
            <span className="font-bold">{t("worker.finance.openReport")}</span>
            <HiChevronRight className="w-5 h-5 text-hint" />
          </Card>
          <SectionLabel>{t("worker.finance.recent")}</SectionLabel>
          {(data?.recentPayments || []).length === 0 ? (
            <EmptyState icon={HiOutlineBanknotes} title={t("worker.finance.noPayments")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {data.recentPayments.map((p, i) => (
                <ListRow
                  key={`${p.student?._id}-${i}`}
                  title={p.student?.fullName || "—"}
                  sub={[String(p.date || "").replace(" | ", " · "), t(`worker.payType.${p.type}`, { defaultValue: p.type })]
                    .filter(Boolean)
                    .join(" · ")}
                  right={`+${money(p.amount)}`}
                  rightTone="ok"
                />
              ))}
            </Card>
          )}
        </>
      )}
    </WorkerPage>
  );
};
