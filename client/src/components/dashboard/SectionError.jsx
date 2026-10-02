import { useTranslation } from "react-i18next";
import { HiArrowPath, HiExclamationTriangle } from "react-icons/hi2";

/**
 * Bosh sahifa bo'limi yuklanmay qolganda — bo'sh holat ("Bugun dars yo'q")
 * bilan adashtirmaslik uchun alohida xato bloki va "Qayta urinish".
 *
 * @param {Object} props
 * @param {string} props.message
 * @param {() => void} props.onRetry
 */
function SectionError({ message, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-50 text-lg text-rose-500">
        <HiExclamationTriangle aria-hidden="true" />
      </span>
      <p className="text-sm text-slate-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <HiArrowPath aria-hidden="true" />
        {t("common.retry")}
      </button>
    </div>
  );
}

export default SectionError;
