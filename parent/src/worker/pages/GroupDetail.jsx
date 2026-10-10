import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { HiOutlineLockClosed } from "react-icons/hi2";
import { HeaderCardSkeleton, RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { activeEntryOf, asErr, byName, mergeStudentUpdate, tashkentDateShift } from "../utils";
import { BADGE_FEATURE, TEACHING_ROLES } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { ReadOnlyNote } from "../components/ReadOnlyNote";
import { GroupHeaderCard } from "../group/GroupHeaderCard";
import { GroupTabs } from "../group/GroupTabs";
import { StudentsTab } from "../group/StudentsTab";
import { AttendanceTab } from "../group/AttendanceTab";
import { GradesTab } from "../group/GradesTab";
import { HomeworkTab } from "../group/HomeworkTab";
import { PlanTab } from "../group/PlanTab";

// O'quvchilar ro'yxatiga ta'sir qiladigan eventlar (details §5).
const STUDENT_EVENTS = [
  "student:enrolled",
  "student:leftGroup",
  "student:updated",
  "student:priceUpdated",
  "payment:created",
  "payment:cancelled",
  "payment:updated",
  "attendance:marked",
];

// O'qituvchi/yordamchi ismlari — `/staffs/lookup` (ruxsatsiz tanlov ro'yxati).
const loadStaffNames = async () => {
  const res = await Promise.allSettled([workerApi.staffLookup("teacher"), workerApi.staffLookup("assistant")]);
  const map = {};
  res.forEach((r) => {
    if (r.status === "fulfilled") (r.value || []).forEach((s) => { map[String(s._id)] = s.name; });
  });
  return map;
};

// Guruh detali — `/groups/:id/:tab?` (details §2). Ruxsat `group:view`;
// o'qituvchi/yordamchi faqat o'z guruhlari (server `teacherScope`).
// Tablar ruxsat/tarifga qarab yashiriladi.
export const GroupDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id, tab } = useParams();
  const { role, can, hasFeature, readOnly, isOwner } = useWorker();
  const teaching = TEACHING_ROLES.includes(role);

  const groupLoad = useCallback(() => workerApi.group(id), [id]);
  const groupReq = useScopedLive(groupLoad, [groupLoad], {
    events: ["group:changed"],
    match: (_ev, p) => p?.groupId === id,
  });
  const g = groupReq.data;

  const staffReq = useRequest(loadStaffNames, []);
  const names = staffReq.data || {};

  // O'quvchilar ro'yxati — `GET /students` `student:view` talab qiladi (o'qituvchida
  // ham, `?group=` bilan). Ruxsat bo'lmasa so'rov yuborilmaydi.
  const listAllowed = can("student:view");
  const idsRef = useRef(new Set());
  const studentsLoad = useCallback(() => workerApi.groupStudents(id), [id]);
  const studentsReq = useScopedLive(studentsLoad, [studentsLoad], {
    enabled: listAllowed,
    events: STUDENT_EVENTS,
    match: (_ev, p) => p?.groupId === id || (!!p?.studentId && idsRef.current.has(String(p.studentId))),
    // Rasm/kontakt o'zgarishi — ro'yxat qayta yuklanmaydi, qator joyida yangilanadi.
    patch: (ev, p) =>
      ev === "student:updated"
        ? (data) => {
            const merge = (list) => list.map((st) => (String(st._id) === String(p.studentId) ? mergeStudentUpdate(st, p) : st));
            return Array.isArray(data) ? merge(data) : { ...data, data: merge(data?.data || []) };
          }
        : null,
  });
  const students = useMemo(
    () => (studentsReq.data?.data || studentsReq.data || []).filter((s) => activeEntryOf(s, id)).sort(byName),
    [studentsReq.data, id],
  );
  useEffect(() => {
    idsRef.current = new Set(students.map((s) => String(s._id)));
  }, [students]);

  // Bugungi davomat (O'quvchilar tabidagi holat pill'i).
  const todayLoad = useCallback(() => workerApi.attendanceToday(id), [id]);
  const todayReq = useScopedLive(todayLoad, [todayLoad], {
    enabled: can("attendance:view"),
    events: ["attendance:marked"],
    match: (_ev, p) => p?.groupId === id,
  });
  const todayMarks = useMemo(() => {
    const m = {};
    (todayReq.data?.records || []).forEach((r) => {
      m[String(r.student)] = { status: r.status, late: !!r.late };
    });
    return m;
  }, [todayReq.data]);

  const tabs = [
    (can("student:view") || can("student:contact")) && { key: "students", label: t("worker.group.tab.students") },
    can("attendance:view") && { key: "attendance", label: t("worker.group.tab.attendance") },
    can("attendance:view") && hasFeature("student.rate") && { key: "grades", label: t("worker.group.tab.grades") },
    can("attendance:view") && hasFeature("homework.manage") && { key: "homework", label: t("worker.group.tab.homework") },
    can("lesson:view") && hasFeature("lesson.planning") && { key: "plan", label: t("worker.group.tab.plan") },
  ].filter(Boolean);
  const active = tabs.some((x) => x.key === tab) ? tab : tabs[0]?.key;

  const perm = {
    list: listAllowed,
    // O'qituvchi → yutuqlar ko'rinishi (tarif bo'lsa), boshqalar → to'liq karta.
    open: teaching ? hasFeature(BADGE_FEATURE) : can("student:view"),
    call: teaching ? can("student:contact") : can("student:contact") || can("student:view"),
    pay: !teaching && can("payment:create"),
    debt: !teaching && can("payment:view"),
    // Individual darsda bitta o'quvchi — qo'shish yo'q.
    add: can("student:create") && g?.status !== "finished" && g?.kind !== "individual",
  };
  const noList = (
    <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noStudentAccess")} text={t("worker.group.noStudentAccessText")} />
  );
  const listPending = studentsReq.loading && !studentsReq.data;

  let body = null;
  if (g && active) {
    const needList = active === "attendance" || active === "grades";
    if (needList && !listAllowed) body = noList;
    else if (needList && listPending) body = <RowsSkeleton count={5} />;
    else if (needList && studentsReq.error && !studentsReq.data)
      body = <ErrorState error={asErr(studentsReq.error)} onRetry={studentsReq.reload} />;
    else if (active === "students")
      body = (
        <StudentsTab
          group={g}
          students={students}
          state={studentsReq}
          todayMarks={todayMarks}
          perm={perm}
          // `student:enrolled` socket ham yangilaydi; bu — ulanish uzilgan holat uchun.
          onAdded={() => studentsReq.reload(true)}
        />
      );
    else if (active === "attendance")
      body = (
        <AttendanceTab
          key={g._id}
          group={g}
          students={students}
          canMark={can("attendance:create") && g.status === "active"}
          minDate={teaching ? tashkentDateShift(-1) : ""}
        />
      );
    else if (active === "grades")
      body = (
        <GradesTab
          key={g._id}
          group={g}
          students={students}
          canWrite={teaching && can("attendance:create") && g.status === "active"}
          canDeleteAny={isOwner || role === "teacher"}
        />
      );
    else if (active === "homework") body = <HomeworkTab key={g._id} group={g} canWrite={can("attendance:create")} />;
    else if (active === "plan") body = <PlanTab key={g._id} group={g} />;
  }

  return (
    <WorkerPage title={t("worker.group.title")}>
      {groupReq.loading && !g ? (
        <>
          <HeaderCardSkeleton />
          <RowsSkeleton count={4} />
        </>
      ) : groupReq.error && !g ? (
        <ErrorState error={asErr(groupReq.error)} onRetry={groupReq.reload} />
      ) : g ? (
        <>
          {readOnly && <ReadOnlyNote />}
          <GroupHeaderCard
            group={g}
            teacherName={names[String(g.teacher)]}
            assistantName={names[String(g.assistant)]}
            studentsCount={studentsReq.data ? students.length : undefined}
          />
          {tabs.length > 1 && (
            <GroupTabs items={tabs} value={active} onChange={(k) => navigate(`/groups/${id}/${k}`, { replace: true })} />
          )}
          {tabs.length === 0 ? <EmptyState icon={HiOutlineLockClosed} title={t("worker.group.noTabs")} /> : body}
        </>
      ) : null}
    </WorkerPage>
  );
};
