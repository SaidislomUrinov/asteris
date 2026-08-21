import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { HiExclamationTriangle } from "react-icons/hi2";

// Staff (Reception/Manager/Teacher) uchun — markazning Client Owner'i obunani
// yangilamaguncha tizim Read-Only (backend `requireActiveSubscription`).
// Staff obunani o'zi boshqara olmagani uchun bu modal MAJBURIY va YOPILMAYDI
// (X tugma, ESC, tashqariga bosish — hech biri ishlamaydi) — faqat direktor
// obunani yangilab, sahifa qayta yuklangach yo'qoladi.
function SubscriptionBlockedModal() {
  const { t } = useTranslation();
  const { authType, subscriptionActive } = useSelector((e) => e.user);

  if (authType !== "staff" || subscriptionActive !== false) return null;

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-3xl">
          <HiExclamationTriangle />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">
          {t("subscriptionBlocked.title")}
        </h3>
        <p className="text-sm text-slate-500">{t("subscriptionBlocked.message")}</p>
      </div>
    </div>,
    document.body,
  );
}

export default SubscriptionBlockedModal;
