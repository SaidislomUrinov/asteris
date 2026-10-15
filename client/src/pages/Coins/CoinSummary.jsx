import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineClock, HiOutlineBuildingStorefront, HiOutlineArrowTrendingUp, HiExclamationTriangle } from "react-icons/hi2";
import CoinIcon from "../../ui/CoinIcon";
import Button from "../../ui/Button";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { api } from "../../utils/fetching";

const num = (n) => Number(n || 0).toLocaleString("ru-RU");

/**
 * Sahifa tepasidagi ixcham xulosa: kutilayotgan buyurtmalar, jami balans,
 * shu oy yig'ilayotgani, faol mahsulotlar. WECOIN o'chiq bo'lsa — banner.
 * Mavjud GET endpointlardan olinadi, socket hodisalarida yangilanadi.
 *
 * @param {Object} props
 * @param {string} props.centerId
 * @param {number} props.pending - OrdersTab hisoblagan kutilayotganlar soni
 * @param {boolean} props.canManage - `coin:manage`
 * @param {(tab: string) => void} props.onGo
 */
function CoinSummary({ centerId, pending, canManage, onGo }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null); // { enabled, balance, month, products }

  const load = useCallback(async () => {
    try {
      const [st, pr, se] = await Promise.all([
        api.get(`/coins/${centerId}/students`, { params: { page: 1 } }),
        api.get(`/shop/${centerId}/products`),
        api.get(`/coins/${centerId}/settings`),
      ]);
      setData({
        enabled: !!se.data?.data?.enabled,
        balance: st.data?.summary?.balance || 0,
        month: st.data?.summary?.month || 0,
        products: (pr.data?.data || []).filter((p) => p.isActive).length,
      });
    } catch {
      // xulosa ixtiyoriy — xatoda yashiriladi, asosiy tablar o'z holatini ko'rsatadi
    }
  }, [centerId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const refresh = useDebouncedCallback(load, 800);
  const same = (p) => (p?.order?.centerId || p?.centerId) === centerId && refresh();
  useSocketEvent("shop:order", same, !!centerId);
  useSocketEvent("shop:orderUpdated", same, !!centerId);
  useSocketEvent("shop:products", same, !!centerId);
  useSocketEvent("coin:settings", same, !!centerId);
  useSocketEvent("coin:distributed", same, !!centerId);

  const tiles = [
    {
      key: "pending",
      go: "orders",
      icon: HiOutlineClock,
      label: t("coins.sum.pending"),
      value: String(pending),
      tone: pending > 0 ? "amber" : "slate",
    },
    {
      key: "balance",
      go: "students",
      coin: true,
      label: t("coins.totalBalance"),
      value: data ? num(data.balance) : "—",
      tone: "slate",
    },
    {
      key: "month",
      go: "students",
      icon: HiOutlineArrowTrendingUp,
      label: t("coins.thisMonth"),
      value: data ? `+${num(data.month)}` : "—",
      tone: "emerald",
    },
    {
      key: "products",
      go: "shop",
      icon: HiOutlineBuildingStorefront,
      label: t("coins.sum.products"),
      value: data ? String(data.products) : "—",
      tone: "slate",
    },
  ];

  const ICON_TONE = {
    amber: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300",
    emerald: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    slate: "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400",
  };

  return (
    <div className="flex flex-col gap-3">
      {data && !data.enabled && (
        <div className="flex items-center gap-3 p-3 pr-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 max-sm:flex-wrap">
          <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300">
            <HiExclamationTriangle className="text-lg" />
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t("coins.sum.disabled")}</span>
            <span className="text-[12px] text-amber-700/80 dark:text-amber-300/70">{t("coins.sum.disabledText")}</span>
          </div>
          {canManage && (
            <Button color="orange" onClick={() => onGo("settings")} className="max-sm:w-full">
              {t("coins.sum.goRules")}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {tiles.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => onGo(x.go)}
            className={`flex items-center gap-3 p-3 max-sm:p-2.5 min-w-0 text-left rounded-2xl border cursor-pointer transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${
              x.tone === "amber"
                ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                : "bg-white dark:bg-night-900 border-slate-200/80 dark:border-night-700/80 hover:bg-slate-50 dark:hover:bg-night-800"
            }`}
          >
            <span className={`w-9 h-9 max-sm:w-8 max-sm:h-8 shrink-0 grid place-items-center rounded-xl ${x.coin ? "bg-amber-50 dark:bg-amber-500/15" : ICON_TONE[x.tone]}`}>
              {x.coin ? <CoinIcon size={20} /> : <x.icon className="text-lg" />}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-xl max-sm:text-lg font-space font-bold leading-none tabular-nums text-slate-900 dark:text-slate-100 truncate">
                {x.value}
              </span>
              <span className="mt-1 text-[12px] text-slate-500 dark:text-slate-400 max-sm:line-clamp-2 sm:truncate leading-tight">{x.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CoinSummary;
