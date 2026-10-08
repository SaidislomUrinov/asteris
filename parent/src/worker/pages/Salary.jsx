import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, SectionLabel } from "../../components/Card";
import { MonthNav } from "../../components/MonthNav";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { KpiSkeleton } from "../components/WorkerSkeleton";
import { money } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr, compactMoney, tashkentMonth } from "../utils";
import { StatGrid } from "../components/StatGrid";
import { ListRow } from "../components/ListRow";

// Hodimning o'z oyligi: GET /salaries/:staffId?month= (o'zini ko'rish uchun
// `salary:view` shart emas — salary.controller assertCanViewSalary).
export const Salary = () => {
  const { t } = useTranslation();
  const { me } = useWorker();
  const [month, setMonth] = useState(tashkentMonth);
  const load = useCallback(() => workerApi.salary(me?._id, month), [me?._id, month]);
  const { data, loading, error, reload } = useLive(load, [load], { enabled: !!me?._id });
  const txs = (data?.transactions || []).filter((x) => x.status !== "cancelled");

  return (
    <WorkerPage title={t("worker.salary.title")}>
      <MonthNav month={month} onChange={setMonth} />
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
            <span className="text-[12px] font-bold text-hint">{t("worker.salary.final")}</span>
            <span className="tabular font-bold text-[28px] leading-tight">
              {money(data?.final)} <span className="text-[15px] text-hint">{t("common.sum")}</span>
            </span>
            {data?.salaryType && (
              <span className="text-[13px] text-hint">{t(`worker.salary.type.${data.salaryType}`, { defaultValue: data.salaryType })}</span>
            )}
          </Card>
          <StatGrid
            items={[
              { key: "base", label: t("worker.salary.base"), value: compactMoney(data?.base) },
              { key: "adv", label: t("worker.salary.advance"), value: compactMoney((data?.advance || 0) + (data?.withdrawal || 0)) },
              { key: "bonus", label: t("worker.salary.bonus"), value: compactMoney(data?.bonus), tone: data?.bonus > 0 ? "ok" : undefined },
              { key: "pen", label: t("worker.salary.penalty"), value: compactMoney(data?.penalty), tone: data?.penalty > 0 ? "bad" : undefined },
            ]}
          />
          <SectionLabel>{t("worker.salary.history")}</SectionLabel>
          {txs.length === 0 ? (
            <EmptyState icon={HiOutlineBanknotes} title={t("worker.salary.noTx")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {txs.map((x) => (
                <ListRow
                  key={x._id}
                  title={t(`worker.salary.tx.${x.type}`, { defaultValue: x.type })}
                  sub={[String(x.date || "").replace(" | ", " · "), x.note].filter(Boolean).join(" · ")}
                  right={`${x.type === "bonus" ? "+" : "−"}${money(x.amount)}`}
                  rightTone={x.type === "bonus" ? "ok" : x.type === "penalty" ? "bad" : undefined}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </WorkerPage>
  );
};
