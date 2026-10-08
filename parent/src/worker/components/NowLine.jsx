import { useTranslation } from "react-i18next";

// Qizil "hozir" chizig'i — joriy Toshkent vaqti bilan.
export const NowLine = ({ time }) => {
  const { t } = useTranslation();
  return (
    <div className="relative z-[1] grid grid-cols-[44px_minmax(0,1fr)] items-center" aria-label={t("worker.today.now")}>
      <span className="tabular text-[11px] font-extrabold text-bad">{time}</span>
      <i className="relative h-0.5 rounded-full bg-bad ml-1">
        <span className="absolute left-1 -top-[3px] w-2 h-2 rounded-full bg-bad" />
      </i>
    </div>
  );
};
