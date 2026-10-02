import { useTranslation } from "react-i18next";
import { HiOutlineTrophy } from "react-icons/hi2";
import { Card } from "./Card";
import { Medal } from "./Medal";
import { Confetti } from "./Confetti";
import { Skeleton } from "./Skeleton";
import { useRequest } from "../hooks/useRequest";
import { getRank } from "../api/parent";
import { cn } from "../utils/cn";
import { monthName } from "../utils/format";

// Top-3 kartaning fon tinti va sarlavha rangi (oltin/kumush/bronza).
// Sarlavha rangi `dark:` emas, index.css'dagi `rank-tier-*` — `dark:` OS
// temasini kuzatadi, ilova esa Telegram temasini (`data-theme`) ishlatadi.
const TIER = {
  1: {
    card: "bg-gradient-to-br from-amber-300/25 via-amber-200/10 to-transparent border-amber-400/40",
    title: "rank-tier-1",
  },
  2: {
    card: "bg-gradient-to-br from-slate-300/35 via-slate-200/10 to-transparent border-slate-400/40",
    title: "rank-tier-2",
  },
  3: {
    card: "bg-gradient-to-br from-orange-300/25 via-orange-200/10 to-transparent border-orange-400/40",
    title: "rank-tier-3",
  },
};

const Stat = ({ value, label }) => (
  <div className="min-w-0">
    <div className="font-extrabold text-[15px] tabular leading-tight">{value}</div>
    <div className="text-[10px] text-hint leading-tight mt-0.5 truncate">{label}</div>
  </div>
);

// Guruh sahifasi tepasidagi reyting kartasi (GET /parent/entries/:entryId/rank).
// Top-3 — medal, rangli tint, yaltiroq nur va bir martalik konfetti; qolganlar
// — o'rin raqami va "medalgacha N pog'ona". Boshqa o'quvchilar ko'rsatilmaydi.
export const RankCard = ({ entryId }) => {
  const { t } = useTranslation();
  const rank = useRequest(() => getRank(entryId), [entryId]);
  const r = rank.data;

  if (rank.loading) return <Skeleton className="h-[92px] rounded-2xl" />;
  // Xato yoki markaz baholarni yashirgan — karta umuman chiqmaydi (sahifaning
  // asosiy maqsadi tablar; reyting qo'shimcha ma'lumot).
  if (rank.error || !r || r.gradesHidden) return null;

  // Reyting joriy oy bo'yicha (kontrakt §A) — davr yozuvi "Sentabr reytingi".
  const period = r.month ? (
    <div className="text-[11px] text-hint leading-tight mt-0.5 truncate">{t("rank.monthLabel", { month: monthName(r.month) })}</div>
  ) : null;

  const stats = (
    <div className="grid grid-cols-2 gap-3 text-right shrink-0">
      <Stat value={r.gradeAverage ?? "—"} label={t("grades.avg")} />
      <Stat value={r.attendanceRate != null ? `${r.attendanceRate}%` : "—"} label={t("att.rate")} />
    </div>
  );

  if (r.position == null)
    return (
      <Card className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl grid place-items-center bg-ink/6 text-hint shrink-0">
          <HiOutlineTrophy className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[15px] leading-tight">{t("rankCard.title")}</div>
          <div className="text-xs text-hint mt-0.5 leading-snug">{t("student.rank.none")}</div>
          {period}
        </div>
      </Card>
    );

  const tier = TIER[r.position];
  if (!tier)
    return (
      <Card className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl grid place-items-center bg-accent/10 text-accent font-extrabold text-lg tabular shrink-0">
          {r.position}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[15px] leading-tight">
            {t("student.rank.badge", { position: r.position, total: r.total })}
          </div>
          <div className="text-xs text-hint mt-0.5 leading-snug">
            {t("rankCard.toMedal", { count: r.position - 3 })}
          </div>
          {period}
        </div>
        {stats}
      </Card>
    );

  return (
    <Card className={cn("relative isolate overflow-hidden flex items-center gap-3.5 py-4", tier.card)}>
      {/* Karta bo'ylab sekin o'tadigan yaltiroq chiziq */}
      <span
        aria-hidden
        className="rank-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 -z-10 rank-sheen-band"
      />
      <div className="relative shrink-0 w-14 grid place-items-center">
        <Confetti tone={r.position} />
        <Medal position={r.position} size={48} label={t("rankCard.medal", { position: r.position })} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-[11px] font-bold tracking-[0.08em] uppercase", tier.title)}>
          {t(`rankCard.tier${r.position}`)}
        </div>
        <div className="font-extrabold text-[17px] leading-tight mt-0.5">
          {t("student.rank.badge", { position: r.position, total: r.total })}
        </div>
        {period}
      </div>
      {stats}
    </Card>
  );
};
