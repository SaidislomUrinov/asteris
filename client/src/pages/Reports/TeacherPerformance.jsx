import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DateRangeInput from "../../ui/DateRangeInput";
import ByTeacherTab from "./ByTeacherTab";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

const PERIODS = ["daily", "weekly", "monthly", "custom"];

// Realtime: to'lov/davomat hodisalari oqim bilan keladi — har biriga
// alohida so'rov yubormaymiz, 1500ms debounce bilan bittaga yig'iladi
// (Reports/index.jsx dagi bir xil pattern).
const REALTIME_DEBOUNCE = 1500;

// "O'qituvchi samaradorligi" — Reports sahifasidan ajratilgan, tor sahifa.
// Mavjud `ByTeacherTab` va `/reports/by-teacher` endpointini qayta ishlatadi
// (docs/API_CONTRACT.md — Reports/index.jsx o'zi mount qilinmaydi).
function TeacherPerformance() {
  const { t } = useTranslation();

  const [period, setPeriod] = useState("monthly");
  const [range, setRange] = useState({ from: "", to: "" });
  const [center, setCenter] = useState("");
  const [tick, setTick] = useState(0);

  const [centers, setCenters] = useState([]);
  const showCenterFilter = centers.length > 1;

  const customIncomplete = period === "custom" && !(range.from && range.to);

  const query = useMemo(
    () => ({
      period,
      from: period === "custom" ? range.from : "",
      to: period === "custom" ? range.to : "",
      center,
    }),
    [period, range.from, range.to, center],
  );

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
  useSocketEvent("attendance:marked", refetchAll);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <FilterBar
        cols={showCenterFilter ? 2 : 1}
        activeCount={[center, period === "custom" && range.from].filter(Boolean).length}
        onReset={() => {
          setCenter("");
          setPeriod("monthly");
          setRange({ from: "", to: "" });
        }}
        search={
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
      </FilterBar>

      {customIncomplete ? (
        <div className="flex items-center justify-center w-full flex-1 min-h-60 text-sm text-slate-400 rounded-2xl bg-white border border-slate-200/80">
          {t("report.pickRange")}
        </div>
      ) : (
        <ByTeacherTab query={query} tick={tick} />
      )}
    </div>
  );
}

export default TeacherPerformance;
