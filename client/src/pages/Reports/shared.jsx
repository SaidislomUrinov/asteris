import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowSmallDown, HiArrowSmallUp, HiChartBar } from "react-icons/hi2";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// Hisobot modulida takrorlanadigan uch narsa shu yerda: ma'lumot olish,
// mijoz tomonda saralash va xato holati. Har tab (filial/o'qituvchi/guruh...)
// bir xil shakl bilan ishlagani uchun bularni ko'chirib yozish DRY'ni buzardi.

export const money = (v) => `${Math.round(v || 0).toLocaleString("uz-UZ")}`;

// O'sish foizi: musbat — yashil, manfiy — qizil. `null` bo'lsa taqqoslash
// uchun oldingi davr ma'lumoti yo'q degani.
export const percent = (v) => `${v > 0 ? "+" : ""}${Math.round(v || 0)}%`;

/**
 * Hisobot endpointidan ma'lumot oladi. `deps` — so'rovga kirmaydigan,
 * lekin qayta yuklashni talab qiladigan qiymatlar (realtime "tick" kabi).
 *
 * @param {string} endpoint
 * @param {Object} params
 * @param {Array} [deps]
 */
export function useReportResource(endpoint, params, deps = []) {
  const [data, setData] = useState(null);
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const key = JSON.stringify(params);
  const depsKey = JSON.stringify(deps);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(endpoint, { params: JSON.parse(key) });
      const { ok, data: payload, msg, ...rest } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload ?? null);
      setExtra(rest || {});
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, key]);

  useEffect(() => {
    fetchData();
    // `depsKey` — tashqi qayta yuklash signali (socket tick). Uni chaqiruvda
    // ishlatmaymiz, faqat effektni qayta ishga tushirish uchun kerak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, depsKey]);

  return { data, extra, loading, error, refetch: fetchData };
}

/**
 * Jadval ustunlari bo'yicha mijoz tomonda saralash. Hisobot qatorlari
 * ko'pi bilan bir necha o'nlab bo'lgani uchun server tomon sort ortiqcha.
 */
export function useSorted(rows, initialKey = "", initialDir = "desc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });

  const sorted = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!sort.key) return list;
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = valueAt(a, sort.key);
      const bv = valueAt(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av ?? "").localeCompare(String(bv ?? ""), "uz") * sign;
    });
  }, [rows, sort]);

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return { rows: sorted, sort, toggle };
}

const valueAt = (row, path) => path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), row);

/**
 * Saralanadigan ustun sarlavhasi — `List` ustunining `header` maydoniga
 * beriladi.
 */
export function SortHeader({ label, sortKey, sort, onToggle }) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 cursor-pointer uppercase font-semibold duration-150 ${
        active ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      {active &&
        (sort.dir === "asc" ? (
          <HiArrowSmallUp className="text-sm" />
        ) : (
          <HiArrowSmallDown className="text-sm" />
        ))}
    </button>
  );
}

/**
 * Davomat foizi ustuni. `ui/ProgressBar` bu yerga to'g'ri kelmaydi — u
 * `value/max` yorlig'i bilan ustun-ustun chiziladi va kenglik boshqaruvini
 * qabul qilmaydi; jadval katagida esa ixcham, bir qatorlik ko'rinish kerak.
 */
export function RateBar({ value = 0 }) {
  const v = Math.min(100, Math.max(0, Math.round(value || 0)));
  const tone = v >= 80 ? "bg-emerald-500" : v >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-28">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-slate-500 shrink-0">{v}%</span>
    </div>
  );
}

export function ReportError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 min-h-60 gap-3 text-slate-400">
      <HiChartBar className="text-4xl" />
      <p className="text-sm">{t("report.loadError")}</p>
      <Button variant="outlined" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
