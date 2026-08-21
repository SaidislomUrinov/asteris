import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  HiArrowLeft,
  HiArrowsRightLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendar,
  HiCheckCircle,
  HiClock,
  HiDocumentText,
  HiEye,
  HiFlag,
  HiHome,
  HiMinus,
  HiPhone,
  HiPlus,
  HiUserGroup,
  HiUserMinus,
  HiUsers,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import ProgressBar from "../../ui/ProgressBar";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import Avatar from "../../ui/Avatar";
import DropMenu from "../../ui/DropMenu";
import GroupActivateDialog from "./GroupActivateDialog";
import GroupScheduleDialog from "./GroupScheduleDialog";
import RevenueChart from "./RevenueChart";
import PaymentDonut from "./PaymentDonut";
import LessonCalendar from "./LessonCalendar";
import AttendanceDonut from "./AttendanceDonut";
import MonthlyAttendance from "./MonthlyAttendance";
import GradesTab from "./GradesTab";
import SyllabusTab from "./SyllabusTab";
import TodayLessonCard from "./TodayLessonCard";
import { useLessonSchedule } from "./useLessonSchedule";
import useCan from "../../hooks/useCan";
import TransferStudentDialog from "./TransferStudentDialog";
import StudentDialog from "../Students/StudentDialog";
import PaymentDialog from "../Students/PaymentDialog";
import ReceiptPromptDialog from "../Students/ReceiptPromptDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { isTodayLessonDay } from "../../utils/schedule";

