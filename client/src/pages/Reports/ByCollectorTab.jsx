import { useTranslation } from "react-i18next";
import List from "../../ui/List";
import Chip from "../../ui/Chip";
import Avatar from "../../ui/Avatar";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import { ReportError, SortHeader } from "./shared";
import { money, useReportResource, useSorted } from "./reportData";

const KIND_COLOR = { client: "violet", staff: "blue", admin: "slate" };

// Pul yig'uvchi (resepshin/boshliq) kesimi — kassada kim qancha qabul
// qilgani. Naqd/karta ajratmasi kassa yopishda solishtirish uchun kerak.
function ByCollectorTab({ query, tick }) {
  const { t } = useTranslation();
  const feature = useFeature();

  const { data, loading, error, refetch } = useReportResource("/reports/by-collector", query, [tick]);
  const { rows, sort, toggle } = useSorted(data, "collected");

  if (error) return <ReportError onRetry={refetch} />;

  const columns = [
    {
      key: "collector",
      header: (
        <SortHeader label={t("report.collector")} sortKey="collector.fullName" sort={sort} onToggle={toggle} />
      ),
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar user={{ _id: row.collector?.id, name: row.collector?.fullName }} size={32} />
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {row.collector?.fullName || t("revenue.collectorUnknown")}
            </span>
            {row.collector?.kind && (
              <Chip
                value={t(`audit.kinds.${row.collector.kind}`, { defaultValue: row.collector.kind })}
                color={KIND_COLOR[row.collector.kind] || "slate"}
                className="mt-0.5 w-fit"
              />
            )}
          </div>
        </div>
      ),
    },
    {
      key: "paymentsCount",
      header: (
        <SortHeader label={t("report.paymentsCount")} sortKey="paymentsCount" sort={sort} onToggle={toggle} />
      ),
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.paymentsCount ?? 0}</span>,
    },
    {
      key: "collected",
      header: <SortHeader label={t("report.collected")} sortKey="collected" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-emerald-600 dark:text-emerald-400">{money(row.collected)}</NumberText>,
    },
    {
      key: "cash",
      header: <SortHeader label={t("report.cash")} sortKey="cash" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText>{money(row.cash)}</NumberText>,
    },
    {
      key: "card",
      header: <SortHeader label={t("report.card")} sortKey="card" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText>{money(row.card)}</NumberText>,
    },
    {
      key: "refunded",
      header: <SortHeader label={t("report.refunded")} sortKey="refunded" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <NumberText className={row.refunded ? "text-red-500" : "text-slate-400 dark:text-slate-500"}>
          {money(row.refunded)}
        </NumberText>
      ),
    },
  ];

  return (
    <List
      columns={columns}
      rows={rows}
      loading={loading}
      empty={t("report.empty")}
      toolbar={
        feature("excel.export") ? (
          <ExportExcelButton endpoint="/reports/export" params={query} />
        ) : null
      }
    />
  );
}

export default ByCollectorTab;
