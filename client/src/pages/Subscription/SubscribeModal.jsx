import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle } from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { DURATION_OPTIONS, calcAmount } from "./durationOptions";

function SubscribeModal({ open, onClose, tariff, onActivated }) {
  const { t } = useTranslation();
  const [months, setMonths] = useState(DURATION_OPTIONS[0].months);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleProceed = async () => {
    if (!tariff?._id) return;
    try {
      setLoading(true);
      const res = await api.post("/client-auth/subscription/initiate", {
        tariffId: tariff._id,
        months,
      });
      const { ok, activated, payUrl, orderId, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      if (payUrl) {
        if (orderId) localStorage.setItem("pendingSubscriptionOrderId", orderId);
        window.location.assign(payUrl);
      } else if (activated) {
        onActivated?.(data);
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("subscription.modalTitle")}
      actions={
        <>
          <Button variant="outlined" color="slate" onClick={handleClose} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button color="blue" onClick={handleProceed} loading={loading}>
            {t("subscription.proceedToPayment")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
        {t("subscription.selectDuration")}
      </p>
      <div className="flex flex-col gap-2">
        {DURATION_OPTIONS.map((opt) => {
          const total = calcAmount(tariff?.price || 0, opt.months, opt.discount);
          const selected = months === opt.months;
          return (
            <button
              key={opt.months}
              type="button"
              onClick={() => setMonths(opt.months)}
              className={`flex items-center justify-between w-full p-3 rounded-lg border-2 duration-150 cursor-pointer text-left ${
                selected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                  : "border-slate-200 dark:border-night-700 hover:border-blue-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {selected ? (
                  <HiCheckCircle className="text-blue-500 text-lg shrink-0" />
                ) : (
                  <span className="w-[18px] h-[18px] rounded-full border border-slate-300 dark:border-night-600 shrink-0" />
                )}
                <span className="font-semibold text-slate-800 dark:text-slate-100">{t(opt.labelKey)}</span>
                {opt.discount > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {t("subscription.discountBadge", {
                      percent: Math.round(opt.discount * 100),
                    })}
                  </span>
                )}
              </div>
              <span className="flex flex-col items-end">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {total.toLocaleString("uz-UZ")} {t("subscription.somSuffix")}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {Math.round(total / opt.months).toLocaleString("uz-UZ")}{" "}
                  {t("subscription.perMonth")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 dark:border-night-700 text-sm">
        <span className="text-slate-500 dark:text-slate-400">{t("subscription.totalPrice")}</span>
        <span className="flex flex-col items-end">
          <span className="font-space font-bold text-lg text-slate-800 dark:text-slate-100">
            {calcAmount(
              tariff?.price || 0,
              months,
              DURATION_OPTIONS.find((o) => o.months === months)?.discount || 0,
            ).toLocaleString("uz-UZ")}{" "}
            {t("subscription.somSuffix")}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {Math.round(
              calcAmount(
                tariff?.price || 0,
                months,
                DURATION_OPTIONS.find((o) => o.months === months)?.discount || 0,
              ) / months,
            ).toLocaleString("uz-UZ")}{" "}
            {t("subscription.perMonth")}
          </span>
        </span>
      </div>
    </Dialog>
  );
}

export default SubscribeModal;
