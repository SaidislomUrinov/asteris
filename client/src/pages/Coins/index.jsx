import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiShoppingBag, HiBuildingStorefront, HiUsers, HiAdjustmentsHorizontal, HiBuildingOffice2 } from "react-icons/hi2";
import Select from "../../ui/Select";
import OrdersTab from "./OrdersTab";
import ProductsTab from "./ProductsTab";
import StudentsTab from "./StudentsTab";
import SettingsTab from "./SettingsTab";
import CoinSummary from "./CoinSummary";
import useCan from "../../hooks/useCan";
import useQueryState from "../../hooks/useQueryState";
import { api } from "../../utils/fetching";

/**
 * WECOIN — filial tangalari va do'koni (docs/API_CONTRACT_wecoin.md §3).
 * Tablar: Buyurtmalar (realtime) · Do'kon · O'quvchilar · Qoidalar.
 * Owner bir nechta filialga ega bo'lsa — filial tanlovi; hodim faqat o'z filiali.
 */
function Coins() {
  const { t } = useTranslation();
  const can = useCan();
  const canManage = can("coin:manage");
  const [tab, setTab] = useQueryState("tab", "orders");
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useQueryState("center", "");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get("/centers", { params: { page: 1 } });
        if (!res.data.ok) return;
        const list = (res.data.data || []).filter((c) => c.status !== "blocked");
        setCenters(list);
        if (list.length && !list.some((c) => c._id === centerId)) setCenterId(list[0]._id);
      } catch {
        // filiallar ro'yxati — bo'sh holat ko'rsatiladi
      } finally {
        setLoading(false);
      }
    };
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPendingChange = useCallback((n) => setPending(n), []);

  const tabs = [
    { key: "orders", label: t("coins.tabs.orders"), icon: HiShoppingBag, badge: pending },
    { key: "shop", label: t("coins.tabs.shop"), icon: HiBuildingStorefront },
    { key: "students", label: t("coins.tabs.students"), icon: HiUsers },
    { key: "settings", label: t("coins.tabs.settings"), icon: HiAdjustmentsHorizontal },
  ];
  const active = tabs.some((x) => x.key === tab) ? tab : "orders";

  if (loading) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="h-11 w-96 max-w-full rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
        <div className="h-40 rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
      </div>
    );
  }

  if (!centers.length || !centerId) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 py-16 text-slate-400 dark:text-slate-500">
        <HiBuildingOffice2 className="text-4xl text-slate-300 dark:text-slate-600" />
        <span className="text-sm">{t("coins.noCenter")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full flex-1 min-w-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          role="tablist"
          className="grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-2xl max-sm:w-full bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none"
        >
          {tabs.map((tb) => {
            const { key, label, badge } = tb;
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className={`relative flex max-sm:flex-col items-center justify-center gap-1 sm:gap-2 max-sm:h-14 sm:h-9 sm:px-3.5 min-w-0 whitespace-nowrap rounded-xl max-sm:text-[11px] text-sm font-semibold cursor-pointer transition-colors duration-150 ${
                  on
                    ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-night-800"
                }`}
              >
                <tb.icon className={`text-lg sm:text-base shrink-0 ${on ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                <span className="max-w-full truncate">{label}</span>
                {badge > 0 && (
                  <span className="max-sm:absolute max-sm:top-1 max-sm:right-1.5 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-amber-500 text-white text-[11px] font-bold tabular-nums">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {centers.length > 1 && (
          <div className="ml-auto w-56 max-sm:w-full">
            <Select
              value={centerId}
              onChange={setCenterId}
              icon={<HiBuildingOffice2 />}
              options={centers.map((c) => ({ value: c._id, label: c.name }))}
            />
          </div>
        )}
      </div>

      <CoinSummary centerId={centerId} pending={pending} canManage={canManage} onGo={setTab} />

      {/* Buyurtmalar tabi doim tirik — boshqa tabda turganda ham yangi xarid sanog'i yangilanadi. */}
      <div className={active === "orders" ? "flex flex-col flex-1" : "hidden"}>
        <OrdersTab key={centerId} centerId={centerId} canManage={canManage} onPendingChange={onPendingChange} />
      </div>
      {active === "shop" && <ProductsTab key={centerId} centerId={centerId} canManage={canManage} />}
      {active === "students" && <StudentsTab key={centerId} centerId={centerId} />}
      {active === "settings" && <SettingsTab key={centerId} centerId={centerId} canManage={canManage} />}
    </div>
  );
}

export default Coins;
