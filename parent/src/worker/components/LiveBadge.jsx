import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

// "Jonli" (socket ulangan) / "Oflayn" belgisi.
export const LiveBadge = ({ live }) => {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex items-center gap-1.5 tracking-[0.04em]", live ? "text-ok" : "text-hint")}>
      <i className={cn("w-1.5 h-1.5 rounded-full", live ? "bg-ok" : "bg-hint")} />
      {t(live ? "worker.live" : "worker.offline")}
    </span>
  );
};
