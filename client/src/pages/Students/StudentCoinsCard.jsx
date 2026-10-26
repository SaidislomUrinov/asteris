import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import MetricCard from "../../ui/MetricCard";
import CoinIcon from "../../ui/CoinIcon";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

/**
 * O'quvchi detali — WECOIN balansi (docs/API_CONTRACT_wecoin.md §3,
 * `GET /coins/student/:id`). Ruxsat/tarif yo'q yoki filialda WECOIN
 * ishlamagan bo'lsa umuman chiqmaydi. Bir nechta filial — har biri alohida qator.
 *
 * @param {Object} props
 * @param {string} props.studentId
 */
function StudentCoinsCard({ studentId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const hasFeature = useFeature();
  const allowed = can("coin:view") && hasFeature("gamification.coins");
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/coins/student/${studentId}`);
      if (res.data.ok) setData(res.data.data);
    } catch {
      // ikkinchi darajali karta — jim
    }
  }, [studentId]);

  useEffect(() => {
    if (!allowed) return;
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [allowed, load]);

  // Xarid/qaytarish/oy yakuni — balans o'zgaradi.
  const refresh = (p) => (p?.order ? p.order.student?._id === studentId && load() : load());
  useSocketEvent("shop:order", refresh, allowed);
  useSocketEvent("shop:orderUpdated", refresh, allowed);
  useSocketEvent("coin:distributed", refresh, allowed);
  useSocketEvent("coin:adjusted", refresh, allowed);

  if (!allowed || !data?.centers?.length) return null;
  const many = data.centers.length > 1;
  const open = (centerId) => navigate(`/coins?tab=students&center=${centerId}`);

  return (
    <button type="button" onClick={() => open(data.centers[0].center._id)} className="text-left cursor-pointer">
      <MetricCard
        icon={<CoinIcon size={22} animated />}
        title="WECOIN"
        subtitle={data.month > 0 ? t("coins.monthPlus", { n: data.month }) : many ? null : data.centers[0].center.name}
        value={data.balance.toLocaleString("ru-RU")}
        accent="amber"
        className="h-full hover:border-amber-300 dark:hover:border-amber-500/40 transition-colors"
      >
        {many && (
          <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 dark:border-night-700">
            {data.centers.map((c) => (
              <div key={c.center._id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate text-slate-500 dark:text-slate-400">{c.center.name}</span>
                <span className="inline-flex items-center gap-1 shrink-0 font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  <CoinIcon size={13} />
                  {c.balance}
                </span>
              </div>
            ))}
          </div>
        )}
      </MetricCard>
    </button>
  );
}

export default StudentCoinsCard;
