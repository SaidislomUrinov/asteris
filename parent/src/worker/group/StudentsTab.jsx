import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineUserGroup, HiOutlineLockClosed, HiPlus } from "react-icons/hi2";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { activeEntryOf, asErr, clampMonth, monthRowOf, tashkentMonth, tashkentMonthOfUnix } from "../utils";
import { qrSendAllowed, qrSendEnabled } from "../constants";
import { useSendQrCard } from "../qr/useSendQrCard";
import { StudentRow } from "./StudentRow";
import { StudentActionsSheet } from "./StudentActionsSheet";
import { useStudentPhoto } from "../student/useStudentPhoto";
import { AddStudentSheet } from "./AddStudentSheet";
import { MonthSwitch } from "./MonthSwitch";

// "O'quvchilar" tabi (details §2). Ro'yxat: GET /students?group&status=active
// &limit=1000, bugungi davomat: GET /attendance/:groupId (GroupDetail yuklaydi).
export const StudentsTab = ({ group, students, state, todayMarks, perm, onAdded }) => {
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
  // "+ O'quvchi qo'shish" (docs/API_CONTRACT_enroll_with_photo.md) — ruxsat
  // `student:create` va guruh yakunlanmagan (GroupDetail `perm.add`).
  const [addOpen, setAddOpen] = useState(false);
  // Oy filtri (docs/API_CONTRACT_group_month_filter_and_start_date.md §D) —
  // faqat moliya ko'radigan rolda (`perm.debt`) va faollashgan guruhda.
  // Oraliq: guruh faollashgan oy (yoki o'quvchilardagi eng eski to'lanadigan
  // oy) → joriy oy (Toshkent). O'qituvchida hech narsa o'zgarmaydi.
  const currentMonth = tashkentMonth();
  const [monthPick, setMonthPick] = useState(currentMonth);
  const monthFilterOn = !!perm.debt && !!group.activatedAt;
  const monthMin = monthFilterOn
    ? students
        .map((s) => activeEntryOf(s, group._id)?.earliestPayableMonth)
        .filter(Boolean)
        .reduce((min, m) => (m < min ? m : min), tashkentMonthOfUnix(group.activatedAt))
    : currentMonth;
  const month = monthFilterOn ? clampMonth(monthPick, monthMin, currentMonth) : currentMonth;
  const isPastMonth = month !== currentMonth;
  const openAdd = () => {
    if (readOnly) {
      haptic("warning");
      toast.info(t("worker.readOnly.fab"), { id: "ro-fab" });
      return;
    }
    haptic("light");
    setAddOpen(true);
  };
  const addSheet = addOpen && (
    <AddStudentSheet open group={group} onClose={() => setAddOpen(false)} onAdded={onAdded} />
  );
  const addButton = perm.add ? (
    <button
      type="button"
      onClick={openAdd}
      className="inline-flex items-center gap-1 px-3 h-8 rounded-xl text-[13px] font-extrabold bg-accent text-accent-fg shrink-0 active:opacity-80"
    >
      <HiPlus className="w-4 h-4" />
      {t("worker.addStudent")}
    </button>
  ) : null;

  if (!perm.list) {
    return <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noStudentAccess")} text={t("worker.group.noStudentAccessText")} />;
  }
  if (state.loading && !state.data) return <RowsSkeleton count={5} />;
  if (state.error && !state.data) return <ErrorState error={asErr(state.error)} onRetry={state.reload} />;
  if (!students.length)
    return (
      <>
        <EmptyState icon={HiOutlineUserGroup} title={t("worker.att.noStudents")} />
        {addButton && <div className="flex justify-center">{addButton}</div>}
        {addSheet}
      </>
    );

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
    const entry = activeEntryOf(s, group._id);
    // O'tgan oy tanlangan bo'lsa — to'lov aynan o'sha oyga, summa shu oy qarzi.
    const row = isPastMonth ? monthRowOf(entry, month, currentMonth) : null;
    openSheet("payment", {
      student: s,
      entryId: entry?._id,
      ...(isPastMonth ? { month, amount: row?.debt || 0 } : {}),
    });
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
      {monthFilterOn && (
        <Card className="px-1.5 py-1">
          <MonthSwitch month={month} min={monthMin} onChange={setMonthPick} />
        </Card>
      )}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 truncate text-[13px] font-bold text-hint">{t("worker.group.studentsCount", { count: students.length })}</div>
        {addButton}
      </div>
      <Card className="py-1 divide-y divide-line/70">
        {students.map((s, i) => (
          <StudentRow
            key={s._id}
            index={i}
            student={s}
            billing={perm.debt ? monthRowOf(activeEntryOf(s, group._id), month, currentMonth) : null}
            mark={todayMarks[s._id]}
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
      {addSheet}
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
