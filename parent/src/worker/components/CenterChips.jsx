import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { useWorker } from "../useWorker";
import { rememberWorkerCenter } from "../api";

// Owner: filial tanlovi ("Barcha filiallar" + har filial). Ko'p filialli
// hodim: faqat o'z filiallari, "Barchasi"siz — hodim bir vaqtda BITTA
// filialda ishlaydi (docs/API_CONTRACT_multi_center.md §6); almashtirilganda
// sahifa qayta yuklanadi (socket yangi filial xonasiga ulanadi).
// Bitta filial bo'lsa ko'rsatilmaydi.
export const CenterChips = () => {
  const { t } = useTranslation();
  const { me, isOwner, centerId, setCenterId } = useWorker();
  const centers = me?.centers || [];
  if (centers.length < 2) return null;
  const items = isOwner ? [{ _id: "", name: t("worker.allCenters") }, ...centers] : centers;
  const select = async (id) => {
    if (isOwner) return setCenterId(id);
    if (id === centerId) return;
    // CloudStorage'ga yozilishini kutamiz (muddat bilan), so'ng reload.
    await rememberWorkerCenter(me?._id, id);
    window.location.reload();
  };
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
      {items.map((c) => (
        <button
          key={c._id || "all"}
          type="button"
          onClick={() => select(c._id)}
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
