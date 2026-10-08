import { useTranslation } from "react-i18next";
import { HiOutlineLockClosed } from "react-icons/hi2";

// Obuna tugagan — faqat ko'rish rejimi izohi (§2).
export const ReadOnlyNote = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-warn-bg text-warn px-3.5 py-3">
      <HiOutlineLockClosed className="w-5 h-5 shrink-0 mt-px" />
      <div className="min-w-0">
        <div className="text-sm font-extrabold">{t("worker.readOnly.title")}</div>
        <div className="text-[13px] opacity-90">{t("worker.readOnly.text")}</div>
      </div>
    </div>
  );
};
