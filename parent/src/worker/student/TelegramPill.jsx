import { useTranslation } from "react-i18next";
import { HiOutlinePaperAirplane } from "react-icons/hi2";
import { cn } from "../../utils/cn";

// Telegram juft belgisi (client StudentDetail bilan bir xil manba:
// `studentTelegram` / `parentTelegram` = "linked" | "none").
export const TelegramPill = ({ who, status }) => {
  const { t } = useTranslation();
  const linked = status === "linked";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 h-6 rounded-full whitespace-nowrap text-[11px] font-bold",
        linked ? "bg-accent/10 text-accent" : "bg-ink/6 text-hint",
      )}
    >
      <HiOutlinePaperAirplane className="w-3.5 h-3.5" />
      {t(`worker.student.tg.${who}`)} · {t(linked ? "worker.student.tg.linked" : "worker.student.tg.none")}
    </span>
  );
};
