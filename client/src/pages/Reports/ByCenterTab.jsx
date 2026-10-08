import { useTranslation } from "react-i18next";
import List from "../../ui/List";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import { RateBar, ReportError, SortHeader } from "./shared";
import { money, useReportResource, useSorted } from "./reportData";

// Filial kesimi — qaysi markaz qancha keltirayotgani bir qarashda ko'rinadi.
function ByCenterTab({ query, tick }) {
  const { t } = useTranslation();
  const feature = useFeature();

  const { data, loading, error, refetch } = useReportResource("/reports/by-center", query, [tick]);
  const { rows, sort, toggle } = useSorted(data, "revenue");

  if (error) return <ReportError onRetry={refetch} />;

  const columns = [
    {
      key: "center",
      header: <SortHeader label={t("report.center")} sortKey="center.name" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="font-semibold text-slate-800 dark:text-slate-100">{row.center?.name || "—"}</span>,
    },
    {
      key: "revenue",
      header: <SortHeader label={t("report.revenue")} sortKey="revenue" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-emerald-600 dark:text-emerald-400">{money(row.revenue)}</NumberText>,
    },
    {
      key: "expense",
      header: <SortHeader label={t("report.expense")} sortKey="expense" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-orange-600 dark:text-orange-400">{money(row.expense)}</NumberText>,
    },
    {
      key: "profit",
      header: <SortHeader label={t("report.profit")} sortKey="profit" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <NumberText className={row.profit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500"}>
          {money(row.profit)}
        </NumberText>
      ),
    },
    {
      key: "debt",
      header: <SortHeader label={t("report.debt")} sortKey="debt" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-red-500">{money(row.debt)}</NumberText>,
    },
    {
      key: "students",
      header: <SortHeader label={t("report.students")} sortKey="students" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.students ?? 0}</span>,
    },
    {
      key: "groups",
      header: <SortHeader label={t("report.groups")} sortKey="groups" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.groups ?? 0}</span>,
    },
    {
      key: "attendanceRate",
      header: (
        <SortHeader
          label={t("report.attendanceRate")}
          sortKey="attendanceRate"
          sort={sort}
          onToggle={toggle}
        />
      ),
      render: (row) => <RateBar value={row.attendanceRate} />,
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

export default ByCenterTab;
