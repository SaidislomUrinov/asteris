import { useTranslation } from "react-i18next";
import { HiClock, HiSparkles, HiGift, HiChevronRight } from "react-icons/hi2";
import { CoinIcon } from "../../components/CoinIcon";
import { useRoleT } from "../../hooks/useRoleT";
import { photoSrc } from "../../lib/studentPhoto";
import { monthName, shiftMonth } from "../../utils/format";

// Keyingi sovg'a: eng arzon, hali yetmayotgan mahsulot. Yetmasa — progress,
// hammasiga yetsa — "olish mumkin" xabari.
const pickGoal = (shop, balance) => {
  const list = (shop || []).filter((p) => p.stock !== 0);
  const target = list.filter((p) => p.price > balance).sort((a, b) => a.price - b.price)[0] || null;
  const affordable = list.filter((p) => p.price <= balance);
  return { target, affordable };
};

const GoalPanel = ({ shop, balance, onShop }) => {
  const { t } = useTranslation();
  const { target, affordable } = pickGoal(shop, balance);
  if (!target && !affordable.length) return null;
  const progress = target ? Math.min(100, Math.round((balance / target.price) * 100)) : 100;
  return (
    <button
      type="button"
      onClick={onShop}
      className="relative mt-4 w-full text-left flex flex-col gap-2 rounded-2xl p-3 bg-black/15 ring-1 ring-white/20 active:opacity-80"
    >
      <div className="flex items-center gap-2.5">
        <span className="w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-white/20 grid place-items-center">
          {target?.photo ? (
            <img src={photoSrc(target.photo)} alt="" className="w-full h-full object-cover" />
          ) : (
            <HiGift className="w-5 h-5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
            {target ? t("coins.goal.next") : t("coins.goal.ready")}
          </div>
          <div className="text-[14px] font-extrabold leading-tight break-words line-clamp-2">
            {target ? target.name : t("coins.goal.readyText", { n: affordable.length })}
          </div>
        </div>
        <HiChevronRight className="w-4 h-4 shrink-0 text-white/70" />
      </div>
      {target && (
        <>
          <div className="h-2 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full rounded-full bg-white min-w-2" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[12px] font-bold">
            <span className="tabular-nums">{t("coins.goal.left", { n: target.price - balance })}</span>
            <span className="inline-flex items-center gap-1 tabular-nums text-white/90">
              {balance} / {target.price}
              <CoinIcon size={13} />
            </span>
          </div>
        </>
      )}
    </button>
  );
};

// Balans kartasi — oltin gradient, katta raqam; ostida joriy oyda yig'ilayotgan
// tangalar (oy yakunida beriladi), keyingi sovg'a maqsadi va kutilayotgan buyurtmalar.
export const CoinHero = ({ wallet, shop, onHistory, onShop }) => {
  const { t } = useTranslation();
  const rt = useRoleT();
  const next = shiftMonth(wallet.month.month, 1);
  return (
    <div className="relative overflow-hidden rounded-3xl p-4 min-[380px]:p-5 text-white bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-[0_10px_28px_-10px_rgba(217,119,6,0.65)]">
      {/* Yorug'lik va tangalar — faqat bezak */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.35),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/50" />
      <CoinIcon size={150} className="absolute -right-10 -top-10 opacity-25 rotate-12" />
      <CoinIcon size={34} className="absolute right-16 top-24 opacity-25 -rotate-12" />
      <div className="relative">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/85 break-words pr-16">
          {wallet.center.name}
        </div>
        <div className="flex items-center gap-2.5 mt-2">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-white/20 ring-1 ring-white/40 shrink-0">
            <CoinIcon size={40} animated className="drop-shadow" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[44px] leading-none font-extrabold tabular-nums tracking-tight drop-shadow-sm">{wallet.balance}</span>
            <span className="text-[11px] font-bold tracking-[0.14em] text-white/85 mt-1">WECOIN</span>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-x-2 gap-y-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-amber-700 text-[12px] font-extrabold shadow-sm">
            <HiSparkles className="w-3.5 h-3.5" />
            {rt("coins.thisMonthEarning", { n: wallet.month.total })}
          </span>
          <span className="text-[11px] font-medium text-white/85">
            {t("coins.paidOn", { month: monthName(next) })}
          </span>
        </div>
        <GoalPanel shop={shop} balance={wallet.balance} onShop={onShop} />
        {wallet.pendingOrders > 0 && (
          <button
            type="button"
            onClick={onHistory}
            className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 text-[12px] font-bold active:opacity-75"
          >
            <HiClock className="w-3.5 h-3.5" />
            {t("coins.pendingOrders", { n: wallet.pendingOrders })}
          </button>
        )}
      </div>
    </div>
  );
};
