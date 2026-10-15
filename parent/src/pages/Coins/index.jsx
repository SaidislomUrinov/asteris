import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { HiOutlineSparkles } from "react-icons/hi2";
import { Page } from "../../components/Page";
import { SegmentTabs } from "../../components/SegmentTabs";
import { EmptyState, ErrorState } from "../../components/States";
import { Skeleton } from "../../components/Skeleton";
import { CoinHero } from "./CoinHero";
import { ShopTab } from "./ShopTab";
import { HistoryTab } from "./HistoryTab";
import { EarnTab } from "./EarnTab";
import { useAuth } from "../../contexts/auth";
import { useRequest } from "../../hooks/useRequest";
import { getCoins, getCoinShop, invalidateCoins } from "../../api/parent";
import { cn } from "../../utils/cn";

const TABS = ["shop", "earn", "history"];

// WECOIN — filial bo'yicha tangalar, do'kon va tarix (docs/API_CONTRACT_wecoin.md §4).
// Bir nechta filial (yoki ota-onada bir nechta farzand) bo'lsa — yuqorida tanlov.
export const Coins = () => {
  const { t } = useTranslation();
  const { isStudent } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload, mutate } = useRequest(() => getCoins(true), []);
  const wallets = useMemo(() => data?.wallets || [], [data]);
  const [key, setKey] = useState("");
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "shop";
  const setTab = (v) => setParams({ tab: v }, { replace: true });

  const keyOf = (w) => `${w.student._id}:${w.center._id}`;
  const wallet = wallets.find((w) => keyOf(w) === key) || wallets[0] || null;
  const manyStudents = new Set(wallets.map((w) => w.student._id)).size > 1;

  // Do'kon ma'lumoti shu yerda — Hero "keyingi sovg'a" maqsadini ham, ShopTab ham ishlatadi.
  const sid = wallet?.student._id;
  const cid = wallet?.center._id;
  const shop = useRequest(() => getCoinShop(sid, cid), [sid, cid], { enabled: !!wallet });

  // Kesh eskirmasin — sahifadan chiqqach bosh sahifa/tab bar yangidan o'qiydi.
  useEffect(() => invalidateCoins, []);

  const onBought = (balance) =>
    mutate((d) => ({
      ...d,
      wallets: d.wallets.map((w) =>
        keyOf(w) === keyOf(wallet)
          ? { ...w, balance, spent: w.spent + (w.balance - balance), pendingOrders: w.pendingOrders + 1 }
          : w,
      ),
    }));

  return (
    <Page title="WECOIN">
      {loading ? (
        <>
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-9 rounded-xl" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="aspect-[3/4] rounded-2xl" />
            <Skeleton className="aspect-[3/4] rounded-2xl" />
          </div>
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !wallet ? (
        <EmptyState icon={HiOutlineSparkles} title={t("coins.notEnabled")} text={t("coins.notEnabledText")} />
      ) : (
        <>
          {wallets.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {wallets.map((w) => (
                <button
                  key={keyOf(w)}
                  type="button"
                  onClick={() => setKey(keyOf(w))}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap border transition-colors",
                    keyOf(w) === keyOf(wallet) ? "bg-ink text-bg border-ink" : "bg-card text-hint border-line",
                  )}
                >
                  {manyStudents ? `${w.student.fullName.split(" ")[0]} · ${w.center.name}` : w.center.name}
                </button>
              ))}
            </div>
          )}

          <CoinHero wallet={wallet} shop={shop.data} onHistory={() => setTab("history")} onShop={() => setTab("shop")} />

          <SegmentTabs
            items={TABS.map((v) => ({ value: v, label: t(`coins.tabs.${v}`) }))}
            value={tab}
            onChange={setTab}
          />

          {tab === "shop" && <ShopTab key={keyOf(wallet)} wallet={wallet} shop={shop} canBuy={isStudent} onBought={onBought} />}
          {tab === "earn" && <EarnTab wallet={wallet} />}
          {tab === "history" && <HistoryTab key={keyOf(wallet)} wallet={wallet} />}
        </>
      )}
    </Page>
  );
};
