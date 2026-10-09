import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { HiOutlinePhone, HiOutlineLockClosed, HiOutlineTrophy, HiOutlinePaperAirplane } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { Card } from "../../components/Card";
import { CardsSkeleton, HeaderCardSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr, callPhone } from "../utils";
import { BADGE_FEATURE, qrSendAllowed, qrSendEnabled } from "../constants";
import { useSendQrCard } from "../qr/useSendQrCard";
import { StudySummary } from "./StudySummary";
import { ActionChip } from "./ActionChip";
import { StudentPhotoAvatar } from "./StudentPhotoAvatar";
import { GroupAchievements } from "./GroupAchievements";

// O'qituvchi / yordamchi uchun o'quvchi sahifasi (details §3.2) — faqat
// yutuqlar va o'z guruhlaridagi davomat/baho xulosasi; pul va to'lov yo'q.
// Manba: GET /badges/student/:id (server o'z guruhlari bilan cheklaydi),
// `/students/:id` chaqirilmaydi. Kontakt — faqat `student:contact` bo'lsa
// (raqam guruh ro'yxatidan `location.state` orqali keladi).
export const StudentAchievementsView = ({ id }) => {
  const { t } = useTranslation();
  const { state } = useLocation();
  const worker = useWorker();
  const { can, hasFeature } = worker;
  const { send: sendQr, busyId } = useSendQrCard();
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
  // QR yuborish — Telegram holati guruh ro'yxatidan (`location.state`) keladi;
  // bo'lmasa server o'zi tekshiradi (qrSendEnabled).
  const canSendQr = qrSendAllowed(worker);
  const qrDisabled = !qrSendEnabled(hint);
  const qrBusy = busyId === id;
  const showCall = canCall && (hint.phone || hint.parentPhone);

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* O'qituvchi ham rasm qo'ya oladi (faqat o'z guruhidagi o'quvchiga —
              server tekshiradi). `photo` guruh ro'yxatidan (`hint`) ham keladi. */}
          <StudentPhotoAvatar
            student={{ _id: id, fullName: student?.fullName, photo: student?.photo ?? hint?.photo }}
            className="w-12 h-12 text-base"
          />
          <div className="min-w-0">
            <div className="font-title font-bold text-[17px] leading-tight break-words">{student?.fullName || "—"}</div>
            <div className="flex items-center gap-1 text-[12px] text-hint">
              <HiOutlineTrophy className="w-4 h-4 text-warn shrink-0" />
              {t("worker.student.teacherScope")}
            </div>
          </div>
        </div>
        {(showCall || canSendQr) && (
          <div className="flex flex-wrap gap-1.5">
            {showCall && hint.phone && (
              <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(hint.phone)}>
                {t("worker.student.callStudent")}
              </ActionChip>
            )}
            {showCall && hint.parentPhone && (
              <ActionChip icon={HiOutlinePhone} onClick={() => callPhone(hint.parentPhone)}>
                {t("worker.student.callParent")}
              </ActionChip>
            )}
            {canSendQr && (
              <ActionChip
                icon={HiOutlinePaperAirplane}
                disabled={qrDisabled || qrBusy}
                onClick={() => (qrDisabled || qrBusy ? haptic("warning") : sendQr({ _id: id }))}
              >
                {t(qrBusy ? "worker.qr.sendBusy" : "worker.qr.sendShort")}
              </ActionChip>
            )}
          </div>
        )}
        {canSendQr && qrDisabled && <div className="text-[12px] text-hint -mt-1">{t("worker.qr.sendNoTelegram")}</div>}
      </Card>
      {can("attendance:view") && <StudySummary studentId={id} groups={active} />}
      {groups.map((g) => (
        <GroupAchievements key={g.groupId} item={g} month={data.month} />
      ))}
    </>
  );
};
