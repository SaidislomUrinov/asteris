import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiBuildingOffice2,
  HiCalendar,
  HiCalendarDays,
  HiClock,
  HiHome,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import MonthlyAttendance from "../Groups/MonthlyAttendance";
import GradesTab from "../Groups/GradesTab";
import SyllabusTab from "../Groups/SyllabusTab";
import TodayLessonCard from "../Groups/TodayLessonCard";
import LessonCalendar from "../Groups/LessonCalendar";
import AttendanceDonut from "../Groups/AttendanceDonut";
import { useLessonSchedule } from "../Groups/useLessonSchedule";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useCan from "../../hooks/useCan";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// O'qituvchi faqat bugun va kecha uchun davomat belgilay oladi (server ham
// shuni majburlaydi — Group Detail bilan bir xil qoida).
const yesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * "Dars" sahifasi (`/lesson`) — Teacher/Assistant uchun, `GET
 * /teacher/current-lesson` orqali serverda hisoblangan "hozir davom
 * etayotgan dars"ni ko'rsatadi. Ko'rinish va komponentlar Group Detail'ning
 * (`/groups/:id`) teacher-shoxobchasi bilan AYNAN bir xil — shu sabab har
 * ikkalasi ham bir xil komponentlarni (MonthlyAttendance/GradesTab/
 * SyllabusTab/useLessonSchedule) qayta ishlatadi va ularning ICHKI socket
 * sinxronizatsiyasidan bepul foydalanadi (API_CONTRACT.md "FullSocketSync").
 */
