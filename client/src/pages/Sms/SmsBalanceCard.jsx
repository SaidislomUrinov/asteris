import { useTranslation } from "react-i18next";
import { HiChatBubbleLeftRight, HiExclamationTriangle, HiShoppingCart } from "react-icons/hi2";
import Button from "../../ui/Button";
import { fmtNum, fmtUnixDate } from "./smsFormat";

const TONES = {
  ok: {
    box: "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10",
    icon: "bg-blue-500 text-white",
    line: "text-slate-600 dark:text-slate-300",
  },
  low: {
    box: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10",
    icon: "bg-amber-500 text-white",
    line: "text-amber-700 dark:text-amber-300",
  },
  empty: {
    box: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10",
    icon: "bg-red-500 text-white",
    line: "text-red-600 dark:text-red-400",
  },
};

// Balans kartasi (hero): jami qoldiq, eng yaqin tugash va "Paket sotib olish" (faqat Owner).
function SmsBalanceCard({ balance, loading, isOwner, onBuy, lowLimit = 10 }) {
  const { t } = useTranslation();
  const total = balance?.total ?? 0;
  const maxBought = Math.max(0, ...(balance?.purchases || []).map((p) => p.smsCount || 0));
  const empty = !loading && total === 0;
  const low = !loading && !empty && maxBought > 0 && total < (maxBought * lowLimit) / 100;
  const tone = TONES[empty ? "empty" : low ? "low" : "ok"];
  const nearest = balance?.nearestExpiry;
  const warn = empty || low;
  const WarnIcon = warn ? HiExclamationTriangle : HiChatBubbleLeftRight;

  const expiryLine = nearest
    ? t("sms.nearestExpiry", { count: fmtNum(nearest.count), date: fmtUnixDate(nearest.at) })
    : balance?.purchases?.length
      ? t("sms.unlimited")
      : "";

  return (
    <div className={`flex flex-col justify-between gap-3 p-4 rounded-2xl border ${tone.box}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tone.icon}`}>
            <WarnIcon className="text-xl" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("sms.balanceTitle")}</span>
            {loading ? (
              <div className="h-10 w-32 mt-1 rounded-lg bg-slate-200 dark:bg-night-700 animate-pulse" />
            ) : (
              <span className="text-4xl font-bold leading-tight text-slate-900 dark:text-slate-50">
                {fmtNum(total)} <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">{t("sms.balanceUnit")}</span>
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="shrink-0">
            <Button onClick={onBuy} color={empty ? "red" : low ? "orange" : undefined} className="gap-1.5 w-full sm:w-auto">
              <HiShoppingCart className="text-base" />
              {t("sms.buyPackage")}
            </Button>
          </div>
        )}
      </div>

      {!loading && (warn || expiryLine) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {warn && <span className={`text-sm font-semibold ${tone.line}`}>{empty ? t("sms.balanceEmpty") : t("sms.balanceLow")}</span>}
          {expiryLine && !empty && <span className="text-xs text-slate-500 dark:text-slate-400">{expiryLine}</span>}
        </div>
      )}
    </div>
  );
}

export default SmsBalanceCard;
