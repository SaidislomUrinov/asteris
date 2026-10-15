import { useCallback, useEffect, useMemo, useState } from "react";
import useQueryState, { useQueryStates } from "../../hooks/useQueryState";
import { useTranslation } from "react-i18next";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DateRangeInput from "../../ui/DateRangeInput";
import SummaryCards from "./SummaryCards";
import TimelineChart from "./TimelineChart";
import ByTeacherTab from "./ByTeacherTab";
import ByCollectorTab from "./ByCollectorTab";
import ByGroupTab from "./ByGroupTab";
import DebtorsTab from "./DebtorsTab";
import AttendanceTab from "./AttendanceTab";
import { ReportError } from "./shared";
import { useReportResource } from "./reportData";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { useSearchParams } from "react-router-dom";
import useFeature from "../../hooks/useFeature";

const PERIODS = ["daily", "weekly", "monthly", "custom"];
const GROUP_BY = ["day", "week", "month"];

// Realtime: to'lov/xarajat/davomat hodisalari oqim bilan keladi (ertalabki
// QR skanlar). Har biriga alohida so'rov yubormaymiz — 1500ms debounce
// bilan bittaga yig'iladi (docs/API_CONTRACT.md §2.3).
const REALTIME_DEBOUNCE = 1500;

const RANGE_DEFAULTS = { from: "", to: "" };

function Reports() {
  const { t } = useTranslation();
  const hasFeature = useFeature();
  // Moliyaviy qism (umumiy kartalar, grafik, moliyaviy tablar) — `finance.report`;
  // davomat hisoboti — mustaqil `attendance.report` flag'i.
  const hasFinance = hasFeature("finance.report");
  const [searchParams, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useQueryState("period", "monthly");
  const [range, setRange] = useQueryStates(RANGE_DEFAULTS);
  const [center, setCenter] = useQueryState("center", "");
  const [groupBy, setGroupBy] = useQueryState("groupBy", "day");
  const [tick, setTick] = useState(0);

  const [centers, setCenters] = useState([]);
  const showCenterFilter = centers.length > 1;

  // "Oraliq" tanlangan-u, sana hali kiritilmagan bo'lsa so'rov yuborishdan
  // ma'no yo'q — server baribir bo'sh oraliqni qabul qilmaydi.
  const customIncomplete = period === "custom" && !(range.from && range.to);

  const query = useMemo(
    () => ({
      period,
      from: period === "custom" ? range.from : "",
      to: period === "custom" ? range.to : "",
      center,
      groupBy,
    }),
    [period, range.from, range.to, center, groupBy],
  );

  // Moliyaviy tarifsiz so'rov yuborilmaydi (server baribir rad etadi) —
  // endpoint bo'sh bo'lsa hook o'rniga null ma'lumot ko'rsatiladi.
  const summary = useReportResource(hasFinance ? "/reports/summary" : "", query, [tick]);
  const timeline = useReportResource(hasFinance ? "/reports/timeline" : "", query, [tick]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat filtr uchun
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchCenters, 0);
    return () => clearTimeout(id);
  }, [fetchCenters]);

  const refetchAll = useDebouncedCallback(() => setTick((v) => v + 1), REALTIME_DEBOUNCE);

  useSocketEvent("payment:created", refetchAll);
  useSocketEvent("payment:cancelled", refetchAll);
  useSocketEvent("payment:updated", refetchAll);
  useSocketEvent("expense:created", refetchAll);
  useSocketEvent("expense:updated", refetchAll);
  useSocketEvent("attendance:marked", refetchAll);

  const tabs = [
    // "Filiallar bo'yicha" tabi olib tashlandi: hisobotlar faqat Top'da
    // tanlangan BITTA filial bo'yicha (API_CONTRACT_multi_center.md §0.5).
    hasFinance &&
      hasFeature("teacher.performance") && { key: "teacher", label: t("report.tabTeacher"), Component: ByTeacherTab },
    hasFinance && { key: "collector", label: t("report.tabCollector"), Component: ByCollectorTab },
    hasFinance && { key: "group", label: t("report.tabGroup"), Component: ByGroupTab },
    hasFinance && { key: "debtors", label: t("report.tabDebtors"), Component: DebtorsTab },
    hasFeature("attendance.report") && {
      key: "attendance",
      label: t("report.tabAttendance"),
      Component: AttendanceTab,
    },
  ].filter(Boolean);

  // Tanlangan tab URL'da (`?tab=attendance`) — havola orqali to'g'ridan-to'g'ri
  // ochish va sahifa yangilanganda saqlanib qolishi uchun.
  const active = tabs.find((x) => x.key === searchParams.get("tab")) || tabs[0];
  const tab = active?.key;
  const ActiveTab = active?.Component;
  // Boshqa filtr paramlari (period/center/from/to) saqlanib qoladi.
  const setTab = (key) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <FilterBar
        cols={1 + (showCenterFilter ? 1 : 0) + (hasFinance ? 1 : 0)}
        activeCount={[center, groupBy !== "day", period === "custom" && range.from].filter(Boolean).length}
        onReset={() => {
          setCenter("");
          setGroupBy("day");
          setPeriod("monthly");
          setRange(RANGE_DEFAULTS);
        }}
        search={
          // Davr tanlagichi — hisobotning asosiy boshqaruvi, shuning uchun
          // mobil filtr modalida emas, doim ko'rinadigan qatorda turadi.
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`shrink-0 px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  period === p ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t(`report.periods.${p}`)}
              </button>
            ))}
          </div>
        }
      >
        {/* Sana oralig'i faqat "Oraliq" rejimida ma'noli — boshqa rejimda
            davrni serverning o'zi hisoblaydi. */}
        {period === "custom" && (
          <div className="flex flex-col gap-1 w-full">
            <DateRangeInput
              variant="slate"
              value={range}
              onChange={setRange}
              placeholder={t("report.customRange")}
            />
          </div>
        )}
        {showCenterFilter && (
          <Select
            placeholder={t("report.center")}
            variant="slate"
            value={center}
            onChange={setCenter}
            options={[
              { value: "", label: t("common.all") },
              ...centers.map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
        )}
        {hasFinance && (
          <Select
            placeholder={t("report.groupBy")}
            variant="slate"
            value={groupBy}
            onChange={setGroupBy}
            options={GROUP_BY.map((g) => ({ value: g, label: t(`report.groupByOptions.${g}`) }))}
          />
        )}
      </FilterBar>

      {customIncomplete ? (
        <div className="flex items-center justify-center w-full flex-1 min-h-60 text-sm text-slate-400 dark:text-slate-500 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80">
          {t("report.pickRange")}
        </div>
      ) : hasFinance && summary.error ? (
        <ReportError onRetry={summary.refetch} />
      ) : (
        <>
          {hasFinance && <SummaryCards summary={summary.data} loading={summary.loading} />}

          {hasFinance && <TimelineChart rows={timeline.data || []} loading={timeline.loading} />}

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 overflow-x-auto">
              {tabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={`shrink-0 px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                    tab === x.key
                      ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>

            {/* `key` — tab almashganda ichki holat (sort, sahifa) tozalanadi */}
            {ActiveTab && <ActiveTab key={tab} query={query} tick={tick} />}
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