// O'qituvchi faqat bugun va kecha uchun davomat belgilay oladi (server ham
// shuni majburlaydi — attendance.service.js "teacherDateLimit").
const yesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function GroupDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const can = useCan();
  // O'qituvchi MOLIYAVIY ustunlarni ko'rmaydi (server ham bu maydonlarni
  // yubormaydi — utils/teacherView.util.js), UI shunga moslashadi.
  const { _id: userId, authType, role } = useSelector((e) => e.user);
  // Moliyaviy ma'lumot ko'rmaydigan rollar (server ham bu maydonlarni
  // yubormaydi — utils/teacherView.util.js).
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  // Baho va dars rejasini YOZISH — faqat darsni olib boruvchi kishi:
  // o'qituvchi va yordamchi o'qituvchi. Resepshin faqat ko'radi, Boshliq
  // faqat o'chiradi (API_CONTRACT_grade_lesson_roles.md).
  const canWriteStudy = authType === "staff" && ["teacher", "assistant"].includes(role);
  const canDeleteAnyStudy = authType === "owner" || role === "teacher";
  // Kurs dasturini yozish: boshliq + o'qituvchi/yordamchi (resepshin faqat ko'radi).
  const canWriteSyllabus = authType === "owner" || canWriteStudy;
  // Kalendarda sana→mavzu ko'rsatish va "Bugungi dars" kartochkasi —
  // ikkalasi ham bitta shartga bog'liq.
  const showPlans = isTeacher && can("lesson:view");

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const subjectPriceMap = Object.fromEntries(subjects.map((s) => [s._id, s.price]));
  const teacherMap = Object.fromEntries(teachers.map((s) => [s._id, s.name]));
  const assistantMap = Object.fromEntries(assistants.map((s) => [s._id, s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r._id, r.name]));

  const [activateOpen, setActivateOpen] = useState(false);
  const [activateKey, setActivateKey] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [finishTarget, setFinishTarget] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollKey, setEnrollKey] = useState(0);
  const [payTarget, setPayTarget] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferKey, setTransferKey] = useState(0);

  // Kunlik davomat — bugungi sessiya `/attendance/:groupId`dan yuklanadi va
  // belgilash real API (`POST /attendance/:groupId/mark`) orqali amalga
  // oshadi (attendance.service.js "applyCredit" — to'lovga ta'siri bilan
  // birga). Faqat bugun shu guruh uchun dars kuni bo'lsagina belgilash
  // mumkin (isTodayLessonDay).
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [attendanceReasons, setAttendanceReasons] = useState({});
  const [attendanceOpenId, setAttendanceOpenId] = useState(null);
  // O'quvchilar bloki ikkita tab: "Umumiy" (ro'yxat) va "Oylik davomat"
  // (o'quvchi × dars-kuni matritsasi — API_CONTRACT_attendance_month.md).
  // O'qituvchi/yordamchida "Umumiy" tab yo'q — ular uchun boshlang'ich
  // ko'rinish darhol "Davomat" bo'ladi.
  const [studentTab, setStudentTab] = useState(isTeacher ? "monthly" : "general");
  const [excuseTarget, setExcuseTarget] = useState(null);
  const [excuseReason, setExcuseReason] = useState("");

  // Dars kunlari, dam olish kunlari va sana→mavzu moslashuvi — BITTA manba
  // (useLessonSchedule): kalendar ham, "Bugungi dars" kartochkasi ham shundan
  // oziqlanadi, ya'ni ikkalasi hech qachon bir-biriga zid ko'rsatmaydi.
  const schedule = useLessonSchedule({
    groupId: id,
    days: group?.days || [],
    status: group?.status,
    activatedAt: group?.activatedAt,
    finishedAt: group?.finishedAt,
    enabled: showPlans,
  });

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await api.get(`/attendance/${id}`);
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
      // jim o'tkazamiz — asosiy guruh ma'lumoti muhimroq
    }
  }, [id]);

  const fetchStudents = useCallback(async () => {
    try {
      setStudentsLoading(true);
      const res = await api.get("/students", { params: { page: 1, group: id } });
      const { ok, data } = res.data;
      if (ok) setStudents(data || []);
    } catch {
      // jim o'tkazamiz — asosiy guruh ma'lumoti muhimroq
    } finally {
      setStudentsLoading(false);
    }
  }, [id]);

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      const res = await api.get(`/groups/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "group.notFound") setNotFound(true);
        throw new Error(msg);
      }
      setGroup(data);
    } catch (error) {
      if (!notFound) setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLookups = useCallback(async () => {
    try {
      const [centersRes, subjectsRes, staffRes, assistantRes, roomsRes, groupsRes] =
        await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }),
        api.get("/staffs/lookup", { params: { role: "assistant" } }),
        api.get("/rooms", { params: { page: 1 } }),
        api.get("/groups", { params: { page: 1 } }),
        ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (staffRes.data.ok) setTeachers(staffRes.data.data || []);
      if (assistantRes.data.ok) setAssistants(assistantRes.data.data || []);
      if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
      if (groupsRes.data.ok) setAllGroups(groupsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const confirmLeave = async () => {
    if (!leaveTarget) return;
    try {
      setLeaving(true);
      const res = await api.patch(`/students/${leaveTarget.student._id}/groups/${leaveTarget.entry._id}/leave`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setLeaveTarget(null);
      fetchStudents();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLeaving(false);
    }
  };

  const confirmFinish = async () => {
    try {
      setFinishing(true);
      const res = await api.patch(`/groups/${id}/finish`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setFinishTarget(false);
      fetchGroup();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setFinishing(false);
    }
  };

  // Studentlar ro'yxatidagi bitta guruh-yozuvini (masalan qarzdorlik/kredit
  // o'zgarganda) HTTP so'rovsiz, to'g'ridan-to'g'ri almashtiradi — bir xil
  // funksiya ham o'z amalimizdan (POST javobi), ham socket orqali kelgan
  // boshqa foydalanuvchi/tab hodisasidan chaqiriladi. Hook bo'lgani uchun
  // (useCallback/useSocketEvent) shartli return'lardan OLDIN chaqirilishi
  // shart (React Hooks qoidasi).
  const applyEntryUpdate = useCallback((studentId, entry) => {
    if (!entry) return;
    setStudents((prev) =>
      prev.map((s) =>
        s._id !== studentId
          ? s
          : { ...s, groups: s.groups.map((g) => (g._id === entry._id ? entry : g)) },
      ),
    );
  }, []);

  // Boshqa tab/xodim shu guruhda davomat belgilasa ham — socket orqali
  // realtime yangilanadi, hech kim qo'lda refresh qilmaydi
  // (API_CONTRACT_attendance_socket.md).
  useSocketEvent(
    "attendance:marked",
    (payload) => {
      if (payload?.groupId !== id) return;
      setAttendanceMarks((prev) => ({ ...prev, [payload.studentId]: payload.status }));
      setAttendanceReasons((prev) => ({ ...prev, [payload.studentId]: payload.reason || "" }));
      applyEntryUpdate(payload.studentId, payload.entry);
    },
    !!id,
  );

  if (loading) return <Loading height="40vh" />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiUserGroup className="text-4xl" />
        <p className="text-sm">{t("group.notFound")}</p>
        <Button variant="outlined" onClick={() => navigate("/groups")}>
          {t("group.backToList")}
        </Button>
      </div>
    );
  }

  if (!group) return null;

  const todayLesson = isTodayLessonDay(group);
  const courseStartMonth = group.activatedAt
    ? (() => {
        const d = new Date(group.activatedAt * 1000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })()
    : null;

  const markAttendance = async (studentId, mark, reason = "") => {
    try {
      const res = await api.post(`/attendance/${id}/mark`, { studentId, status: mark, reason });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      setAttendanceMarks((prev) => ({ ...prev, [studentId]: mark }));
      setAttendanceReasons((prev) => ({ ...prev, [studentId]: reason }));
      setAttendanceOpenId(null);
      applyEntryUpdate(studentId, data.entry);
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

  const groupLabel = `${group.subjectName || subjectMap[group.subject] || "?"} - ${
    group.status === "pending" ? group.pendingId : group.activeId
  }${group.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""}`;

  const monthlyFee = subjectPriceMap[group.subject] || 0;
  // Joriy sikl (filial sozlamasiga qarab — sanadan-sanaga YOKI oy boshidan
  // oy boshiga) uchun to'langan/to'lanishi kerak summalar — ikkalasi ham
  // computeBilling'dan (server) to'g'ridan-to'g'ri keladi
  // (`currentCyclePrice`/`paidForCurrentCycle`), shu sikl chegaralariga mos
  // bo'lgani uchun. Eslatma: avval bu yerda `currentMonthDue` (faqat
  // O'TGAN kunlar uchun hisoblangan, hali TO'LIQ sikl summasi emas)
  // ishlatilgan edi — shu sabab donut noto'g'ri, kichikroq raqam ko'rsatib
  // turgan edi.
  const monthlyRevenue = students.reduce((sum, s) => {
    const entry = s.groups.find((g) => g.group === id);
    if (!entry || entry.status !== "active") return sum;
    return sum + (entry.paidForCurrentCycle || 0);
  }, 0);

  // Joriy sikl uchun qarzdorlik — donut chartda "qarzdorlar" segmenti.
  const monthlyDebt = students.reduce((sum, s) => {
    const entry = s.groups.find((g) => g.group === id);
    if (!entry || entry.status !== "active") return sum;
    return sum + Math.max(0, (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0));
  }, 0);

  const allPayments = students.flatMap((s) => {
    const entry = s.groups.find((g) => g.group === id);
    return entry?.payments || [];
  });

  // Sarlavha qatoridagi amallar — guruh statusiga bog'liq. Mobil (ikonka)
  // va desktop (matnli) variantlar AYNAN shu ro'yxatdan chiziladi, shunda
  // biriga qo'shilgan amal ikkinchisida tushib qolmaydi.
  // Guruhni faollashtirish / jadval / yakunlash — bular `group:update`
  // amallari. O'qituvchida bu ruxsat yo'q, shuning uchun tugmalar ham
  // ko'rinmaydi (backend baribir rad etadi, bu UI aks-sadosi).
  const canManageGroup = can("group:update");
  const topActions = [
    ...(canManageGroup && group.status === "pending"
      ? [
          {
            key: "activate",
            icon: HiCheckCircle,
            label: t("group.activate"),
            color: "emerald",
            variant: "filled",
            onClick: () => {
              setActivateKey((k) => k + 1);
              setActivateOpen(true);
            },
          },
        ]
      : []),
    ...(canManageGroup && group.status === "active"
      ? [
          {
            key: "schedule",
            icon: HiClock,
            label: t("group.editScheduleAction"),
            color: "blue",
            variant: "outlined",
            onClick: () => {
              setScheduleKey((k) => k + 1);
              setScheduleOpen(true);
            },
          },
          {
            key: "finish",
            icon: HiFlag,
            label: t("group.finishAction"),
            color: "orange",
            variant: "filled",
            onClick: () => setFinishTarget(true),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>

        {/* Mobilda matnli tugmalar sig'maydi (guruh statusiga qarab 3tagacha
            bo'lishi mumkin) — shuning uchun kichik ekranda faqat ikonka,
            sm dan boshlab matnli tugma ko'rsatiladi. Ro'yxat bitta joyda
            e'lon qilinadi, ikkala variant ham shundan chiziladi. */}
        {/* Ko'rsatish/yashirish KONTEYNER div'da, tugmaning o'zida emas —
            Button/IconButton ning base class'idagi `inline-flex` bevosita
            berilgan `hidden` ni bosib ketadi (ikkalasi ham display
            utility, CSS tartibi hal qiladi). */}
        <div className="flex items-center gap-2 sm:hidden">
          {topActions.map((action) => (
            <IconButton
              key={action.key}
              color={action.color}
              variant={action.variant}
              title={action.label}
              onClick={action.onClick}
            >
              <action.icon />
            </IconButton>
          ))}
          {!isTeacher && <ExportExcelButton endpoint={`/groups/${id}/export`} variant="icon" />}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          {topActions.map((action) => (
            <Button
              key={action.key}
              color={action.color}
              variant={action.variant}
              className="gap-1.5"
              onClick={action.onClick}
            >
              <action.icon className="text-base" />
              {action.label}
            </Button>
          ))}
          {!isTeacher && <ExportExcelButton endpoint={`/groups/${id}/export`} />}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={<HiUserGroup />}
          title={groupLabel}
          subtitle={t("group.infoCardDesc")}
          accent="blue"
          badge={
            <Chip
              value={t(`group.status${group.status[0].toUpperCase()}${group.status.slice(1)}`)}
              variant="filled"
            />
          }
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
            <InfoMeta icon={<HiUsers />}>
              {teacherMap[group.teacher] || t("group.noTeacher")}
            </InfoMeta>
            {/* Yordamchi o'qituvchi — biriktirilgan bo'lsagina ko'rinadi */}
            {group.assistant && (
              <InfoMeta icon={<HiUsers />}>
                {t("group.assistant")}: {assistantMap[group.assistant] || "—"}
              </InfoMeta>
            )}
            <InfoMeta icon={<HiHome />}>
              {group.roomName || roomMap[group.room] || "—"}
            </InfoMeta>
            {(group.startTime || group.endTime) && (
              <InfoMeta icon={<HiClock />}>
                {group.startTime || "—"} — {group.endTime || "—"}
              </InfoMeta>
            )}
            {group.date && (
              <InfoMeta icon={<HiCalendar />}>
                {t("group.createdDate")}: {group.date}
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
        >
          {group.status === "pending" && group.maxStudents ? (
            <ProgressBar value={group.studentsCount || 0} max={group.maxStudents} color="orange" />
          ) : null}
        </MetricCard>

        {/* Uchinchi katak rolga qarab: Boshliq/resepshin oylik to'lovni
            ko'radi (moliyaviy ma'lumot o'qituvchiga yubormaymiz), o'qituvchi
            esa o'sha joyda "Bugungi dars"ni ko'radi. */}
        {!isTeacher ? (
          <MetricCard
            icon={<HiBanknotes />}
            title={t("group.monthlyFee")}
            subtitle={t("group.monthlyFeeCardDesc")}
            value={monthlyFee.toLocaleString("uz-UZ")}
            suffix={t("student.somSuffix")}
            accent="emerald"
          />
        ) : (
          showPlans && (
            <TodayLessonCard
              todayLesson={schedule.todayLesson}
              nextLesson={schedule.nextLesson}
            />
          )
        )}
      </div>

      {/* Moliyaviy grafiklar — o'qituvchiga ko'rsatilmaydi */}
      {!isTeacher && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <div className="lg:col-span-1">
          <PaymentDonut paid={monthlyRevenue} debt={monthlyDebt} />
        </div>
        <div className="lg:col-span-2">
          <RevenueChart payments={allPayments} />
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
        <LessonCalendar
          groupId={id}
          days={group.days}
          status={group.status}
          activatedAt={group.activatedAt}
          finishedAt={group.finishedAt}
          onChange={fetchStudents}
          showPlans={showPlans}
          schedule={schedule}
        />
        <AttendanceDonut groupId={id} courseStartMonth={courseStartMonth} />
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Ikkita ko'rinish: oddiy ro'yxat va oylik davomat matritsasi */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            {[
              // "Umumiy" — o'quvchilar ro'yxati, ichida boshqa guruhga
              // o'tkazish / guruhdan chiqarish amallari bor. Bular
              // RESEPSHIN va BOSHLIQ ishi, o'qituvchi/yordamchiga umuman
              // kerak emas — shuning uchun tab ular uchun ochilmaydi
              // (ularda: Davomat, Baholar, Reja).
              ...(isTeacher ? [] : [{ key: "general", label: t("group.tabGeneral") }]),
              { key: "monthly", label: t("group.tabMonthly") },
              ...(can("attendance:view") ? [{ key: "grades", label: t("grade.tab") }] : []),
              ...(can("lesson:view") ? [{ key: "plan", label: t("syllabus.tab") }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStudentTab(tab.key)}
                className={`px-3 h-8 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                  studentTab === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {studentTab === "general" && group.status !== "finished" && can("student:create") && (
            <Button
              variant="outlined"
              className="gap-1.5"
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

        {/* Tab kontenti uchun barqaror maydon: yuklanish paytida ham,
            almashganda ham blok balandligi keskin o'zgarmaydi (avval
            spinner kichkina bo'lgani uchun sahifa "sakrardi"). */}
        <div className="flex flex-col flex-1 min-h-[28rem]">
        {studentTab === "grades" ? (
          <GradesTab
            groupId={id}
            students={students}
            canWrite={canWriteStudy && can("attendance:create") && group.status === "active"}
            canDeleteAny={canDeleteAnyStudy}
            userId={userId}
          />
        ) : studentTab === "plan" ? (
          <SyllabusTab
            groupId={id}
            canWrite={canWriteSyllabus && can("lesson:update")}
            canImport={canWriteSyllabus && can("lesson:create")}
          />
        ) : studentTab === "monthly" ? (
          <MonthlyAttendance
            groupId={id}
            students={students}
            canMark={can("attendance:create") && group.status === "active"}
            minDate={isTeacher ? yesterdayString() : ""}
          />
        ) : studentsLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loading />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-1 items-center justify-center w-full text-slate-400 text-sm">
            {t("student.empty")}
          </div>
        ) : (
          <div className="flex flex-col w-full overflow-hidden rounded-lg border border-slate-100">
            <div
              className={`hidden sm:grid gap-2 px-3 py-2 bg-slate-50 text-[11px] font-semibold uppercase text-slate-400 ${
                isTeacher
                  ? "grid-cols-[1fr_120px_44px]"
                  : "grid-cols-[1fr_190px_110px_120px_44px]"
              }`}
            >
              <span>{t("student.fullName")}</span>
              {!isTeacher && <span>{t("student.paymentFraction")}</span>}
              {!isTeacher && <span>{t("student.debtStatus")}</span>}
              <span>{t("group.attendanceColumn")}</span>
              <span />
            </div>

            {students.map((s) => {
              const entry = s.groups.find((g) => g.group === id);
              if (!entry) return null;
              const hasDebt =
                entry.groupStatus !== "pending" &&
                (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0) > 0;
              return (
                <div
                  key={s._id}
                  className={`relative grid grid-cols-1 items-center gap-2 px-3 py-2.5 border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                    isTeacher
                      ? "sm:grid-cols-[1fr_120px_44px]"
                      : "sm:grid-cols-[1fr_190px_110px_120px_44px]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-9 sm:pr-0">
                    <Avatar user={{ _id: s._id, name: s.fullName }} size={38} />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-800 truncate">{s.fullName}</span>
                      <span className="text-xs text-slate-400">{s.phone}</span>
                    </div>
                    {entry.status !== "active" && (
                      <Chip
                        className="ml-auto shrink-0"
                        value={t("student.statusLeft")}
                        color="slate"
                        variant="ghost"
                      />
                    )}
                  </div>

                  {/* Moliyaviy ustunlar — o'qituvchiga ko'rsatilmaydi */}
                  {!isTeacher && (
                    <div className="text-sm font-semibold text-slate-800">
                      {entry.groupStatus === "pending" ? (
                        <span className="text-slate-400">0 / 0 {t("student.somSuffix")}</span>
                      ) : (
                        <span>
                          {(entry.paidForCurrentCycle || 0).toLocaleString("uz-UZ")} /{" "}
                          {(entry.currentCyclePrice || 0).toLocaleString("uz-UZ")} {t("student.somSuffix")}
                        </span>
                      )}
                    </div>
                  )}

                  {!isTeacher && (
                    <div>
                      {hasDebt && <Chip value={t("student.debtChip")} color="red" variant="ghost" />}
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                    {!todayLesson ? (
                      <span className="text-xs text-slate-300">{t("group.attendanceNotToday")}</span>
                    ) : attendanceOpenId === s._id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={t("group.attendancePresent")}
                          onClick={() => markAttendance(s._id, "present")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 cursor-pointer transition-colors"
                        >
                          <HiPlus className="text-sm" />
                        </button>
                        <button
                          type="button"
                          title={t("group.attendanceAbsent")}
                          onClick={() => markAttendance(s._id, "absent")}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer transition-colors"
                        >
                          <HiMinus className="text-sm" />
                        </button>
                        <button
                          type="button"
                          title={t("group.attendanceExcused")}
                          onClick={() => openExcuse(s)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 cursor-pointer transition-colors"
                        >
                          <HiDocumentText className="text-sm" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAttendanceOpenId(s._id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                          attendanceMarks[s._id] === "present"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                            : attendanceMarks[s._id] === "absent"
                              ? "bg-red-50 border-red-200 text-red-600"
                              : attendanceMarks[s._id] === "excused"
                                ? "bg-amber-50 border-amber-200 text-amber-600"
                                : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                        }`}
                      >
                        {attendanceMarks[s._id] === "present"
                          ? t("group.attendancePresentShort")
                          : attendanceMarks[s._id] === "absent"
                            ? t("group.attendanceAbsentShort")
                            : attendanceMarks[s._id] === "excused"
                              ? t("group.attendanceExcusedShort")
                              : t("group.attendanceButton")}
                      </button>
                    )}
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 sm:static sm:flex sm:justify-end"
                  >
                    <DropMenu
                      items={[
                        ...(entry.status === "active" && !isTeacher
                          ? [
                              {
                                label: t("student.addPayment"),
                                icon: HiBanknotes,
                                iconClass: "bg-emerald-50 text-emerald-600",
                                onClick: () => setPayTarget({ student: s, entry }),
                              },
                            ]
                          : []),
                        {
                          label: t("student.callAction"),
                          icon: HiPhone,
                          iconClass: "bg-blue-50 text-blue-600",
                          onClick: () => {
                            window.location.href = `tel:${s.phone}`;
                          },
                        },
                        // O'quvchi kartochkasida to'lov tarixi va qarzdorlik
                        // bor — o'qituvchi/yordamchiga ochilmaydi (backendda
                        // ham 403, docs/teacher-scope-updates.md §3).
                        ...(!isTeacher
                          ? [
                              {
                                label: t("common.detail"),
                                icon: HiEye,
                                iconClass: "bg-slate-50 text-slate-600",
                                onClick: () => navigate(`/students/${s._id}`),
                              },
                            ]
                          : []),
                        // Boshqa guruhga o'tkazish va guruhdan chiqarish —
                        // Resepshin/Boshliq ishi (`student:update`).
                        // O'qituvchi/yordamchida bu ruxsat yo'q, backend ham
                        // rol darajasida rad etadi (blockTeachingRoles).
                        ...(entry.status === "active" && can("student:update")
                          ? [
                              {
                                label: t("student.transferAction"),
                                icon: HiArrowsRightLeft,
                                iconClass: "bg-violet-50 text-violet-600",
                                onClick: () => {
                                  setTransferTarget({ student: s, entry });
                                  setTransferKey((k) => k + 1);
                                },
                              },
                              {
                                label: t("student.leaveGroup"),
                                icon: HiUserMinus,
                                iconClass: "bg-red-50 text-red-600",
                                onClick: () => setLeaveTarget({ student: s, entry }),
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
        )}
        </div>
      </div>

      <StudentDialog
        key={`enroll-${enrollKey}`}
        open={enrollOpen}
        fixedGroup={group}
        subjects={subjects}
        onClose={() => setEnrollOpen(false)}
        onSaved={() => {
          fetchStudents();
          fetchGroup();
        }}
      />

      <GroupActivateDialog
        key={`activate-${activateKey}`}
        open={activateOpen}
        group={group}
        teachers={teachers}
        assistants={assistants}
        rooms={rooms}
        onClose={() => setActivateOpen(false)}
        onSaved={fetchGroup}
      />

      <GroupScheduleDialog
        key={`schedule-${scheduleKey}`}
        open={scheduleOpen}
        group={group}
        teachers={teachers}
        assistants={assistants}
        rooms={rooms}
        onClose={() => setScheduleOpen(false)}
        onSaved={fetchGroup}
      />

      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          studentId={payTarget.student._id}
          groupEntryId={payTarget.entry._id}
          debt={payTarget.entry.debt}
          currentCyclePrice={payTarget.entry.currentCyclePrice}
          paidForCurrentCycle={payTarget.entry.paidForCurrentCycle}
          currentCycleMonth={payTarget.entry.currentCycleMonth}
          courseStartMonth={payTarget.entry.courseStartMonth}
          onClose={() => setPayTarget(null)}
          onSaved={fetchStudents}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            setReceipt({
              centerName: centerMap[payTarget.entry.center],
              groupLabel,
              studentName: payTarget.student.fullName,
              phone: payTarget.student.phone,
              amount,
              forMonth,
              remainingDebt,
              debtBreakdown,
              paymentId,
            })
          }
        />
      )}

      <ReceiptPromptDialog open={!!receipt} receipt={receipt} onClose={() => setReceipt(null)} />

      {transferTarget && (
        <TransferStudentDialog
          key={`transfer-${transferKey}`}
          open={!!transferTarget}
          student={transferTarget.student}
          entry={transferTarget.entry}
          centers={centers}
          groups={allGroups}
          subjects={subjects}
          onClose={() => setTransferTarget(null)}
          onSaved={() => {
            fetchStudents();
            fetchGroup();
          }}
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

      <Dialog
        open={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        title={t("student.leaveGroup")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setLeaveTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={leaving} onClick={confirmLeave}>
              {t("student.leaveGroup")}
            </Button>
          </>
        }
      >
        <p>{t("student.leaveGroupConfirm", { name: leaveTarget?.student?.fullName })}</p>
      </Dialog>

      <Dialog
        open={!!finishTarget}
        onClose={() => setFinishTarget(false)}
        title={t("group.finishAction")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setFinishTarget(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="orange" loading={finishing} onClick={confirmFinish}>
              {t("group.finishAction")}
            </Button>
          </>
        }
      >
        <p>{t("group.finishConfirm")}</p>
      </Dialog>
    </div>
  );
}

export default GroupDetail;
