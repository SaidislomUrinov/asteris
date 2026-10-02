import { useTranslation } from "react-i18next";
import { HiOutlineTrophy } from "react-icons/hi2";
import { Pill } from "./Card";
import { cn } from "../utils/cn";
import { monthName } from "../utils/format";

// Top-3 o'rin uchun oltin/kumush/bronza rang; qolganlar uchun neytral urg'u rangi.
const MEDAL_TONE = {
  1: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
  2: "bg-slate-400/20 text-slate-500 dark:text-slate-300",
  3: "bg-orange-400/15 text-orange-700 dark:text-orange-300",
};

// Guruhdagi o'rin: "14 tadan 3-o'rin". position null — hali baho yo'q.
// Top-3 bo'lsa mini o'rin-meteri (qancha yuqoriroq o'rin — shuncha to'liq) ko'rsatiladi.
// rank: GET /parent/entries/:entryId/rank javobi
export const RankBadge = ({ rank }) => {
  const { t } = useTranslation();
  if (!rank) return null;
  if (rank.position == null) return <Pill tone="mut">{t("student.rank.none")}</Pill>;
  const top3 = rank.position <= 3;
  const tone = MEDAL_TONE[rank.position] || "bg-accent/10 text-accent";
  // Reyting joriy oy bo'yicha — davr yozuvi tooltip + qisqa qo'shimcha
  const period = rank.month ? t("rank.monthLabel", { month: monthName(rank.month) }) : undefined;
  const pct = rank.total > 1 ? Math.round(((rank.total - rank.position) / (rank.total - 1)) * 100) : 100;
  return (
    <span title={period} className={cn("inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full whitespace-nowrap", tone)}>
      <HiOutlineTrophy className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[11px] font-bold">{t("student.rank.badge", { position: rank.position, total: rank.total })}</span>
      {period && <span className="text-[10px] font-semibold opacity-70">· {period}</span>}
      {top3 && (
        <span className="w-7 h-1 rounded-full bg-current/20 overflow-hidden shrink-0">
          <span className="block h-full rounded-full bg-current" style={{ width: `${pct}%` }} />
        </span>
      )}
    </span>
  );
};
