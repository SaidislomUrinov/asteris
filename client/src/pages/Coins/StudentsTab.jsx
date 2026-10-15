import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass, HiOutlineUsers } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Avatar from "../../ui/Avatar";
import RowNumber from "../../ui/RowNumber";
import RankMedal from "../../ui/RankMedal";
import CoinAmount from "./CoinAmount";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

/**
 * O'quvchilar balansi — balans bo'yicha reyting + joriy oyda yig'ilayotgan taxmin.
 *
 * @param {Object} props
 * @param {string} props.centerId
 */
function StudentsTab({ centerId }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const applySearch = useDebouncedCallback((v) => setQuery(v), 350);

  const load = useCallback(
    async (page = 1) => {
      try {
        setError(false);
        const res = await api.get(`/coins/${centerId}/students`, { params: { search: query, page } });
        const { ok, data, meta: m, msg } = res.data;
        if (!ok) throw new Error(msg);
        setRows((prev) => (page === 1 ? data : [...prev, ...data]));
        setMeta(m);
      } catch (err) {
        errorMsg(err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [centerId, query],
  );

  useEffect(() => {
    const id = setTimeout(() => load(1), 0);
    return () => clearTimeout(id);
  }, [load]);

  // Xarid/qaytarish/tarqatish balansni o'zgartiradi.
  const refresh = (p) => (p?.order?.centerId || p?.centerId) === centerId && load(1);
  useSocketEvent("shop:order", refresh, !!centerId);
  useSocketEvent("shop:orderUpdated", refresh, !!centerId);
  useSocketEvent("coin:distributed", refresh, !!centerId);

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-56 max-w-sm max-sm:max-w-none">
          <Input
            icon={<HiMagnifyingGlass />}
            placeholder={t("coins.searchStudent")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              applySearch(e.target.value.trim());
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-night-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={() => load(1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-14 text-slate-400 dark:text-slate-500">
          <HiOutlineUsers className="text-3xl text-slate-300 dark:text-slate-600" />
          <span className="text-sm">{t("coins.studentsEmpty")}</span>
        </div>
      ) : (
        <div className="flex flex-col rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 overflow-hidden">
          <div className="grid grid-cols-[2.25rem_1fr_6rem_6rem] max-sm:grid-cols-[2rem_1fr_4.5rem_4.5rem] gap-3 px-4 max-sm:px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-night-800">
            <span>#</span>
            <span>{t("coins.student")}</span>
            <span className="text-right">{t("coins.balance")}</span>
            <span className="text-right">{t("coins.thisMonthShort")}</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.student._id}
              className={`grid grid-cols-[2.25rem_1fr_6rem_6rem] max-sm:grid-cols-[2rem_1fr_4.5rem_4.5rem] gap-3 items-center px-4 max-sm:px-3 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-night-800 ${
                i < 3 && !query && r.balance > 0 ? "bg-amber-50/50 dark:bg-amber-500/5" : ""
              }`}
            >
              {i < 3 && !query && r.balance > 0 ? (
                <span className="grid place-items-center">
                  <RankMedal position={i + 1} size={18} animated={false} />
                </span>
              ) : (
                <span className="grid place-items-center">
                  <RowNumber value={i + 1} />
                </span>
              )}
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar user={{ _id: r.student._id, name: r.student.fullName, avatar: r.student.photo }} size={30} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.student.fullName}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums truncate">
                    {t("coins.earnedSpent", { earned: r.earned, spent: r.spent })}
                  </span>
                </div>
              </div>
              <CoinAmount value={r.balance} size={14} className="justify-end text-sm" />
              <span className="text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {r.month ? `+${r.month}` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
      {!loading && meta.page < meta.totalPages && (
        <div className="flex justify-center">
          <Button variant="outlined" color="slate" onClick={() => load(meta.page + 1)}>
            {t("coins.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default StudentsTab;
