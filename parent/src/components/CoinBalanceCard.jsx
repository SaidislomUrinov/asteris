import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiChevronRight } from "react-icons/hi2";
import { CoinIcon } from "./CoinIcon";
import { useRequest } from "../hooks/useRequest";
import { useRoleT } from "../hooks/useRoleT";
import { getCoins } from "../api/parent";

// Bosh sahifadagi WECOIN qisqa kartasi — jami balans va shu oy yig'ilayotgani.
// WECOIN yoqilgan filial bo'lmasa umuman chiqmaydi.
export const CoinBalanceCard = () => {
  const { t } = useTranslation();
  const rt = useRoleT();
  const navigate = useNavigate();
  const { data } = useRequest(() => getCoins(), []);
  const wallets = data?.wallets || [];
  if (!wallets.length) return null;
  const balance = wallets.reduce((s, w) => s + w.balance, 0);
  const month = wallets.reduce((s, w) => s + w.month.total, 0);
  return (
    <button
      type="button"
      onClick={() => navigate("/coins")}
      className="flex items-center gap-3 w-full text-left rounded-2xl p-3.5 bg-gradient-to-r from-amber-400/15 to-orange-500/10 border border-amber-400/30 active:scale-[0.985] transition-transform"
    >
      <CoinIcon size={40} animated />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">WECOIN</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[22px] font-extrabold tabular-nums leading-tight">{balance}</span>
          {month > 0 && (
            <span className="text-[12px] font-bold text-ok">{rt("coins.thisMonthEarning", { n: month })}</span>
          )}
        </div>
      </div>
      <span className="text-[12px] font-bold text-amber-700 dark:text-amber-300 shrink-0">{t("coins.toShop")}</span>
      <HiChevronRight className="w-4 h-4 text-amber-600/70 shrink-0" />
    </button>
  );
};
