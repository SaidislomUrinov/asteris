import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { fmtNum } from "./smsFormat";

export const PENDING_SMS_ORDER_KEY = "pendingSmsOrderId";

// Paket sotib olish: faol paketlar grid, tanlash → inPAY'ga o'tish.
function BuyPackageDialog({ open, onClose }) {
  const { t } = useTranslation();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/sms/packages");
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setPackages(data || []);
        setPicked((cur) => cur || data?.[0]?._id || null);
      } catch (error) {
        errorMsg(error.message);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [open]);

  const handleClose = () => {
    if (!paying) onClose();
  };

  const pay = async () => {
    if (!picked) return;
    try {
      setPaying(true);
      const res = await api.post(`/sms/packages/${picked}/buy`);
      const { ok, payUrl, orderId, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (orderId) localStorage.setItem(PENDING_SMS_ORDER_KEY, orderId);
      window.location.assign(payUrl);
    } catch (error) {
      errorMsg(error.message);
      setPaying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("sms.packagesTitle")}
      widthClass="md:w-200"
      actions={
        <>
          <Button variant="outlined" color="slate" onClick={handleClose} disabled={paying}>
            {t("common.cancel")}
          </Button>
          <Button loading={paying} disabled={!picked} onClick={pay}>
            {t("sms.pay")}
          </Button>
        </>
      }
    >
      {loading && packages.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-center py-6 text-slate-400 dark:text-slate-500">{t("sms.packagesEmpty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((p) => {
            const selected = picked === p._id;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => setPicked(p._id)}
                className={`flex flex-col gap-3 p-4 rounded-2xl border-2 text-left cursor-pointer duration-150 ${
                  selected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                    : "border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 hover:border-blue-300 dark:hover:border-blue-500/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{p.name}</span>
                  {selected ? (
                    <HiCheckCircle className="text-blue-500 text-xl shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-night-600 shrink-0" />
                  )}
                </div>
                <span className="text-3xl font-bold leading-none text-slate-900 dark:text-slate-50">
                  {fmtNum(p.smsCount)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("sms.balanceUnit")}</span>
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {fmtNum(p.price)} {t("sms.som")}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("sms.pricePerSms", { price: fmtNum(Math.round(p.pricePerSms ?? p.price / p.smsCount)) })}
                  </span>
                </div>
                <span className="self-start px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300">
                  {p.validityDays > 0 ? t("sms.validity", { count: p.validityDays }) : t("sms.unlimited")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

export default BuyPackageDialog;
