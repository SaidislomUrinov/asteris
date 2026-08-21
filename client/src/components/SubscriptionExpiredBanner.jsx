import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiExclamationTriangle } from "react-icons/hi2";
import Button from "../ui/Button";

// CLAUDE.md "Subscription hayotiy sikli": obuna muddati tugasa markaz
// Read-Only'ga o'tadi (backend `requireActiveSubscription` orqali barcha
// create/update/delete bloklaydi). Bu banner shu holatni Client Owner'ga
// ko'rinadigan qilib, "Obunani yangilash"ga bevosita yo'naltiradi — Staff
// obunani o'zi boshqara olmagani uchun faqat Owner'ga ko'rsatiladi.
function SubscriptionExpiredBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { authType, subscription } = useSelector((e) => e.user);

  if (authType !== "owner") return null;
  if (pathname === "/subscription") return null;

  const now = Math.floor(new Date().getTime() / 1000);
  const expired = !subscription || subscription.status !== "active" || subscription.endDate <= now;
  if (!expired) return null;

  return (
    <div className="flex items-center gap-3 w-full px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700">
      <HiExclamationTriangle className="text-lg shrink-0" />
      <p className="text-sm font-medium flex-1">{t("subscription.expiredBannerText")}</p>
      <Button color="red" className="shrink-0 !py-1.5 !px-3 text-sm" onClick={() => navigate("/subscription")}>
        {t("subscription.renewNow")}
      </Button>
    </div>
  );
}

export default SubscriptionExpiredBanner;
