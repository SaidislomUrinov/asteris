import { useTranslation } from "react-i18next";
import { HiCalendarDays } from "react-icons/hi2";
import { STATE_META } from "./achievementStates";
import BadgeIcon from "../../ui/BadgeIcon";
import RankMedal from "../../ui/RankMedal";
import BadgeProgressRow from "./BadgeProgressRow";
import { BADGE_TYPES, badgeNameKey, formatBadgeMonth, monthOfTs } from "../../utils/badges";

// Medal kartochkasi foni — oltin / kumush / bronza.
const MEDAL_TONE = {
  1: "bg-amber-50 border-amber-200",
  2: "bg-slate-50 border-slate-200",
  3: "bg-orange-50 border-orange-200",
};

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

/**
 * O'quvchi yutuqlari — bitta guruh kartasi. Faol guruhda joriy oy progressi
 * ham chiziladi; nofaol (yakunlangan / chiqqan / arxivlangan) kartada faqat
 * davr, olingan nishonlar va medallar — ular doimiy saqlanadi.
 */
function AchievementGroupCard({ group: g, monthNames, currentMonthName }) {
  const { t } = useTranslation();
  const active = g.state === "active";
  const earned = BADGE_TYPES.map((type) => g.earned?.find((e) => e.type === type)).filter(Boolean);
  const medals = g.medals || [];
  const from = formatBadgeMonth(monthOfTs(g.startedAt), monthNames);
  const to = active ? t("badge.periodNow") : formatBadgeMonth(monthOfTs(g.endedAt), monthNames);
  const title = [g.subjectName, g.groupName].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ");

  const meta = STATE_META[g.state] || STATE_META.archived;
  const StateIcon = meta.Icon;
  const badgeSize = active ? 44 : 36;

  const earnedList = earned.length ? (
    <div className="flex flex-wrap gap-x-3 gap-y-3">
      {earned.map((e) => {
        const months = (e.months || []).map((m) => formatBadgeMonth(m, monthNames));
        return (
          <div key={e.type} className="flex flex-col items-center gap-1 w-[72px]">
            <BadgeIcon
              type={e.type}
              size={badgeSize}
              count={e.count}
              label={`${t(badgeNameKey(e.type))}${months.length ? ` — ${months.join(", ")}` : ""}`}
            />
            <span className="text-[11px] font-medium text-slate-600 text-center leading-tight line-clamp-2">
              {t(badgeNameKey(e.type))}
            </span>
            {months[0] && <span className="text-[10px] text-slate-400 text-center leading-tight">{months[0]}</span>}
          </div>
        );
      })}
    </div>
  ) : null;

  const medalList = medals.length ? (
    <div className="flex flex-wrap gap-2">
      {medals.map((m) => (
        <div
          key={m.month}
          className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border ${MEDAL_TONE[m.position]}`}
        >
          <RankMedal position={m.position} size={18} animated={false} />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-semibold text-slate-800">{formatBadgeMonth(m.month, monthNames)}</span>
            <span className="text-[11px] text-slate-500">
              {t(`badge.medalTier${m.position}`)}
              {m.total > 0 && ` · ${t("badge.medalPlace", { position: m.position, total: m.total })}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <article
      className={`flex flex-col gap-4 p-4 rounded-2xl border min-w-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <header className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-semibold text-slate-800 break-words leading-snug">{title}</h3>
          {from && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <HiCalendarDays className="shrink-0 text-slate-400" />
              <span>
                {from} — {to || "…"}
              </span>
            </p>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${meta.tone}`}
        >
          <StateIcon className="text-xs" />
          {t(`badge.state.${g.state}`)}
        </span>
      </header>

      {active ? (
        <>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>{t("badge.earned")}</span>
            {earnedList || <p className="text-sm text-slate-400">{t("badge.noneEarned")}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <span className={LABEL}>{t("badge.medals")}</span>
            {medalList || <p className="text-sm text-slate-400">{t("badge.noMedals")}</p>}
          </div>
        </>
      ) : (
        // Nofaol karta ixcham: faqat borlari, ikkalasi bo'lsa sm+ da yonma-yon.
        <div className={`grid grid-cols-1 gap-4 ${earnedList && medalList ? "sm:grid-cols-2" : ""}`}>
          {earnedList && (
            <div className="flex flex-col gap-2 min-w-0">
              <span className={LABEL}>{t("badge.earned")}</span>
              {earnedList}
            </div>
          )}
          {medalList && (
            <div
              className={`flex flex-col gap-2 min-w-0 ${
                earnedList ? "pt-3 border-t sm:pt-0 sm:border-t-0 sm:pl-4 sm:border-l border-slate-200/70" : ""
              }`}
            >
              <span className={LABEL}>{t("badge.medals")}</span>
              {medalList}
            </div>
          )}
        </div>
      )}

      {active && (
        <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
          <span className={LABEL}>{t("badge.progressTitle", { month: currentMonthName })}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {BADGE_TYPES.map((type) => (
              <BadgeProgressRow key={type} type={type} progress={g.progress?.[type]} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default AchievementGroupCard;
