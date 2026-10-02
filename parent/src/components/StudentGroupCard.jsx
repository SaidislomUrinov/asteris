import { useTranslation } from "react-i18next";
import { HiChevronRight, HiOutlineAcademicCap, HiOutlineBookOpen, HiOutlineCheckBadge } from "react-icons/hi2";
import { Card, IconBox, Pill } from "./Card";
import { Skeleton } from "./Skeleton";
import { Medal } from "./Medal";
import { useRequest } from "../hooks/useRequest";
import { getHomework, getRank } from "../api/parent";
import { fmtDate, weekdayFull, ymOf } from "../utils/format";
import { homeworkWhen, nearestHomework } from "../utils/homework";
import { daysLabel } from "../utils/days";
import { LinkifiedText } from "./LinkifiedText";
import { cn } from "../utils/cn";

// Top-3 o'rin uchun nozik oltin/kumush/bronza tint; qolganlarda neytral fon.
const MEDAL_BG = {
  1: "bg-amber-400/12",
  2: "bg-slate-400/15",
  3: "bg-orange-400/12",
};

// Guruh kartasidagi ixcham 3 ustunli ko'rsatkich: o'rin, o'rtacha baho, davomat.
const Metric = ({ value, label, className, medal }) => (
  <div className={cn("rounded-xl px-1.5 py-2 text-center min-w-0 bg-ink/4", className)}>
    <div className="flex items-center justify-center gap-1 font-extrabold text-[15px] tabular leading-tight min-w-0">
      {medal}
      <span className="truncate">{value}</span>
    </div>
    <div className="text-[10px] text-hint leading-tight mt-0.5 truncate">{label}</div>
  </div>
);

// O'quvchi bosh sahifasidagi guruh kartasi: nom, markaz, o'rin/baho/davomat
// ko'rsatkichlari va eng yaqin vazifa. Tugagan guruhda (muted) so'rov yuborilmaydi.
export const StudentGroupCard = ({ group, centerName, onClick, muted }) => {
  const { t } = useTranslation();
  const live = !muted;
  const rank = useRequest(() => getRank(group.entryId), [group.entryId], { enabled: live });
  const hw = useRequest(() => getHomework(group.entryId, ymOf()), [group.entryId], { enabled: live });
  const time = group.startTime && group.endTime ? `${group.startTime}–${group.endTime}` : null;
  const meta = [centerName, daysLabel(group.days, t), time].filter(Boolean).join(" · ");
  const next = nearestHomework(hw.data?.items);
  const when = next && homeworkWhen(next.date);
  const r = rank.data;
  const medalBg = r?.position && r.position <= 3 ? MEDAL_BG[r.position] : null;

  return (
    <Card as="button" onClick={onClick} className={cn("block", muted && "opacity-70")}>
      <div className="flex items-center gap-3">
        <IconBox Icon={muted ? HiOutlineCheckBadge : HiOutlineAcademicCap} tone={muted ? "mut" : "acc"} />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[15px] break-words leading-tight">{group.name}</div>
          {meta && <div className="text-xs text-hint mt-1 break-words leading-snug">{meta}</div>}
        </div>
        <HiChevronRight className="w-5 h-5 text-hint/70 shrink-0" />
      </div>

      {muted ? (
        <div className="mt-2"><Pill tone="mut">{t(`group.status.${group.status}`)}</Pill></div>
      ) : (
        <>
          {rank.loading ? (
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <Skeleton className="h-[46px] rounded-xl" />
              <Skeleton className="h-[46px] rounded-xl" />
              <Skeleton className="h-[46px] rounded-xl" />
            </div>
          ) : rank.error ? null : (
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <Metric
                value={r?.position != null ? `${r.position}/${r.total}` : "—"}
                label={t("student.home.rank")}
                className={medalBg}
                medal={medalBg && <Medal position={r.position} size={13} label={t("rankCard.medal", { position: r.position })} />}
              />
              <Metric value={r?.gradeAverage ?? "—"} label={t("grades.avg")} />
              <Metric value={r?.attendanceRate != null ? `${r.attendanceRate}%` : "—"} label={t("att.rate")} />
            </div>
          )}

          <div className="mt-2.5 rounded-xl bg-ink/4 px-3 py-2.5">
            {hw.loading ? (
              <Skeleton className="h-4 w-3/4" />
            ) : !next ? (
              <div className="text-xs text-hint">{hw.error ? t("error.unknown") : t("student.home.noHomework")}</div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-hint">
                  <HiOutlineBookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {when === "today"
                      ? t("student.home.hwToday")
                      : when === "tomorrow"
                        ? t("student.home.hwTomorrow")
                        : t("student.home.hwOn", { d: `${weekdayFull(next.date)}, ${fmtDate(next.date)}` })}
                  </span>
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap break-words line-clamp-2"><LinkifiedText text={next.text} nested /></div>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
