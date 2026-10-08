import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { HiOutlineBell, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";

const BTN = "relative w-10 h-10 rounded-full bg-card border border-line/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] grid place-items-center text-ink active:opacity-70 shrink-0";

// Har sahifa sarlavhasining o'ng tomoni (details §1): qidiruv (faqat
// `student:view` yoki `group:view`) va Xabarlar qo'ng'iroqchasi (o'qilmaganlar).
export const HeaderActions = () => {
  const { t } = useTranslation();
  const { can, unread } = useWorker();
  const canSearch = can("student:view") || can("group:view");
  const badge = unread > 0 ? (unread > 99 ? "99+" : unread) : null;
  return (
    <div className="flex items-center gap-2 shrink-0">
      {canSearch && (
        <Link to="/search" onClick={() => haptic("light")} aria-label={t("worker.search.title")} className={BTN}>
          <HiOutlineMagnifyingGlass className="w-5 h-5" />
        </Link>
      )}
      <Link to="/notifications" onClick={() => haptic("light")} aria-label={t("worker.tab.notifications")} className={BTN}>
        <HiOutlineBell className="w-5 h-5" />
        {badge && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white ring-2 ring-bg text-[10px] leading-[18px] font-extrabold tabular text-center">
            {badge}
          </span>
        )}
      </Link>
    </div>
  );
};
