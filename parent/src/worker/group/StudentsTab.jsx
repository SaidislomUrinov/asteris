import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineUserGroup, HiOutlineLockClosed } from "react-icons/hi2";
import { Card } from "../../components/Card";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { activeEntryOf, asErr } from "../utils";
import { StudentRow } from "./StudentRow";
import { StudentActionsSheet } from "./StudentActionsSheet";

// "O'quvchilar" tabi (details §2). Ro'yxat: GET /students?group&status=active
// &limit=1000, bugungi davomat: GET /attendance/:groupId (GroupDetail yuklaydi).
export const StudentsTab = ({ group, students, state, todayMarks, perm }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { readOnly, openSheet } = useWorker();
  const [menuFor, setMenuFor] = useState(null);

  if (!perm.list) {
    return <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noStudentAccess")} text={t("worker.group.noStudentAccessText")} />;
  }
  if (state.loading && !state.data) return <RowsSkeleton count={5} />;
  if (state.error && !state.data) return <ErrorState error={asErr(state.error)} onRetry={state.reload} />;
  if (!students.length) return <EmptyState icon={HiOutlineUserGroup} title={t("worker.att.noStudents")} />;

  const open = (s) =>
    navigate(`/students/${s._id}`, {
      // O'qituvchi ko'rinishi `/students/:id` ni chaqirmaydi — ism/kontakt shu yerdan.
      state: { student: { _id: s._id, fullName: s.fullName, phone: s.phone, parentPhone: s.parentPhone }, groupId: group._id },
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
  const hasMenu = perm.call || canPayGroup || perm.open;

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
            onMenu={hasMenu ? () => setMenuFor(s) : undefined}
          />
        ))}
      </Card>
      {menuFor && (
        <StudentActionsSheet
          student={menuFor}
          canCall={perm.call}
          onPay={canPayGroup ? () => pay(menuFor) : undefined}
          onOpen={perm.open ? () => { setMenuFor(null); open(menuFor); } : undefined}
          onClose={() => setMenuFor(null)}
        />
      )}
    </>
  );
};
