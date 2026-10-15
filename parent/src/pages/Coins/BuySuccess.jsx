import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiCheck } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Confetti } from "../../components/Confetti";
import { photoSrc } from "../../lib/studentPhoto";

// Xarid muvaffaqiyatli — konfetti bilan bayram oynasi (pastdan yuqoriga + fade).
export const BuySuccess = ({ order, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!order) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, onClose]);
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45 animate-overlay-in" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-card text-ink rounded-t-3xl sm:rounded-3xl p-5 pt-7 animate-dialog-in flex flex-col items-center text-center"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <div className="relative w-24 h-24">
          <div className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.45),transparent_70%)]" />
          <Confetti tone={1} />
          {order.productPhoto ? (
            <img src={photoSrc(order.productPhoto)} alt="" className="relative w-24 h-24 rounded-3xl object-cover ring-2 ring-amber-400/70" />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-ok-bg text-ok grid place-items-center">
              <HiCheck className="w-12 h-12" />
            </div>
          )}
        </div>
        <div className="font-title text-xl font-extrabold mt-4">{t("coins.successTitle")}</div>
        <div className="text-sm text-hint mt-1.5 max-w-[30ch]">{t("coins.successText", { name: order.productName })}</div>
        <div className="flex gap-2.5 mt-5 w-full">
          <Button
            variant="soft"
            onClick={() => {
              onClose();
              navigate("/coins?tab=history", { replace: true });
            }}
          >
            {t("coins.toHistory")}
          </Button>
          <Button onClick={onClose}>{t("coins.great")}</Button>
        </div>
      </div>
    </div>
  );
};
