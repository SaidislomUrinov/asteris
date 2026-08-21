import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import List from "../../ui/List";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import { RateBar, ReportError, SortHeader, money, useReportResource, useSorted } from "./shared";

// Guruh kesimi — qaysi guruh foydali, qaysi biri qarzga botgan.
// Guruh nomi bosilsa guruh sahifasiga o'tiladi (hisobotdan tekshiruvga
// o'tish eng ko'p kerak bo'ladigan yo'l).
function ByGroupTab({ query, tick }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const feature = useFeature();

  const { data, loading, error, refetch } = useReportResource("/reports/by-group", query, [tick]);
  const { rows, sort, toggle } = useSorted(data, "revenue");

  if (error) return <ReportError onRetry={refetch} />;

  const columns = [
    {
      key: "group",
      header: <SortHeader label={t("report.group")} sortKey="group.name" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <button
          type="button"
          onClick={() => row.group?._id && navigate(`/groups/${row.group._id}`)}
          className="flex flex-col items-start text-left cursor-pointer hover:text-blue-600 duration-200"
        >
          <span className="font-semibold text-slate-800">{row.group?.name || "—"}</span>
          {row.teacher && <span className="text-xs text-slate-400">{row.teacher}</span>}
        </button>
      ),
    },
    {
      key: "students",
      header: <SortHeader label={t("report.students")} sortKey="students" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600">{row.students ?? 0}</span>,
    },
    {
      key: "revenue",
      header: <SortHeader label={t("report.revenue")} sortKey="revenue" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-emerald-600">{money(row.revenue)}</NumberText>,
    },
    {
      key: "debt",
      header: <SortHeader label={t("report.debt")} sortKey="debt" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <NumberText className={row.debt ? "text-red-500" : "text-slate-400"}>
          {money(row.debt)}
        </NumberText>
      ),
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
    {
      key: "syllabusProgress",
      header: (
        <SortHeader
          label={t("report.syllabusProgress")}
          sortKey="syllabusProgress"
          sort={sort}
          onToggle={toggle}
        />
      ),
      render: (row) => <RateBar value={row.syllabusProgress} />,
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

export default ByGroupTab;
