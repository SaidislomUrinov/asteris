import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiCalendarDays,
  HiCheckCircle,
  HiClock,
  HiExclamationTriangle,
  HiXCircle,
} from "react-icons/hi2";
import List from "../../ui/List";
import Select from "../../ui/Select";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import { api } from "../../utils/fetching";
import { RateBar, ReportError, SortHeader } from "./shared";
import { useReportResource, useSorted } from "./reportData";

// Davomat hisoboti (`attendance.report` tarif flag'i) — filial/guruh/davr
// bo'yicha darslar soni, kelgan/kelmagan/sababli ulushi, guruh kesimi va
// eng ko'p qoldiruvchi o'quvchilar. Davr/filial filtri Reports sahifasidan
// keladi, guruh filtri esa faqat shu tabga tegishli.
function AttendanceTab({ query, tick }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const feature = useFeature();
  const can = useCan();

  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState([]);

  const params = useMemo(() => ({ ...query, group }), [query, group]);
  const { data, loading, error, refetch } = useReportResource("/reports/attendance", params, [tick]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get("/groups", { params: { page: 1, center: query.center } });
      const { ok, data: list } = res.data;
      if (ok) setGroups(list || []);
    } catch {
      // guruhlar ro'yxati faqat filtr uchun
    }
  }, [query.center]);

  useEffect(() => {
    const id = setTimeout(fetchGroups, 0);
    return () => clearTimeout(id);
  }, [fetchGroups]);

  if (error) return <ReportError onRetry={refetch} />;

  const totals = data?.totals;
  const canExport = feature("excel.export") && can("report:export");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <Select
            placeholder={t("report.attendance.group")}
            variant="slate"
            value={group}
            onChange={setGroup}
            options={[
              { value: "", label: t("report.attendance.allGroups") },
              ...groups.map((g) => ({ value: g._id, label: g.name })),
            ]}
          />
        </div>
        {canExport && (
          <div className="ml-auto">
            <ExportExcelButton endpoint="/reports/attendance/export" params={params} />
          </div>
        )}
      </div>

      <AttendanceOverview totals={totals} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-start">
        <section className="xl:col-span-3 flex flex-col gap-2 min-w-0">
          <SectionTitle title={t("report.attendance.byGroupTitle")} hint={t("report.attendance.byGroupHint")} />
          <GroupTable rows={data?.byGroup} loading={loading} onOpen={(id) => navigate(`/groups/${id}`)} />
        </section>
        <section className="xl:col-span-2 flex flex-col gap-2 min-w-0">
          <SectionTitle title={t("report.attendance.topTitle")} hint={t("report.attendance.topHint")} />
          <TopAbsentees rows={data?.topAbsentees} loading={loading} onOpen={(id) => navigate(`/students/${id}`)} />
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, hint }) {
  return (
    <div className="flex flex-col px-1">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

// Umumiy ko'rinish: chapda asosiy raqamlar, pastda kelgan/kelmagan/sababli
// taqsimoti bitta chiziqda — ulushlarni ko'z bilan solishtirish oson.
function AttendanceOverview({ totals, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="h-40 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 animate-pulse" />;
  }
  if (!totals) return null;

  const stats = [
    { key: "lessons", icon: <HiCalendarDays />, tone: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400", value: totals.lessons },
    {
      key: "present",
      icon: <HiCheckCircle />,
      tone: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      value: totals.present,
      rate: totals.presentRate,
    },
    {
      key: "absent",
      icon: <HiXCircle />,
      tone: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
      value: totals.absent,
      rate: totals.absentRate,
    },
    {
      key: "excused",
      icon: <HiExclamationTriangle />,
      tone: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
      value: totals.excused,
      rate: totals.excusedRate,
    },
    { key: "late", icon: <HiClock />, tone: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400", value: totals.late },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 min-w-0">
            <span className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-xl text-lg ${s.tone}`}>
              {s.icon}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                {t(`report.attendance.${s.key}`)}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-jet font-semibold text-lg text-slate-900 dark:text-slate-100">{s.value ?? 0}</span>
                {s.rate !== undefined && <span className="text-xs text-slate-400 dark:text-slate-500">{s.rate}%</span>}
              </span>
            </div>
          </div>
        ))}
      </div>

      {totals.records > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-night-800">
            <div className="bg-emerald-500" style={{ width: `${totals.presentRate}%` }} />
            <div className="bg-amber-400" style={{ width: `${totals.excusedRate}%` }} />
            <div className="bg-red-500" style={{ width: `${totals.absentRate}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <Legend dot="bg-emerald-500" label={t("report.attendance.present")} value={totals.presentRate} />
            <Legend dot="bg-amber-400" label={t("report.attendance.excused")} value={totals.excusedRate} />
            <Legend dot="bg-red-500" label={t("report.attendance.absent")} value={totals.absentRate} />
            <span className="ml-auto text-slate-400 dark:text-slate-500">
              {t("report.attendance.records", { count: totals.records })}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">{t("report.attendance.noData")}</p>
      )}
    </div>
  );
}

function Legend({ dot, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label} <b className="font-semibold text-slate-700 dark:text-slate-300">{value}%</b>
    </span>
  );
}

function GroupTable({ rows: raw, loading, onOpen }) {
  const { t } = useTranslation();
  const { rows, sort, toggle } = useSorted(raw, "presentRate", "asc");

  const columns = [
    {
      key: "group",
      header: <SortHeader label={t("report.group")} sortKey="group.name" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row.group._id)}
          className="flex flex-col items-start text-left cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 duration-200"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.group.name}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {row.teacher} · {row.center.name}
          </span>
        </button>
      ),
    },
    {
      key: "lessons",
      header: <SortHeader label={t("report.attendance.lessons")} sortKey="lessons" sort={sort} onToggle={toggle} />,
      render: (row) => <span className="font-jet text-slate-600 dark:text-slate-300">{row.lessons}</span>,
    },
    {
      key: "absent",
      header: <SortHeader label={t("report.attendance.absentShort")} sortKey="absent" sort={sort} onToggle={toggle} />,
      render: (row) => (
        <span className="font-jet text-slate-600 dark:text-slate-300">
          <span className={row.absent ? "text-red-500" : ""}>{row.absent}</span>
          <span className="text-slate-300 dark:text-slate-600"> / </span>
          <span className={row.excused ? "text-amber-600 dark:text-amber-400" : ""}>{row.excused}</span>
        </span>
      ),
    },
    {
      key: "presentRate",
      header: (
        <SortHeader label={t("report.attendanceRate")} sortKey="presentRate" sort={sort} onToggle={toggle} />
      ),
      render: (row) => <RateBar value={row.presentRate} />,
    },
  ];

  return <List columns={columns} rows={rows} rowKey={(r) => r.group._id} loading={loading} empty={t("report.empty")} />;
}

function TopAbsentees({ rows, loading, onOpen }) {
  const { t } = useTranslation();

  const columns = [
    {
      key: "student",
      header: t("report.student"),
      render: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row.student._id)}
          className="flex flex-col items-start text-left cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 duration-200 min-w-0"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.student.fullName}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-48">
            {row.groups.map((g) => g.name).join(", ")}
          </span>
        </button>
      ),
    },
    {
      key: "absent",
      header: t("report.attendance.absentShort"),
      render: (row) => (
        <span className="font-jet whitespace-nowrap">
          <span className="text-red-500 font-semibold">{row.absent}</span>
          <span className="text-slate-300 dark:text-slate-600"> / </span>
          <span className="text-amber-600 dark:text-amber-400">{row.excused}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500"> · {row.absentRate}%</span>
        </span>
      ),
    },
  ];

  return (
    <List
      columns={columns}
      rows={rows || []}
      rowKey={(r) => r.student._id}
      loading={loading}
      empty={t("report.attendance.noAbsentees")}
    />
  );
}

export default AttendanceTab;
