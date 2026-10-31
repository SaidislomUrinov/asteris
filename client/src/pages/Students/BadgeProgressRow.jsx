import { useTranslation } from "react-i18next";
import BadgeIcon from "../../ui/BadgeIcon";
import ProgressBar from "../../ui/ProgressBar";
import { badgeDescKey, badgeNameKey } from "../../utils/badges";

// Har tur uchun progress obyektini (API_CONTRACT_badges_monthly_rank.md §C)
// bitta ko'rinishga keltiradi: { value, max, text, done, broken }.
// `value/max` bo'lmasa (masalan mostImproved) bar chizilmaydi.
function describe(type, p, t) {
  if (!p) return { text: t("badge.noData") };
  const broken = p.broken === true;
  switch (type) {
    case "perfectAttendance": {
      const max = Math.max(p.target || 0, p.min || 0);
      const isBroken = broken || (p.absent || 0) > 0;
      return {
        value: p.current || 0,
        max,
        text: isBroken ? t("badge.brokenAbsent", { count: p.absent || 0 }) : `${p.current || 0}/${max}`,
        done: !isBroken && (p.target || 0) >= (p.min || 0) && (p.current || 0) >= max && max > 0,
        broken: isBroken,
      };
    }
    case "excellent":
    case "perfect": {
      const max = Math.max(p.target || 0, p.min || 0);
      return {
        value: p.current || 0,
        max,
        text: broken ? t("badge.broken") : `${p.current || 0}/${max}`,
        done: !broken && max > 0 && (p.current || 0) >= max,
        broken,
      };
    }
    case "attendanceStreak":
    case "gradeStreak":
      // Seriya shu oyda yetgan bo'lsa server counter'ni 0 ga qaytaradi —
      // `achieved` qat'iy (oy oxirigacha yo'qolmaydi), shuning uchun "Bajarildi".
      if (p.achieved) return { value: p.target || 1, max: p.target || 1, done: true, final: true };
      return {
        value: p.current || 0,
        max: p.target || 0,
        text: `${p.current || 0}/${p.target || 0}`,
      };
    case "champion":
      if (!p.position) return { text: t("badge.noRank") };
      return {
        value: Math.max(0, (p.total || 0) - p.position + 1),
        max: p.total || 0,
        text: t("badge.position", { position: p.position, total: p.total || 0 }),
        done: p.position === 1,
      };
    case "mostImproved":
      if (p.delta === null || p.delta === undefined) return { text: t("badge.noData") };
      return {
        text: t("badge.delta", {
          delta: `${p.delta > 0 ? "+" : ""}${Number(p.delta).toFixed(1)}`,
          from: p.prevAverage ?? "—",
          to: p.average ?? "—",
        }),
        done: false,
      };
    case "podiumStreak":
      if (p.achieved) return { value: p.target || 1, max: p.target || 1, done: true, final: true };
      return { value: p.current || 0, max: p.target || 0, text: `${p.current || 0}/${p.target || 0}` };
    case "goldCollection":
      // `done` — bir martalik, avval olingan.
      if (p.achieved || p.done) return { value: p.target || 1, max: p.target || 1, done: true, final: true };
      return { value: p.current || 0, max: p.target || 0, text: `${p.current || 0}/${p.target || 0}` };
    case "bigJump": {
      if (p.prevPosition == null || p.position == null) return { text: t("badge.noData") };
      const jump = p.jump ?? p.prevPosition - p.position;
      return {
        value: Math.max(0, jump),
        max: p.target || 0,
        text: t("badge.jump", { jump: `${jump > 0 ? "+" : ""}${jump}`, from: p.prevPosition, to: p.position }),
        done: !!p.achieved,
      };
    }
    case "titleDefender": {
      if (p.position == null) return { text: t("badge.noRank") };
      if ((p.total || 0) < (p.min || 3)) return { text: t("badge.needRanked", { min: p.min || 3 }) };
      if (p.achieved) return { done: true };
      // O'tgan oy 1-o'rin bo'lmasa — shu oy uchun endi olib bo'lmaydi.
      if (p.prevPosition !== 1) return { text: t("badge.notPrevFirst"), broken: true };
      return { text: t("badge.position", { position: p.position, total: p.total || 0 }) };
    }
    case "phoenix": {
      if (p.position == null) return { text: t("badge.noRank") };
      if ((p.total || 0) < (p.min || 6) || (p.prevTotal || 0) < (p.min || 6)) return { text: t("badge.needRanked", { min: p.min || 6 }) };
      if (p.achieved) return { done: true };
      if (!p.wasBottomHalf) return { text: t("badge.notBottomHalf"), broken: true };
      return { text: t("badge.move", { from: p.prevPosition, to: p.position }) };
    }
    case "punctual": {
      const min = p.min || 6;
      if (p.broken) {
        return { value: p.held || 0, max: min, text: t("badge.brokenPunctual", { absent: p.absent || 0, late: p.late || 0 }), broken: true };
      }
      return { value: p.held || 0, max: min, text: `${p.held || 0}/${min}`, done: !!p.achieved };
    }
    case "grandSlam": {
      const target = p.target || 3;
      return {
        value: p.done || 0,
        max: target,
        text: `${p.done || 0}/${target}`,
        done: !!p.achieved,
        sub: t("badge.grandFlags", { att: p.attendance ? "✓" : "✗", grades: p.grades ? "✓" : "✗", podium: p.podium ? "✓" : "✗" }),
      };
    }
    case "comeback": {
      const min = p.min || 6;
      if (!p.eligible) {
        return { value: 0, max: min, text: `${p.prevAbsent || 0}/${p.needPrev || 3}`, sub: t("badge.comebackNeedPrev", { n: p.needPrev || 3 }) };
      }
      if (p.broken) {
        return { value: p.held || 0, max: min, text: t("badge.comebackBroken", { absent: p.absent || 0 }), broken: true };
      }
      return { value: p.held || 0, max: min, text: `${Math.min(p.held || 0, min)}/${min}`, done: !!p.achieved };
    }
    default:
      return { text: "" };
  }
}

/**
 * Joriy oy progressi — bitta nishon turi uchun qator: kichik emblem, nom,
 * tavsif (tooltip), "7/9" va progress-bar.
 */
function BadgeProgressRow({ type, progress }) {
  const { t } = useTranslation();
  const d = describe(type, progress, t);
  const hasBar = d.max > 0 && d.value !== undefined;
  // Holat matni: qisqasi ("7/9") nom yonida, uzuni (sabab, "Hozircha bajarilmoqda")
  // nom tagida o'raladi — nom kesilib ketmasin.
  const status = d.done ? t(d.final ? "badge.completed" : "badge.onTrack") : d.text;
  const inline = !!status && status.length <= 16;
  const tone = d.done ? "text-emerald-600 dark:text-emerald-400" : d.broken ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-slate-500";

  return (
    <div className="flex items-start gap-2.5 min-w-0" title={t(badgeDescKey(type))}>
      <BadgeIcon type={type} size={28} earned={!!d.done} animated={false} />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="text-xs font-semibold leading-snug text-slate-700 dark:text-slate-300 break-words min-w-0">
            {t(badgeNameKey(type))}
          </span>
          {inline && <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${tone}`}>{status}</span>}
        </div>
        {hasBar && <ProgressBar value={d.value} max={d.max} color={d.done ? "emerald" : d.broken ? "slate" : "blue"} />}
        {status && !inline && <span className={`text-[11px] font-medium leading-snug ${tone}`}>{status}</span>}
        {d.sub && <span className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">{d.sub}</span>}
      </div>
    </div>
  );
}

export default BadgeProgressRow;
