import { useTranslation } from "react-i18next";
import List from "../../ui/List";
import Avatar from "../../ui/Avatar";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import { RateBar, ReportError, SortHeader, money, useReportResource, useSorted } from "./shared";

// O'qituvchi kesimi: kim qancha dars o'tgan, qancha tushum keltirgan va
// shundan qanchasi uning oyligiga ketgan.
function ByTeacherTab({ query, tick }) {
  const { t } = useTranslation();
  const feature = useFeature();

  const { data, loading, error, refetch } = useReportResource("/reports/by-teacher", query, [tick]);
  const { rows, sort, toggle } = useSorted(data, "revenueGenerated");

  if (error) return <ReportError onRetry={refetch} />;

  const columns = [
    {
      key: "staff",
      header: <SortHeader label={t("report.teacher")} sortKey="staff.fullName" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            user={{ _id: row.staff?._id, name: row.staff?.fullName, avatar: row.staff?.photo }}
            size={32}
          />
          <span className="font-semibold text-slate-800">{row.staff?.fullName || "—"}</span>
        </div>
      ),
    },
    {
      key: "groups",
      header: <SortHeader label={t("report.groups")} sortKey="groups" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600">{row.groups ?? 0}</span>,
    },
    {
      key: "students",
      header: <SortHeader label={t("report.students")} sortKey="students" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600">{row.students ?? 0}</span>,
    },
    {
      key: "lessonsHeld",
      header: <SortHeader label={t("report.lessonsHeld")} sortKey="lessonsHeld" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="text-slate-600">{row.lessonsHeld ?? 0}</span>,
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
      key: "revenueGenerated",
      header: (
        <SortHeader
          label={t("report.revenueGenerated")}
          sortKey="revenueGenerated"
          sort={sort}
          onToggle={toggle}
        />
      ),
      render: (row) => <NumberText className="text-emerald-600">{money(row.revenueGenerated)}</NumberText>,
    },
    {
      key: "salaryEarned",
      header: <SortHeader label={t("report.salaryEarned")} sortKey="salaryEarned" sort={sort} onToggle={toggle} />,
      render: (row) => <NumberText className="text-orange-600">{money(row.salaryEarned)}</NumberText>,
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

export default ByTeacherTab;
