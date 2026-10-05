import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiBuildingOffice2,
  HiCalendar,
  HiCalendarDays,
  HiChartBarSquare,
  HiArrowsUpDown,
  HiClock,
  HiDocumentText,
  HiHome,
  HiMinus,
  HiPencilSquare,
  HiPhone,
  HiPlus,
  HiUserGroup,
  HiUsers,
  HiTrophy,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Chip from "../../ui/Chip";
import RowNumber from "../../ui/RowNumber";
import RankMedal from "../../ui/RankMedal";
import RankPeriodLabel from "../../ui/RankPeriodLabel";
import MiniBadges from "../../ui/MiniBadges";
import useGroupBadges from "../../hooks/useGroupBadges";
import Loading from "../../ui/Loading";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Avatar from "../../ui/Avatar";
import DropMenu from "../../ui/DropMenu";
import { InfoMeta } from "../../ui/InfoCard";
import MonthlyAttendance from "../Groups/MonthlyAttendance";
import GradesTab from "../Groups/GradesTab";
import SyllabusTab from "../Groups/SyllabusTab";
import HomeworkTab from "../Groups/HomeworkTab";
import TodayLessonCard from "../Groups/TodayLessonCard";
import GroupHeader from "../Groups/GroupHeader";
import AttendanceStatusCell from "../Groups/AttendanceStatusCell";
import LessonCalendar from "../Groups/LessonCalendar";
import AttendanceDonut from "../Groups/AttendanceDonut";
import StudentDialog from "../Students/StudentDialog";
import StudentContactDialog from "../Students/StudentContactDialog";
import TelegramStatusBadges from "../../ui/TelegramStatusBadges";
import useClosingValue from "../../hooks/useClosingValue";
import { useLessonSchedule } from "../Groups/useLessonSchedule";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import { BADGE_FEATURE } from "../../utils/badges";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { isTodayLessonDay } from "../../utils/schedule";
import {
  SORT_OPTIONS,
  computeRanks,
  isSortableTab,
  sortStudents,
  useSortKey,
  useStudentsSummary,
} from "../Groups/useStudentsSort";

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
  const hasFeature = useFeature();
  const navigate = useNavigate();
  const { _id: userId, role } = useSelector((e) => e.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lesson, setLesson] = useState(null);

  const [centers, setCenters] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const teacherMap = Object.fromEntries(teachers.map((s) => [s._id, s.name]));
  const assistantMap = Object.fromEntries(assistants.map((s) => [s._id, s.name]));

  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState("monthly");
  // Sahifa darajasidagi ikkita bo'lim — GroupDetail bilan AYNAN bir xil
  // (Statistika / O'quvchilar, default O'quvchilar).
  const [section, setSection] = useState("students");

  // "Umumiy" (o'quvchi qo'shish) tab — Group Detail bilan bir xil: faqat
  // `student:create` ruxsati berilgan bo'lsa ko'rinadi.
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollKey, setEnrollKey] = useState(0);
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [attendanceReasons, setAttendanceReasons] = useState({});
  const [attendanceOpenId, setAttendanceOpenId] = useState(null);
  const [excuseTarget, setExcuseTarget] = useState(null);
  const [excuseReason, setExcuseReason] = useState("");
  // Kontaktni tahrirlash (`student:contact`) — GroupDetail bilan bir xil
  // (docs/API_CONTRACT_student_contact_telegram.md §5).
  const [contactTarget, setContactTarget] = useState(null);
  const contactTargetView = useClosingValue(contactTarget);

  const group = lesson?.group || null;
  const groupId = group?._id;

  // O'quvchilar ro'yxatini A-Z/Baholar/Davomat bo'yicha saralash —
  // docs/API_CONTRACT_group_students_sort.md, GroupDetail.jsx bilan bir xil.
  const [sortKey, setSortKey] = useSortKey();
  const studentsSummary = useStudentsSummary(groupId, isSortableTab(tab));
  // O'tgan oy nishonlari — ism yonidagi mini ikonkalar (API_CONTRACT_badges_monthly_rank.md §D.3).
  const groupBadges = useGroupBadges(groupId);
  const sortedStudents = useMemo(
    () => sortStudents(students, sortKey, studentsSummary),
    [students, sortKey, studentsSummary],
  );
  // Top-3 medal — joriy saralashdan mustaqil, haqiqiy baho reytingi.
  const ranks = useMemo(() => computeRanks(studentsSummary), [studentsSummary]);

  const showGrades = can("attendance:view");
  const showSyllabus = can("lesson:view");
  const showHomework = can("attendance:view") && hasFeature("homework.manage");
  const showStudents = can("student:create");
  // Ro'yxat (va ota-ona Telegram holati) kontaktni tahrirlash huquqi bor
  // o'qituvchiga ham ochiladi; "Qo'shish" tugmasi esa faqat `student:create`
  // bilan (docs/API_CONTRACT_student_contact_telegram.md §5).
  const showStudentList = showStudents || can("student:contact");

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
    const [centersRes, teachersRes, assistantsRes, subjectsRes] = await Promise.allSettled([
      api.get("/centers", { params: { page: 1 } }),
      api.get("/staffs/lookup", { params: { role: "teacher" } }),
      api.get("/staffs/lookup", { params: { role: "assistant" } }),
      api.get("/subjects", { params: { page: 1 } }),
    ]);
    if (centersRes.status === "fulfilled" && centersRes.value.data.ok)
      setCenters(centersRes.value.data.data || []);
    if (teachersRes.status === "fulfilled" && teachersRes.value.data.ok)
      setTeachers(teachersRes.value.data.data || []);
    if (assistantsRes.status === "fulfilled" && assistantsRes.value.data.ok)
      setAssistants(assistantsRes.value.data.data || []);
    if (subjectsRes.status === "fulfilled" && subjectsRes.value.data.ok)
      setSubjects(subjectsRes.value.data.data || []);
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchLookups, 0);
    return () => clearTimeout(id);
  }, [fetchLookups]);

  const fetchStudents = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await api.get("/students", {
        // Guruhdan chiqarilganlar dars sahifasida umuman ko'rinmaydi.
        params: { page: 1, group: groupId, status: "active", limit: 1000 },
      });
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

  // "Umumiy" tabdagi davomat holati — GroupDetail.jsx bilan bir xil, bugungi
  // haqiqiy belgilarni serverdan yuklaydi. Bu yo'qligi sababli "Umumiy" tab
  // faqat joriy sessiyada (socket/local mark) belgilangan holatni ko'rsatib,
  // "Davomat" (MonthlyAttendance, o'zining fetch'i bilan) bilan sinxron
  // emas edi — sahifa ochilganda ikkalasi bir xil narsani ko'rsatishi shart.
  const fetchAttendance = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await api.get(`/attendance/${groupId}`);
      const { ok, data } = res.data;
      if (!ok) return;
      const marks = {};
      const reasons = {};
      (data.records || []).forEach((r) => {
        marks[r.student] = r.status;
        if (r.reason) reasons[r.student] = r.reason;
      });
      setAttendanceMarks(marks);
      setAttendanceReasons(reasons);
    } catch {
      // jim o'tkazamiz — asosiy dars ma'lumoti muhimroq
    }
  }, [groupId]);

  useEffect(() => {
    const id = setTimeout(fetchAttendance, 0);
    return () => clearTimeout(id);
  }, [fetchAttendance]);

  // Boshqa tab/xodim shu guruhda davomat belgilasa ham — socket orqali
  // realtime yangilanadi (Group Detail bilan bir xil).
  useSocketEvent(
    "attendance:marked",
    (payload) => {
      if (payload?.groupId !== groupId || !payload?.entry) return;
      setAttendanceMarks((prev) => ({ ...prev, [payload.studentId]: payload.status }));
      setAttendanceReasons((prev) => ({ ...prev, [payload.studentId]: payload.reason || "" }));
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

  // O'quvchi (yangi yoki mavjud) shu guruhga yozilganda — HTTP refetchsiz,
  // to'g'ridan-to'g'ri ro'yxatga qo'shiladi (Group Detail bilan bir xil).
  useSocketEvent(
    "student:enrolled",
    (payload) => {
      if (payload?.groupId !== groupId || !payload?.student || !payload?.entry) return;
      setStudents((prev) => {
        if (prev.some((s) => s._id === payload.student._id)) return prev;
        return [...prev, { ...payload.student, groups: [payload.entry] }];
      });
    },
    !!groupId,
  );

  // Jadval boshqa joydan (/schedule, xona detali) o'zgartirilsa — "joriy
  // dars" kun/vaqt/xonasi refresh'siz eskirib qolmasin deb qayta yuklanadi.
  useSocketEvent(
    "group:changed",
    (payload) => {
      if (payload?.groupId !== groupId) return;
      // Telegram havolasi payload'da keladi — refetch'siz joyida yangilanadi.
      if (payload.action === "telegram") {
        setLesson((prev) =>
          prev?.group ? { ...prev, group: { ...prev.group, telegramLink: payload.telegramLink ?? null } } : prev,
        );
        return;
      }
      fetchLesson();
    },
    !!groupId,
  );

  // O'quvchi boshqa joydan tahrirlansa — refetchsiz joyida yangilanadi
  // (GroupDetail bilan bir xil pattern).
  useSocketEvent(
    "student:updated",
    (payload) => {
      if (!payload?.studentId) return;
      setStudents((prev) =>
        prev.map((s) =>
          s._id !== payload.studentId
            ? s
            : {
                ...s,
                fullName: payload.fullName ?? s.fullName,
                phone: payload.phone ?? s.phone,
                parentPhone: payload.parentPhone ?? s.parentPhone,
                telegramSame: payload.telegramSame ?? s.telegramSame,
                telegramPhone: payload.telegramPhone ?? s.telegramPhone,
                parentTelegramSame: payload.parentTelegramSame ?? s.parentTelegramSame,
                parentTelegramPhone: payload.parentTelegramPhone ?? s.parentTelegramPhone,
                photo: payload.photo !== undefined ? payload.photo : s.photo,
                parentTelegram: payload.parentTelegram ?? s.parentTelegram,
                studentTelegram: payload.studentTelegram ?? s.studentTelegram,
              },
        ),
      );
    },
    !!groupId,
  );

  // Ota-ona botga ulandi/uzildi/bloklandi — Telegram holati joyida
  // (docs/API_CONTRACT_student_contact_telegram.md §4).
  // Kontakt tahrirlash javobini (teacher uchun strip qilingan DTO) qatorga
  // birlashtiradi — faqat kontakt maydonlari, `groups` va boshqalar saqlanadi.
  // Hook bo'lgani uchun shartli return'lardan OLDIN e'lon qilinadi.
  const mergeContact = useCallback((studentId, patch) => {
    if (!studentId || !patch) return;
    setStudents((prev) =>
      prev.map((st) =>
        st._id !== studentId
          ? st
          : {
              ...st,
              fullName: patch.fullName ?? st.fullName,
              phone: patch.phone ?? st.phone,
              parentPhone: patch.parentPhone ?? st.parentPhone,
              telegramSame: patch.telegramSame ?? st.telegramSame,
              telegramPhone: patch.telegramPhone ?? st.telegramPhone,
              parentTelegramSame: patch.parentTelegramSame ?? st.parentTelegramSame,
              parentTelegramPhone: patch.parentTelegramPhone ?? st.parentTelegramPhone,
              parentTelegram: patch.parentTelegram ?? st.parentTelegram,
              studentTelegram: patch.studentTelegram ?? st.studentTelegram,
            },
      ),
    );
  }, []);

  useSocketEvent(
    "student:telegram",
    (payload) => {
      if (!Array.isArray(payload?.items)) return;
      const byId = new Map(payload.items.map((it) => [String(it.studentId), it]));
      setStudents((prev) =>
        prev.map((s) => {
          const it = byId.get(s._id);
          return it ? { ...s, parentTelegram: it.parentTelegram, studentTelegram: it.studentTelegram } : s;
        }),
      );
    },
    !!groupId,
  );

  // O'quvchi shu guruhdan chiqarilsa/arxivlansa/o'tkazilsa — darhol yo'qoladi.
  useSocketEvent(
    "student:leftGroup",
    (payload) => {
      if (!payload?.groupEntryId) return;
      setStudents((prev) =>
        prev.filter((s) => !s.groups.some((g) => g._id === payload.groupEntryId && g.group === groupId)),
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

  const todayLesson = isTodayLessonDay(group);

  const markAttendance = async (studentId, mark, reason = "") => {
    try {
      const res = await api.post(`/attendance/${groupId}/mark`, { studentId, status: mark, reason });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      setAttendanceMarks((prev) => ({ ...prev, [studentId]: mark }));
      setAttendanceReasons((prev) => ({ ...prev, [studentId]: reason }));
      setAttendanceOpenId(null);
      setStudents((prev) =>
        prev.map((s) =>
          s._id !== studentId
            ? s
            : { ...s, groups: s.groups.map((g) => (g._id === data.entry._id ? data.entry : g)) },
        ),
      );
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const openExcuse = (student) => {
    setExcuseReason(attendanceReasons[student._id] || "");
    setExcuseTarget({ student });
  };

  const saveExcuse = () => {
    if (!excuseTarget) return;
    markAttendance(excuseTarget.student._id, "excused", excuseReason.trim());
    setExcuseTarget(null);
  };

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <GroupHeader
        group={group}
        label={groupLabel}
        status={<Chip value={t("dashboard.lessonStatus.ongoing")} color="blue" variant="filled" />}
        details={
          <>
            <InfoMeta icon={<HiBuildingOffice2 />}>{centerMap[group.center] || "—"}</InfoMeta>
            <InfoMeta icon={<HiUsers />}>{teacherMap[group.teacher] || t("group.noTeacher")}</InfoMeta>
            {group.assistant && (
              <InfoMeta icon={<HiUsers />}>
                {t("group.assistant")}: {assistantMap[group.assistant] || "—"}
              </InfoMeta>
            )}
            <InfoMeta icon={<HiHome />}>{group.roomName || "—"}</InfoMeta>
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
          </>
        }
        studentsCount={group.studentsCount || 0}
        extra={
          showSyllabus ? (
            <TodayLessonCard todayLesson={schedule.todayLesson} nextLesson={schedule.nextLesson} />
          ) : null
        }
        canEditTelegram={role === "teacher"}
        onTelegramSaved={(data) =>
          setLesson((prev) =>
            prev?.group
              ? { ...prev, group: { ...prev.group, telegramLink: data?.telegramLink ?? null } }
              : prev,
          )
        }
      />

      {/* Sahifa bo'limlari — GroupDetail va website PanelShowcase bilan bir xil. */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "students", label: t("group.tabStudentsSection"), Icon: HiUsers },
          { key: "stats", label: t("group.tabStatistics"), Icon: HiChartBarSquare },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              section === item.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <item.Icon className="text-base shrink-0" />
            {item.label}
          </button>
        ))}
      </div>

      {section === "stats" && (
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

      )}

      {section === "students" && (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit max-w-full overflow-x-auto">
            {/* "Umumiy" — Group Detail bilan bir xil: faqat `student:create`
                ruxsati berilgan bo'lsa ko'rinadi (docs API_CONTRACT.md). */}
            {showStudentList && (
              <button
                type="button"
                onClick={() => setTab("general")}
                className={`px-3 h-8 shrink-0 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  tab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("group.tabGeneral")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab("monthly")}
              className={`px-3 h-8 shrink-0 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                tab === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t("group.tabMonthly")}
            </button>
            {showGrades && (
              <button
                type="button"
                onClick={() => setTab("grades")}
                className={`px-3 h-8 shrink-0 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  tab === "grades" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("grade.tab")}
              </button>
            )}
            {showHomework && (
              <button
                type="button"
                onClick={() => setTab("homework")}
                className={`px-3 h-8 shrink-0 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  tab === "homework" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("homework.tab")}
              </button>
            )}
            {showSyllabus && (
              <button
                type="button"
                onClick={() => setTab("plan")}
                className={`px-3 h-8 shrink-0 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  tab === "plan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t("syllabus.tab")}
              </button>
            )}
          </div>
          {isSortableTab(tab) && showStudentList && (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {Object.keys(ranks).length > 0 && <RankPeriodLabel />}
              <Select
                variant="slate"
                icon={<HiArrowsUpDown className="text-base" />}
                value={sortKey}
                onChange={setSortKey}
                className="w-full sm:w-auto sm:min-w-[220px]"
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              />
              {tab === "general" && showStudents && (
              <Button
                variant="outlined"
                className="gap-1.5 w-full sm:w-auto"
                onClick={() => {
                  setEnrollKey((k) => k + 1);
                  setEnrollOpen(true);
                }}
              >
                <HiPlus className="text-base" />
                {t("student.create")}
              </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-h-[28rem]">
          {tab === "general" && showStudentList ? (
            students.length === 0 ? (
              <div className="flex flex-1 items-center justify-center w-full text-slate-400 text-sm">
                {t("student.empty")}
              </div>
            ) : (
              <div className="flex flex-col w-full overflow-hidden rounded-lg border border-slate-100">
                <div className="hidden sm:grid grid-cols-[1fr_140px_44px] gap-2 px-3 py-2 bg-slate-50 text-[11px] font-semibold uppercase text-slate-400">
                  <span>{t("student.fullName")}</span>
                  <span>{t("group.attendanceColumn")}</span>
                  <span />
                </div>
                {sortedStudents.map((s, index) => {
                  const entry = s.groups.find((g) => g.group === groupId && g.status === "active");
                  if (!entry) return null;
                  return (
                    <div
                      key={s._id}
                      className="relative grid grid-cols-1 sm:grid-cols-[1fr_140px_44px] items-center gap-2 px-3 py-2.5 border-t border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-9 sm:pr-0">
                        <RowNumber value={index + 1} />
                        <Avatar user={{ _id: s._id, name: s.fullName }} size={38} />
                        <div className="flex flex-col min-w-0">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-slate-800 truncate">{s.fullName}</span>
                            <RankMedal position={ranks[s._id]} size={21} />
                            <MiniBadges types={groupBadges.items[s._id]} month={groupBadges.month} />
                          </span>
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                            <span className="text-xs text-slate-400 shrink-0">{s.phone}</span>
                            <TelegramStatusBadges student={s.studentTelegram} parent={s.parentTelegram} />
                          </span>
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                        <AttendanceStatusCell
                          status={attendanceMarks[s._id]}
                          isToday={!!todayLesson}
                          open={attendanceOpenId === s._id}
                          onOpen={() => setAttendanceOpenId(s._id)}
                          onMark={(mark) => markAttendance(s._id, mark)}
                          onExcuse={() => openExcuse(s)}
                        />
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 sm:static sm:flex sm:justify-end"
                      >
                        <DropMenu
                          items={[
                            {
                              label: t("student.callAction"),
                              icon: HiPhone,
                              iconClass: "bg-blue-50 text-blue-600",
                              onClick: () => {
                                window.location.href = `tel:${s.phone}`;
                              },
                            },
                            ...(hasFeature(BADGE_FEATURE)
                              ? [
                                  {
                                    label: t("badge.action"),
                                    icon: HiTrophy,
                                    iconClass: "bg-amber-50 text-amber-600",
                                    onClick: () => navigate(`/students/${s._id}`),
                                  },
                                ]
                              : []),
                            ...(!can("student:update") && can("student:contact")
                              ? [
                                  {
                                    label: t("common.edit"),
                                    icon: HiPencilSquare,
                                    iconClass: "bg-blue-50 text-blue-600",
                                    onClick: () => setContactTarget(s),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : tab === "grades" && showGrades ? (
            <GradesTab
              groupId={groupId}
              students={sortedStudents}
              ranks={ranks}
              canWrite={can("attendance:create") && group.status === "active"}
              canDeleteAny={false}
              userId={userId}
            />
          ) : tab === "homework" && showHomework ? (
            <HomeworkTab
              groupId={groupId}
              canWrite={can("attendance:create") && group.status === "active"}
              lessonByDate={schedule.lessonByDate}
              extendTo={schedule.extendTo}
            />
          ) : tab === "plan" && showSyllabus ? (
            <SyllabusTab groupId={groupId} canWrite={false} canImport={false} />
          ) : (
            <MonthlyAttendance
              groupId={groupId}
              students={sortedStudents}
              ranks={ranks}
              canMark={can("attendance:create") && group.status === "active"}
              minDate={yesterdayString()}
              onOpenStudent={hasFeature(BADGE_FEATURE) ? (s) => navigate(`/students/${s._id}`) : undefined}
            />
          )}
        </div>
      </div>
      )}

      <StudentDialog
        key={`enroll-${enrollKey}`}
        open={enrollOpen}
        fixedGroup={group}
        subjects={subjects}
        onClose={() => setEnrollOpen(false)}
        onSaved={() => setEnrollOpen(false)}
      />

      {contactTargetView && (
        <StudentContactDialog
          key={contactTargetView._id}
          open={!!contactTarget}
          student={contactTargetView}
          onClose={() => setContactTarget(null)}
          onSaved={(data) => mergeContact(data?._id, data)}
        />
      )}

      <Dialog
        open={!!excuseTarget}
        onClose={() => setExcuseTarget(null)}
        title={t("group.excuseTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setExcuseTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="orange" onClick={saveExcuse}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>
              <span className="text-slate-400">{t("student.fullName")}:</span>{" "}
              <span className="font-semibold text-slate-800">{excuseTarget?.student?.fullName}</span>
            </span>
            <span>
              <span className="text-slate-400">{t("student.receiptGroupLabel")}:</span>{" "}
              <span className="font-semibold text-slate-800">{groupLabel}</span>
            </span>
            <span>
              <span className="text-slate-400">{t("center.date")}:</span>{" "}
              <span className="font-semibold text-slate-800">{new Date().toLocaleDateString("uz-UZ")}</span>
            </span>
          </div>
          <Input
            label={t("group.excuseReasonLabel")}
            placeholder={t("group.excuseReasonPlaceholder")}
            value={excuseReason}
            onChange={(e) => setExcuseReason(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default Lesson;
