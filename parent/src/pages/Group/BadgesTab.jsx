import { useTranslation } from "react-i18next";
import { HiOutlineTrophy, HiCheckCircle } from "react-icons/hi2";
import { Card, Divider, SectionLabel } from "../../components/Card";
import { BadgeIcon } from "../../components/BadgeIcon";
import { Medal } from "../../components/Medal";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { BADGE_TYPES, GRADE_BADGE_TYPES, badgeProgress } from "../../utils/badges";
import { fmtMonth } from "../../utils/format";
import { cn } from "../../utils/cn";

const BAR_TONE = { met: "bg-ok", broken: "bg-bad/60", progress: "bg-accent" };

// Joriy oy progressi — bitta tur qatori.
const ProgressRow = ({ type, p }) => {
  const { t } = useTranslation();
  const pr = badgeProgress(type, p);
  const name = t(`badge.types.${type}.name`);
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <BadgeIcon type={type} size={32} earned={false} animated={false} label={name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-[13px] leading-tight break-words">{name}</span>
          <span
            className={cn(
              "tabular text-xs font-bold shrink-0",
              pr.state === "met" || pr.positive ? "text-ok" : pr.state === "broken" ? "text-bad" : "text-hint",
            )}
          >
            {pr.value}
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-ink/8 overflow-hidden">
          <div className={cn("h-full rounded-full", BAR_TONE[pr.state])} style={{ width: `${Math.round(pr.pct * 100)}%` }} />
        </div>
        {pr.state === "met" ? (
          <div className="flex items-center gap-1 text-[11px] font-bold text-ok mt-1">
            <HiCheckCircle className="w-3.5 h-3.5 shrink-0" />
            {t("badge.onTrack")}
          </div>
        ) : pr.hint ? (
          <div className={cn("text-[11px] mt-1 leading-snug", pr.state === "broken" ? "text-bad" : "text-hint")}>
            {t(pr.hint.key, pr.hint.opts)}
          </div>
        ) : (
          <div className="text-[11px] text-hint leading-snug mt-1 break-words">{t(`badge.types.${type}.rule`)}</div>
        )}
      </div>
    </div>
  );
};

// Olingan yutuq kartasi — kolleksiya gridida.
const EarnedCard = ({ item, index }) => {
  const { t } = useTranslation();
  const name = t(`badge.types.${item.type}.name`);
  const months = item.months || [];
  return (
    <Card className="flex flex-col items-center text-center px-2.5 py-4">
      <BadgeIcon type={item.type} size={60} count={item.count} label={name} delay={index * 0.08} />
      <div className="font-title font-bold text-[13px] leading-tight mt-2.5 break-words">{name}</div>
      <div className="text-[11px] text-hint leading-snug mt-1 break-words">{t(`badge.types.${item.type}.desc`)}</div>
      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {months.map((m) => (
          <span key={m} className="text-[11px] font-bold text-ink/80 bg-ink/6 rounded-md px-1.5 py-0.5">{fmtMonth(m)}</span>
        ))}
      </div>
    </Card>
  );
};

// Oy yakunidagi reyting medali — bitta qator: medal, oy, o'rin.
const MEDAL_TINT = {
  1: "bg-amber-300/15",
  2: "bg-slate-300/20",
  3: "bg-orange-300/15",
};
const MedalRow = ({ item }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("w-11 h-11 rounded-xl grid place-items-center shrink-0", MEDAL_TINT[item.position])}>
        <Medal position={item.position} size={22} animated={false} label={t(`rankCard.tier${item.position}`)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-title font-bold text-[14px] leading-tight break-words">{fmtMonth(item.month)}</div>
        <div className="text-xs text-hint mt-0.5 leading-snug">
          <span className={`rank-tier-${item.position} font-bold`}>{t(`rankCard.tier${item.position}`)}</span>
          {item.total > 0 && <> · {t("student.rank.badge", { position: item.position, total: item.total })}</>}
        </div>
      </div>
    </div>
  );
};

export const BadgesSkeleton = () => (
  <>
    <Skeleton className="h-3 w-40 mt-1" />
    <Skeleton className="h-72 rounded-2xl" />
    <Skeleton className="h-3 w-32 mt-1" />
    <div className="grid grid-cols-2 gap-2.5">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  </>
);

/**
 * "Yutuqlar" tabi — GET /parent/entries/:entryId/badges javobi `Group` sahifasida
 * olinadi (tabni ko'rsatish/yashirish uchun ham kerak) va shu yerga uzatiladi.
 */
export const BadgesTab = ({ state }) => {
  const { t } = useTranslation();
  const { data, loading, error, reload } = state;

  if (loading && !data) return <BadgesSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.enabled) return null;

  const hidden = data.gradesHidden ? GRADE_BADGE_TYPES : [];
  const progress = data.progress || {};
  // `done` — bir martalik nishon (Oltin kolleksiya) allaqachon olingan.
  const progressTypes = BADGE_TYPES.filter((ty) => !hidden.includes(ty) && progress[ty] && !progress[ty].done);
  const earned = BADGE_TYPES.map((ty) => (data.earned || []).find((e) => e.type === ty && e.count > 0))
    .filter((e) => e && !hidden.includes(e.type));
  const total = earned.reduce((a, e) => a + e.count, 0);
  const medals = data.medals || [];

  return (
    <>
      {progressTypes.length > 0 && (
        <>
          <SectionLabel right={<span className="text-[11px] font-bold text-hint">{fmtMonth(data.month)}</span>}>
            {t("badge.progressTitle")}
          </SectionLabel>
          <Card className="py-1.5">
            {progressTypes.map((ty, i) => (
              <div key={ty}>
                {i > 0 && <Divider className="my-0.5" />}
                <ProgressRow type={ty} p={progress[ty]} />
              </div>
            ))}
          </Card>
        </>
      )}

      {medals.length > 0 && (
        <>
          <SectionLabel>{t("badge.medalsTitle")}</SectionLabel>
          <Card className="py-1">
            {medals.map((m, i) => (
              <div key={m.month}>
                {i > 0 && <Divider className="my-0.5" />}
                <MedalRow item={m} />
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionLabel right={total > 0 && <span className="text-[11px] font-bold text-hint tabular">{t("badge.total", { count: total })}</span>}>
        {t("badge.collectionTitle")}
      </SectionLabel>
      {earned.length === 0 ? (
        <Card>
          <EmptyState icon={HiOutlineTrophy} title={t("badge.empty")} text={t("badge.emptyText")} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {earned.map((e, i) => (
            <EarnedCard key={e.type} item={e} index={i} />
          ))}
        </div>
      )}

      {data.gradesHidden && <div className="text-xs text-hint px-1">{t("badge.gradesHidden")}</div>}
    </>
  );
};
