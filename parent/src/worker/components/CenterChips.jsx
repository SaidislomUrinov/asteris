import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { useWorker } from "../useWorker";

// Owner: filial tanlovi ("Barcha filiallar" + har filial). Bitta filial
// bo'lsa ko'rsatilmaydi.
export const CenterChips = () => {
  const { t } = useTranslation();
  const { me, isOwner, centerId, setCenterId } = useWorker();
  const centers = me?.centers || [];
  if (!isOwner || centers.length < 2) return null;
  const items = [{ _id: "", name: t("worker.allCenters") }, ...centers];
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
      {items.map((c) => (
        <button
          key={c._id || "all"}
          type="button"
          onClick={() => setCenterId(c._id)}
          className={cn(
            "shrink-0 px-3 h-8 rounded-full text-[13px] font-bold border transition-colors",
            centerId === c._id ? "bg-ink text-bg border-ink" : "bg-card text-hint border-line",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
};
