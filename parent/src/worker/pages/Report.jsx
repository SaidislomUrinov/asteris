import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, SectionLabel } from "../../components/Card";
import { SegmentTabs } from "../../components/SegmentTabs";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { KpiSkeleton } from "../components/WorkerSkeleton";
import { money } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr, compactMoney, tashkentDate, tashkentDateShift } from "../utils";
import { CenterChips } from "../components/CenterChips";
import { StatGrid } from "../components/StatGrid";
import { ListRow } from "../components/ListRow";

const PERIODS = ["today", "week", "month"];
const rangeOf = (p) => {
  const to = tashkentDate();
  if (p === "today") return { from: to, to };
  if (p === "week") return { from: tashkentDateShift(-6), to };
  return { from: `${to.slice(0, 7)}-01`, to };
};

// Boshliq markaziy amali — kunlik/haftalik/oylik tushum hisoboti.
// Manba: GET /students/revenue?from&to&center&status=paid (Tushumlar bilan bir xil).
export const Report = () => {
  const { t } = useTranslation();
  const { centerId } = useWorker();
  const [period, setPeriod] = useState("today");
  const load = useCallback(
    () => workerApi.revenue({ ...rangeOf(period), center: centerId || undefined, status: "paid", page: 1 }),
    [period, centerId],
  );
  const { data, loading, error, reload } = useLive(load, [load]);
  const byType = data?.byType || {};
  const collectors = data?.byCollector || [];

  return (
    <WorkerPage title={t("worker.report.title")}>
      <SegmentTabs
        items={PERIODS.map((p) => ({ value: p, label: t(`worker.report.period.${p}`) }))}
        value={period}
        onChange={setPeriod}
      />
      <CenterChips />
      {loading ? (
        <>
          <KpiSkeleton cols={2} count={4} />
          <ListSkeleton count={3} />
        </>
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : (
        <>
          <Card className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold text-hint">{t("worker.report.total")}</span>
            <span className="tabular font-bold text-[24px] min-[380px]:text-[28px] leading-tight text-ok break-words">
              {money(data?.totalAmount)} <span className="font-sans text-[15px] text-hint">{t("common.sum")}</span>
            </span>
            <span className="text-[13px] text-hint">{t("worker.report.count", { count: data?.meta?.total || 0 })}</span>
          </Card>
          <StatGrid
            items={["cash", "card", "mixed"].map((k) => ({
              key: k,
              label: t(`worker.payType.${k}`),
              value: compactMoney(byType[k] || 0),
            }))}
          />
          <SectionLabel>{t("worker.report.byCollector")}</SectionLabel>
          {collectors.length === 0 ? (
            <EmptyState icon={HiOutlineUserGroup} title={t("worker.report.empty")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {collectors.map((c) => (
                <ListRow
                  key={c.id || "unknown"}
                  title={c.name || t("worker.report.unknownCollector")}
                  sub={[c.role && t(`worker.role.${c.role}`, { defaultValue: c.role }), t("worker.report.count", { count: c.count })]
                    .filter(Boolean)
                    .join(" · ")}
                  right={money(c.amount)}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </WorkerPage>
  );
};