function Lesson() {
  const { t } = useTranslation();
  const can = useCan();
  const { _id: userId } = useSelector((e) => e.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lesson, setLesson] = useState(null);

  const [centers, setCenters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const teacherMap = Object.fromEntries(teachers.map((s) => [s._id, s.name]));
  const assistantMap = Object.fromEntries(assistants.map((s) => [s._id, s.name]));

  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState("monthly");

  const group = lesson?.group || null;
  const groupId = group?._id;

  const showGrades = can("attendance:view");
  const showSyllabus = can("lesson:view");

  const schedule = useLessonSchedule({
    groupId,
    days: group?.days || [],
    status: group?.status,
    activatedAt: group?.activatedAt,
    finishedAt: group?.finishedAt,
    enabled: showSyllabus,
  });

  const fetchLesson = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/teacher/current-lesson");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setLesson(data);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchLesson, 0);
    return () => clearTimeout(id);
  }, [fetchLesson]);

  const fetchLookups = useCallback(async () => {
    try {
      const [centersRes, teachersRes, assistantsRes] = await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }),
        api.get("/staffs/lookup", { params: { role: "assistant" } }),
      ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (teachersRes.data.ok) setTeachers(teachersRes.data.data || []);
      if (assistantsRes.data.ok) setAssistants(assistantsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchLookups, 0);
    return () => clearTimeout(id);
  }, [fetchLookups]);

  const fetchStudents = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await api.get("/students", { params: { page: 1, group: groupId } });
      const { ok, data } = res.data;
      if (ok) setStudents(data || []);
    } catch {
      // jim o'tkazamiz — asosiy dars ma'lumoti muhimroq
    }
  }, [groupId]);

  useEffect(() => {
    const id = setTimeout(fetchStudents, 0);
    return () => clearTimeout(id);
  }, [fetchStudents]);

  // Boshqa tab/xodim shu guruhda davomat belgilasa ham — socket orqali
  // realtime yangilanadi (Group Detail bilan bir xil).
  useSocketEvent(
    "attendance:marked",
    (payload) => {
      if (payload?.groupId !== groupId || !payload?.entry) return;
      setStudents((prev) =>
        prev.map((s) =>
          s._id !== payload.studentId
            ? s
            : { ...s, groups: s.groups.map((g) => (g._id === payload.entry._id ? payload.entry : g)) },
        ),
      );
    },
    !!groupId,
  );

  if (loading) return <Loading height="40vh" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiUserGroup className="text-4xl" />
        <p className="text-sm">{t("lesson.error")}</p>
        <Button variant="outlined" onClick={fetchLesson}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center gap-2 py-10 px-4 text-center">
        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-2xl text-slate-300">
          <HiCalendarDays />
        </span>
        <p className="text-sm font-medium text-slate-600">{t("lesson.emptyState")}</p>
        <p className="text-xs text-slate-400 max-w-xs">{t("lesson.emptyHint")}</p>
      </div>
    );
  }

  const groupLabel = `${group.subjectName || "?"} - ${
    group.status === "pending" ? group.pendingId : group.activeId
  }`;

  const courseStartMonth = group.activatedAt
    ? (() => {
        const d = new Date(group.activatedAt * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })()
    : null;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={<HiUserGroup />}
          title={groupLabel}
          subtitle={t("group.infoCardDesc")}
          accent="blue"
          badge={<Chip value={t("dashboard.lessonStatus.ongoing")} color="blue" variant="filled" />}
        >
          <div className="flex flex-wrap items-center gap-2">
            {group.days?.length ? (
              group.days.map((d) => (
                <Chip key={d} value={t(`group.day.${d}`)} color="slate" variant="ghost" />
              ))
            ) : (
              <span className="text-sm text-slate-400">{t("group.days")}: —</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100">
            <InfoMeta icon={<HiBuildingOffice2 />}>{centerMap[group.center] || "—"}</InfoMeta>
            <InfoMeta icon={<HiUsers />}>{teacherMap[group.teacher] || t("group.noTeacher")}</InfoMeta>
            {group.assistant && (
              <InfoMeta icon={<HiUsers />}>
                {t("group.assistant")}: {assistantMap[group.assistant] || "—"}
              </InfoMeta>
            )}
            {group.roomName && <InfoMeta icon={<HiHome />}>{group.roomName}</InfoMeta>}
            {(group.startTime || group.endTime) && (
              <InfoMeta icon={<HiClock />}>
                {group.startTime || "—"} — {group.endTime || "—"}
              </InfoMeta>
            )}
            {group.activatedDate && (
              <InfoMeta icon={<HiCalendar />}>
                {t("group.startedDate")}: {group.activatedDate}
              </InfoMeta>
            )}
          </div>
        </InfoCard>

        <MetricCard
          icon={<HiUsers />}
          title={t("group.studentsCount")}
          subtitle={t("group.studentsCardDesc")}
          value={group.studentsCount || 0}
          suffix={group.maxStudents ? `/ ${group.maxStudents}` : null}
          accent="violet"
        />

        {showSyllabus && (
          <TodayLessonCard todayLesson={schedule.todayLesson} nextLesson={schedule.nextLesson} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
        <LessonCalendar
          groupId={groupId}
          days={group.days}
          status={group.status}
          activatedAt={group.activatedAt}
          finishedAt={group.finishedAt}
          onChange={fetchStudents}
          showPlans={showSyllabus}
          schedule={schedule}
        />
        <AttendanceDonut groupId={groupId} courseStartMonth={courseStartMonth} />
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
          <button
            type="button"
            onClick={() => setTab("monthly")}
            className={`px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
              tab === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t("group.tabMonthly")}
          </button>
          {showGrades && (
            <button
              type="button"
              onClick={() => setTab("grades")}
              className={`px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                tab === "grades" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t("grade.tab")}
            </button>
          )}
          {showSyllabus && (
            <button
              type="button"
              onClick={() => setTab("plan")}
              className={`px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                tab === "plan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t("syllabus.tab")}
            </button>
          )}
        </div>

        <div className="flex flex-col flex-1 min-h-[28rem]">
          {tab === "grades" && showGrades ? (
            <GradesTab
              groupId={groupId}
              students={students}
              canWrite={can("attendance:create") && group.status === "active"}
              canDeleteAny={false}
              userId={userId}
            />
          ) : tab === "plan" && showSyllabus ? (
            <SyllabusTab groupId={groupId} canWrite={false} canImport={false} />
          ) : (
            <MonthlyAttendance
              groupId={groupId}
              students={students}
              canMark={can("attendance:create") && group.status === "active"}
              minDate={yesterdayString()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Lesson;
