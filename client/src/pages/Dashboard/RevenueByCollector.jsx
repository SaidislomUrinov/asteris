import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiArrowTrendingUp, HiChevronRight, HiUserCircle } from "react-icons/hi2";
import NumberText from "../../ui/NumberText";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

// Oyning oxirgi kuni — "YYYY-MM" filtrini Tushumlar API'sining from/to
// (kun aniqligidagi) oralig'iga aylantirish uchun.
const monthRange = (month) => {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(year, mon, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

// Dashboard kartochkasi: tanlangan oyda to'lovni KIM qancha qabul qilgani.
// To'liq ro'yxat "Tushumlar" sahifasida (`/revenue`) — bu yerda faqat
// jamlanma va eng ko'p yig'ganlar. Owner-only (backend `requireOwner`).
function RevenueByCollector({ month, center }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  // Faqat BIRINCHI yuklanishda skelet — oy almashganda yoki socket
  // hodisasida eski ro'yxat yangisi kelguncha joyida turadi (miltillamaydi).
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { from, to } = monthRange(month);
      // Faqat jamlanma kerak — `byCollector` va `totalAmount` filtr doirasi
      // bo'yicha hisoblanadi, shuning uchun bitta sahifa so'ralsa yetarli.
      const res = await api.get("/students/revenue", { params: { page: 1, from, to, center } });
      const { ok, byCollector, totalAmount } = res.data;
      if (!ok) return;
      setRows(byCollector || []);
      setTotal(totalAmount || 0);
    } catch {
      // kartochka — xato bo'lsa bo'sh holat ko'rsatiladi
    } finally {
      setLoading(false);
    }
  }, [month, center]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  useSocketEvent("payment:created", fetchData);
  useSocketEvent("payment:cancelled", fetchData);
  useSocketEvent("payment:updated", fetchData);

  return (
    <div className="flex flex-col w-full h-full min-h-0 p-5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 gap-3">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <HiArrowTrendingUp className="text-emerald-500 text-xl" />
            {t("dashboard.revenueByCollector")}
          </span>
          {/* "Oylik tushum" kartochkasi `forMonth` (qaysi oy uchun) bo'yicha
              hisoblanadi, bu yerda esa to'lov SANASI (kassa oqimi) — ikkalasi
              turlicha chiqishi normal, shuning uchun izoh yozilgan. */}
          <span className="text-xs text-slate-400 dark:text-slate-500 pl-7">{t("dashboard.revenueByDateHint")}</span>
        </div>
        <button
          onClick={() => navigate("/revenue")}
          className="flex items-center gap-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer duration-200"
        >
          {t("dashboard.revenueSeeAll")}
          <HiChevronRight className="text-sm" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3.5 flex-1 min-h-0 animate-pulse" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 w-1/2 rounded-md bg-slate-100 dark:bg-night-800" />
                <div className="h-3.5 w-16 rounded-md bg-slate-100 dark:bg-night-800" />
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-night-800" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 dark:text-slate-500 py-8">
          {t("revenue.empty")}
        </div>
      ) : (
        // Ro'yxat kartochka ichida scroll bo'ladi — kassirlar soni ko'paysa
        // kartochka cho'zilib, yonidagi donutni ham cho'zib yubormasligi uchun.
        <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
          {rows.map((row) => {
            const percent = total > 0 ? Math.round((row.amount / total) * 100) : 0;
            return (
              <div key={row.id || "unknown"} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 min-w-0">
                    <HiUserCircle className="text-slate-400 dark:text-slate-500 text-lg shrink-0" />
                    <span className="truncate">{row.name || t("revenue.collectorUnknown")}</span>
                    {row.role && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 truncate">
                        · {t(`revenue.roles.${row.role}`)}
                      </span>
                    )}
                    <span className="text-xs text-slate-300 dark:text-slate-600 shrink-0">
                      · {t("revenue.transactionCountTiny", { count: row.count })}
                    </span>
                  </span>
                  <NumberText className="text-sm shrink-0">{money(row.amount)}</NumberText>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-night-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500 w-9 text-right shrink-0">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-night-700 shrink-0">
          <span className="text-xs text-slate-400 dark:text-slate-500">{t("revenue.total")}</span>
          <span className="flex items-baseline gap-1 shrink-0">
            <NumberText className="text-base">{money(total)}</NumberText>
            <span className="text-xs text-slate-400 dark:text-slate-500">{t("student.somSuffix")}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default RevenueByCollector;
