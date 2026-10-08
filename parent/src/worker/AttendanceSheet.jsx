import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineCalendarDays } from "react-icons/hi2";
import { Button } from "../components/Button";
import { Pill } from "../components/Card";
import { ListSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { haptic } from "../lib/telegram";
import { workerApi } from "./api";
import { useWorker } from "./useWorker";
import { useSocketEvents } from "./useSocket";
import { asErr, errText, groupLabel } from "./utils";
import { BottomSheet } from "./components/BottomSheet";
import { AttendanceRow } from "./components/AttendanceRow";
import { QrLaunchButton } from "./qr/QrLaunchButton";

// O'qituvchi/Yordamchi markaziy amali — joriy dars davomati (§5).
// Manba: GET /teacher/current-lesson → { group, isLive } | null;
// o'quvchilar: GET /students?group&status=active; bugungi belgilar:
// GET /attendance/:groupId; belgilash: POST /attendance/:groupId/mark
// { studentId, status, reason } — client /lesson sahifasi bilan bir xil.
export const AttendanceSheet = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { refresh, readOnly } = useWorker();
  const [state, setState] = useState({ loading: true, error: null, group: null, students: [] });
  const [marks, setMarks] = useState({}); // studentId → { status, late }
  const [saving, setSaving] = useState({}); // studentId → true
  const [bulk, setBulk] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const lesson = await workerApi.currentLesson();
      const group = lesson?.group || null;
      if (!group) {
        setState({ loading: false, error: null, group: null, students: [] });
        return;
      }
      const [studentsRes, today] = await Promise.all([
        workerApi.groupStudents(group._id),
        workerApi.attendanceToday(group._id),
      ]);
      const students = (studentsRes?.data || studentsRes || []).slice().sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || ""),
      );
      const m = {};
      (today?.records || []).forEach((r) => {
        m[String(r.student)] = { status: r.status, late: !!r.late };
      });
      setMarks(m);
      setState({ loading: false, error: null, group, students });
    } catch (e) {
      setState({ loading: false, error: e, group: null, students: [] });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  // Boshqa qurilmada (yoki QR orqali) belgilansa — darhol shu yerda ham.
  useSocketEvents(["attendance:marked"], (_ev, p) => {
    if (!state.group || p?.groupId !== String(state.group._id) || !p?.studentId) return;
    setMarks((prev) => ({ ...prev, [p.studentId]: { status: p.status, late: !!p.late } }));
  });

  const mark = async (studentId, status) => {
    const group = state.group;
    if (!group || readOnly) return;
    const prev = marks[studentId];
    haptic("light");
    setMarks((m) => ({ ...m, [studentId]: { status, late: prev?.late || false } }));
    setSaving((s) => ({ ...s, [studentId]: true }));
    try {
      await workerApi.markAttendance(group._id, studentId, status);
      refresh();
    } catch (e) {
      setMarks((m) => ({ ...m, [studentId]: prev }));
      toast.error(errText(e));
    } finally {
      setSaving((s) => ({ ...s, [studentId]: false }));
    }
  };

  const unmarked = state.students.filter((s) => !marks[s._id]?.status);

  // "Qolganlarini keldi qilish" — server bulk endpoint bermaydi, client
  // MonthlyAttendance kabi har biri uchun mavjud /mark chaqiriladi.
  const markRest = async () => {
    const group = state.group;
    if (!group || !unmarked.length) return;
    setBulk(true);
    const ids = unmarked.map((s) => s._id);
    setMarks((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, { status: "present", late: false }])) }));
    const res = await Promise.allSettled(ids.map((id) => workerApi.markAttendance(group._id, id, "present")));
    const failed = ids.filter((_, i) => res[i].status === "rejected");
    if (failed.length) {
      setMarks((m) => {
        const next = { ...m };
        failed.forEach((id) => delete next[id]);
        return next;
      });
      toast.error(errText(res.find((r) => r.status === "rejected")?.reason));
    } else {
      haptic("success");
      toast.success(t("worker.att.allMarked"));
    }
    refresh();
    setBulk(false);
  };

  const g = state.group;
  const present = state.students.filter((s) => marks[s._id]?.status === "present").length;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      busy={bulk}
      title={g ? groupLabel(g) : t("worker.att.title")}
      subtitle={g ? [g.startTime && `${g.startTime}–${g.endTime}`, g.roomName].filter(Boolean).join(" · ") : null}
      right={
        <>
          {!bulk && <QrLaunchButton compact onBeforeOpen={onClose} />}
          {g && state.students.length > 0 && (
            <Pill tone="ok" className="tabular text-[12px]">{present}/{state.students.length}</Pill>
          )}
        </>
      }
      footer={
        g && unmarked.length > 0 && !readOnly ? (
          <Button onClick={markRest} loading={bulk}>
            {t("worker.att.markRest", { count: unmarked.length })}
          </Button>
        ) : null
      }
    >
      {state.loading ? (
        <ListSkeleton count={4} />
      ) : state.error ? (
        <ErrorState error={asErr(state.error)} onRetry={load} />
      ) : !g ? (
        <EmptyState icon={HiOutlineCalendarDays} title={t("worker.att.noLesson")} text={t("worker.att.noLessonText")} />
      ) : state.students.length === 0 ? (
        <EmptyState title={t("worker.att.noStudents")} />
      ) : (
        <div className="flex flex-col divide-y divide-line/70">
          {state.students.map((s) => (
            <AttendanceRow
              key={s._id}
              name={s.fullName}
              mark={marks[s._id]}
              saving={!!saving[s._id] || bulk}
              disabled={readOnly}
              onMark={(status) => mark(s._id, status)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
};
