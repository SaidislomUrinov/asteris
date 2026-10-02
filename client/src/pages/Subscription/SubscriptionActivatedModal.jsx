import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";

// To'lov tasdiqlangach chiqadigan tabriknoma — SubscribeModal/TariffsTab
// `subscription:activated` (socket) yoki polling orqali `paid` holatini
// ANIQLAGANDA ochadi. Dialog o'zi down->up+fade motion beradi (Motion
// siyosati: faqat Modal/Login). `open` bo'lgan har safar GIF boshidan
// qayta ishga tushishi uchun `key` bilan remount qilinadi.
function SubscriptionActivatedModal({ open, onClose, tariffName }) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title="" zIndex="z-40">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <img
          key={open ? "playing" : "idle"}
          src="/thanks.gif"
          alt=""
          className="w-40 h-40 object-contain rounded-xl"
        />

        <h3 className="text-lg font-bold text-slate-900">
          {t("subscription.activatedTitle")}
        </h3>
        <p className="text-sm text-slate-500 max-w-xs">
          {tariffName
            ? t("subscription.activatedBodyWithTariff", { tariff: tariffName })
            : t("subscription.activatedBody")}
        </p>

        <Button color="emerald" onClick={onClose} className="mt-2 w-full">
          {t("subscription.activatedCta")}
        </Button>
      </div>
    </Dialog>
  );
}

export default SubscriptionActivatedModal;
