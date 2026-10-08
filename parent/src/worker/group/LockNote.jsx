import { useTranslation } from "react-i18next";
import { HiOutlineLockClosed } from "react-icons/hi2";

// Tanlangan kunda yozish yopiq bo'lsa — sababi (dam olish, kelajak,
// o'qituvchi chegarasi, faqat ko'rish rejimi...).
export const LockNote = ({ reason }) => {
  const { t } = useTranslation();
  if (!reason) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-ink/6 text-hint px-3.5 py-2.5 text-[13px] font-semibold">
      <HiOutlineLockClosed className="w-4.5 h-4.5 shrink-0 mt-px" />
      <span className="min-w-0 break-words">{t(`worker.group.lock.${reason}`)}</span>
    </div>
  );
};
