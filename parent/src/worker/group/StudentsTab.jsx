import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineUserGroup, HiOutlineLockClosed } from "react-icons/hi2";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { activeEntryOf, asErr } from "../utils";
import { qrSendAllowed, qrSendEnabled } from "../constants";
import { useSendQrCard } from "../qr/useSendQrCard";
import { StudentRow } from "./StudentRow";
import { StudentActionsSheet } from "./StudentActionsSheet";
import { useStudentPhoto } from "../student/useStudentPhoto";

// "O'quvchilar" tabi (details §2). Ro'yxat: GET /students?group&status=active
// &limit=1000, bugungi davomat: GET /attendance/:groupId (GroupDetail yuklaydi).
export const StudentsTab = ({ group, students, state, todayMarks, perm }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const worker = useWorker();
  const { readOnly, openSheet } = worker;
  const [menuFor, setMenuFor] = useState(null);
  const { send: sendQr } = useSendQrCard();
  const canSendQr = qrSendAllowed(worker);
  // Rasm — barcha rollar uchun (ruxsatsiz; o'qituvchini server o'z guruhi bilan
  // cheklaydi). Badge tarifi yo'q o'qituvchida yutuqlar sahifasi (avatar kirish
  // nuqtasi) yopiq — shuning uchun qator menyusida ham bor. Ro'yxat
  // `student:updated` bilan o'zi yangilanadi.
  const fileRef = useRef(null);
  const [photoFor, setPhotoFor] = useState(null);
  const [removeFor, setRemoveFor] = useState(null);
  const photo = useStudentPhoto(photoFor?._id || removeFor?._id);

  if (!perm.list) {
    return <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noStudentAccess")} text={t("worker.group.noStudentAccessText")} />;
  }
  if (state.loading && !state.data) return <RowsSkeleton count={5} />;
  if (state.error && !state.data) return <ErrorState error={asErr(state.error)} onRetry={state.reload} />;
  if (!students.length) return <EmptyState icon={HiOutlineUserGroup} title={t("worker.att.noStudents")} />;

  const open = (s) =>
    navigate(`/students/${s._id}`, {
      // O'qituvchi ko'rinishi `/students/:id` ni chaqirmaydi — ism/kontakt shu yerdan.
      state: {
        student: {
          _id: s._id,
          fullName: s.fullName,
          phone: s.phone,
          parentPhone: s.parentPhone,
          studentTelegram: s.studentTelegram,
          parentTelegram: s.parentTelegram,
          photo: s.photo,
        },
        groupId: group._id,
      },
    });

  const canPayGroup = perm.pay && group.status !== "finished";
  const pay = (s) => {
    setMenuFor(null);
    if (readOnly) {
      haptic("warning");
      toast.info(t("worker.readOnly.fab"), { id: "ro-fab" });
      return;
    }
    openSheet("payment", { student: s, entryId: activeEntryOf(s, group._id)?._id });
  };
  const pickPhoto = (s) => {
    setMenuFor(null);
    setPhotoFor(s);
    fileRef.current?.click();
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await photo.upload(file);
    setPhotoFor(null);
  };
  const onRemovePhoto = async () => {
    const ok = await photo.remove();
    if (ok) setRemoveFor(null);
  };

  return (
    <>
      <div className="text-[13px] font-bold text-hint px-1">{t("worker.group.studentsCount", { count: students.length })}</div>
      <Card className="py-1 divide-y divide-line/70">
        {students.map((s, i) => (
          <StudentRow
            key={s._id}
            index={i}
            student={s}
            entry={activeEntryOf(s, group._id)}
            mark={todayMarks[s._id]}
            showDebt={perm.debt}
            sub={perm.call ? s.phone : null}
            onOpen={perm.open ? () => open(s) : undefined}
            onMenu={() => setMenuFor(s)}
          />
        ))}
      </Card>
      {menuFor && (
        <StudentActionsSheet
          student={menuFor}
          canCall={perm.call}
          onPay={canPayGroup ? () => pay(menuFor) : undefined}
          onSendQr={
            canSendQr
              ? () => {
                  setMenuFor(null);
                  sendQr(menuFor);
                }
              : undefined
          }
          qrDisabled={!qrSendEnabled(menuFor)}
          onOpen={perm.open ? () => { setMenuFor(null); open(menuFor); } : undefined}
          onPhoto={() => pickPhoto(menuFor)}
          onRemovePhoto={
            menuFor.photo
              ? () => {
                  setMenuFor(null);
                  setRemoveFor(menuFor);
                }
              : undefined
          }
          onClose={() => setMenuFor(null)}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {removeFor && (
        <ConfirmDialog
          open
          title={t("worker.student.photoRemoveTitle")}
          text={t("worker.student.photoRemoveText", { name: removeFor.fullName })}
          danger
          loading={photo.busy}
          confirmText={t("worker.student.photoRemove")}
          cancelText={t("common.cancel")}
          onConfirm={onRemovePhoto}
          onClose={() => setRemoveFor(null)}
        />
      )}
    </>
  );
};
