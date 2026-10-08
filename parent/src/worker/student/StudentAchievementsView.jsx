import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { HiOutlinePhone, HiOutlineLockClosed, HiOutlineTrophy } from "react-icons/hi2";
import { Avatar, Card } from "../../components/Card";
import { CardsSkeleton, HeaderCardSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { initials } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr, callPhone } from "../utils";
import { BADGE_FEATURE } from "../constants";
import { StudySummary } from "./StudySummary";
import { ActionChip } from "./ActionChip";
import { GroupAchievements } from "./GroupAchievements";

// O'qituvchi / yordamchi uchun o'quvchi sahifasi (details §3.2) — faqat
// yutuqlar va o'z guruhlaridagi davomat/baho xulosasi; pul va to'lov yo'q.
// Manba: GET /badges/student/:id (server o'z guruhlari bilan cheklaydi),
// `/students/:id` chaqirilmaydi. Kontakt — faqat `student:contact` bo'lsa
// (raqam guruh ro'yxatidan `location.state` orqali keladi).
export const StudentAchievementsView = ({ id }) => {
  const { t } = useTranslation();
  const { state } = useLocation();
  const { can, hasFeature } = useWorker();
  const enabled = hasFeature(BADGE_FEATURE);
  const hint = state?.student?._id === id ? state.student : null;

  const load = useCallback(() => workerApi.studentBadges(id), [id]);
  const { data, loading, error, reload } = useScopedLive(load, [load], {
    enabled,
    events: ["attendance:marked", "grade:set", "grade:removed"],
    match: (_ev, p) => p?.studentId === id,
  });

  if (!enabled) {
    return <EmptyState icon={HiOutlineLockClosed} title={t("worker.errors.tariff.featureNotAvailable")} />;
  }
  if (loading && !data) {
    return (
      <>
        <HeaderCardSkeleton />
        <CardsSkeleton count={2} />
      </>
    );
  }
  if (error && !data) return <ErrorState error={asErr(error)} onRetry={reload} />;

  const student = data?.student || hint;
  const groups = data?.groups || [];
  const active = groups.filter((g) => g.state === "active").map((g) => ({ id: g.groupId, name: g.groupName || g.subjectName }));
  const canCall = can("student:contact") && !!hint;

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar text={initials(student?.fullName)} className="w-12 h-12 rounded-2xl text-base" />
          <div className="min-w-0">
            <div className="font-extrabold text-[17px] leading-tight break-words">{student?.fullName || "—"}</div>
            <div className="flex items-center gap-1 text-[12px] text-hint">
              <HiOutlineTrophy className="w-4 h-4 text-warn shrink-0" />
              {t("worker.student.teacherScope")}
            </div>
          </div>
        </div>
        {canCall && (hint.phone || hint.parentPhone) && (
          <div className="flex flex-wrap gap-1.5">
            {hint.phone && (
              <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(hint.phone)}>
                {t("worker.student.callStudent")}
              </ActionChip>
            )}
            {hint.parentPhone && (
              <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(hint.parentPhone)}>
                {t("worker.student.callParent")}
              </ActionChip>
            )}
          </div>
        )}
      </Card>
      {can("attendance:view") && <StudySummary studentId={id} groups={active} />}
      {groups.map((g) => (
        <GroupAchievements key={g.groupId} item={g} month={data.month} />
      ))}
    </>
  );
};
