import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { HiArrowLeft, HiLockClosed } from "react-icons/hi2";

// Ruxsat yo'q yoki mavjud bo'lmagan sahifa URL orqali ochilganda — avval
// marshrut topilmay kontent butunlay bo'sh qolardi (faqat sarlavha).
// Ikkala holat bitta ekran: foydalanuvchi uchun natija bir xil — bu sahifa
// unga ochiq emas.
function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full gap-3 px-6 py-16 text-center">
      <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-night-800 text-2xl text-slate-400 dark:text-slate-500">
        <HiLockClosed aria-hidden="true" />
      </span>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{t("notFoundPage.title")}</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("notFoundPage.desc")}</p>
      <Link
        to="/dashboard"
        className="flex items-center gap-2 h-10 px-4 mt-1 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <HiArrowLeft aria-hidden="true" />
        {t("notFoundPage.back")}
      </Link>
    </div>
  );
}

export default NotFound;
