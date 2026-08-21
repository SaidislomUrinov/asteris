import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DateRangeInput from "../../ui/DateRangeInput";
import SummaryCards from "./SummaryCards";
import TimelineChart from "./TimelineChart";
import ByCenterTab from "./ByCenterTab";
import ByTeacherTab from "./ByTeacherTab";
import ByCollectorTab from "./ByCollectorTab";
import ByGroupTab from "./ByGroupTab";
import DebtorsTab from "./DebtorsTab";
import { ReportError, useReportResource } from "./shared";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

const PERIODS = ["daily", "weekly", "monthly", "custom"];
const GROUP_BY = ["day", "week", "month"];

// Realtime: to'lov/xarajat/davomat hodisalari oqim bilan keladi (ertalabki
// QR skanlar). Har biriga alohida so'rov yubormaymiz — 1500ms debounce
// bilan bittaga yig'iladi (docs/API_CONTRACT.md §2.3).
const REALTIME_DEBOUNCE = 1500;

function Reports() {
  const { t } = useTranslation();

  const [period, setPeriod] = useState("monthly");
  const [range, setRange] = useState({ from: "", to: "" });
  const [center, setCenter] = useState("");
  const [groupBy, setGroupBy] = useState("day");
  const [tab, setTab] = useState("center");
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

  const summary = useReportResource("/reports/summary", query, [tick]);
  const timeline = useReportResource("/reports/timeline", query, [tick]);

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
    fetchCenters();
  }, [fetchCenters]);

  const refetchAll = useDebouncedCallback(() => setTick((v) => v + 1), REALTIME_DEBOUNCE);

  useSocketEvent("payment:created", refetchAll);
  useSocketEvent("payment:cancelled", refetchAll);
  useSocketEvent("expense:created", refetchAll);
  useSocketEvent("expense:updated", refetchAll);
  useSocketEvent("attendance:marked", refetchAll);

  const tabs = [
    { key: "center", label: t("report.tabCenter"), Component: ByCenterTab },
    { key: "teacher", label: t("report.tabTeacher"), Component: ByTeacherTab },
    { key: "collector", label: t("report.tabCollector"), Component: ByCollectorTab },
    { key: "group", label: t("report.tabGroup"), Component: ByGroupTab },
    { key: "debtors", label: t("report.tabDebtors"), Component: DebtorsTab },
  ];

  const ActiveTab = tabs.find((x) => x.key === tab)?.Component || ByCenterTab;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <FilterBar
        cols={showCenterFilter ? 3 : 2}
        activeCount={[center, groupBy !== "day", period === "custom" && range.from].filter(Boolean).length}
        onReset={() => {
          setCenter("");
          setGroupBy("day");
          setPeriod("monthly");
          setRange({ from: "", to: "" });
        }}
        search={
          // Davr tanlagichi — hisobotning asosiy boshqaruvi, shuning uchun
          // mobil filtr modalida emas, doim ko'rinadigan qatorda turadi.
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`shrink-0 px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
          <DateRangeInput
            variant="white"
            value={range}
            onChange={setRange}
            placeholder={t("report.customRange")}
          />
        )}
        {showCenterFilter && (
          <Select
            placeholder={t("report.center")}
            variant="white"
            value={center}
            onChange={setCenter}
            options={[
              { value: "", label: t("common.all") },
              ...centers.map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
        )}
        <Select
          placeholder={t("report.groupBy")}
          variant="white"
          value={groupBy}
          onChange={setGroupBy}
          options={GROUP_BY.map((g) => ({ value: g, label: t(`report.groupByOptions.${g}`) }))}
        />
      </FilterBar>

      {customIncomplete ? (
        <div className="flex items-center justify-center w-full flex-1 min-h-60 text-sm text-slate-400 rounded-2xl bg-white border border-slate-200/80">
          {t("report.pickRange")}
        </div>
      ) : summary.error ? (
        <ReportError onRetry={summary.refetch} />
      ) : (
        <>
          <SummaryCards summary={summary.data} loading={summary.loading} />

          <TimelineChart rows={timeline.data || []} loading={timeline.loading} />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto">
              {tabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={`shrink-0 px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                    tab === x.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>

            {/* `key` — tab almashganda ichki holat (sort, sahifa) tozalanadi */}
            <ActiveTab key={tab} query={query} tick={tick} />
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
