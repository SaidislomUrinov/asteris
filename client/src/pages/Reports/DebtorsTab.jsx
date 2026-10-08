import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiExclamationCircle } from "react-icons/hi2";
import List from "../../ui/List";
import Chip from "../../ui/Chip";
import NumberText from "../../ui/NumberText";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useFeature from "../../hooks/useFeature";
import { ReportError } from "./shared";
import { money, useReportResource } from "./reportData";

// Qarzdorlar — yagona paginatsiyali tab (ro'yxat uzun bo'lishi mumkin).
// Backend javobi ikki shaklda kelishi mumkin: `data` to'g'ridan-to'g'ri
// massiv yoki `{ data, meta, totalDebt }` — ikkalasi ham qo'llab-quvvatlanadi.
function DebtorsTab({ query, tick }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const feature = useFeature();

  const [page, setPage] = useState(1);

  // Filtr o'zgarsa sahifa boshiga qaytariladi, aks holda bo'sh sahifada
  // "qarzdor yo'q" degan noto'g'ri taassurot qoladi.
  const queryKey = JSON.stringify(query);
  const [prevKey, setPrevKey] = useState(queryKey);
  if (prevKey !== queryKey) {
    setPrevKey(queryKey);
    setPage(1);
  }

  const params = useMemo(() => ({ ...query, page }), [queryKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, extra, loading, error, refetch } = useReportResource(
    "/reports/debtors",
    params,
    [tick],
  );

  const rows = Array.isArray(data) ? data : data?.data || [];
  const meta = extra.meta || data?.meta || { page: 1, totalPages: 1, total: 0 };
  const totalDebt = extra.totalDebt ?? data?.totalDebt ?? 0;

  if (error) return <ReportError onRetry={refetch} />;

  const columns = [
    {
      key: "student",
      header: t("report.student"),
      render: (row) => (
        <button
          type="button"
          onClick={() => row.student?._id && navigate(`/students/${row.student._id}`)}
          className="flex flex-col items-start text-left cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 duration-200"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {row.student?.fullName || row.student || "—"}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</span>
        </button>
      ),
    },
    {
      key: "group",
      header: t("report.group"),
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.group?.name || row.group || "—"}</span>,
    },
    {
      key: "months",
      header: t("report.debtMonths"),
      render: (row) => (
        <div className="flex items-center gap-1 flex-wrap max-w-64">
          {(row.months || []).length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
          ) : (
            row.months.map((m) => (
              <Chip key={m ?? "unknown"} value={m ?? t("student.openingMonthUnknown")} color="red" />
            ))
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("report.debt"),
      className: "text-right",
      render: (row) => <NumberText className="text-red-500">{money(row.amount)}</NumberText>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-red-50/70 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30">
        <span className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
          <HiExclamationCircle className="text-lg shrink-0" />
          {t("report.totalDebt")}
        </span>
        <span className="flex items-baseline gap-1">
          <NumberText className="text-base text-red-600 dark:text-red-400">{money(totalDebt)}</NumberText>
          <span className="text-xs text-red-400">{t("student.somSuffix")}</span>
        </span>
      </div>

      <List
        columns={columns}
        rows={rows}
        loading={loading}
        empty={t("report.noDebtors")}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        showPagination
        toolbar={
          feature("excel.export") ? (
            <ExportExcelButton endpoint="/reports/export" params={query} />
          ) : null
        }
      />
    </div>
  );
}

export default DebtorsTab;
