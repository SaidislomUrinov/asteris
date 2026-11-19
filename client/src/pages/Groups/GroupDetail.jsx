import NotFound from "../NotFound";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  HiAcademicCap,
  HiArchiveBox,
  HiArrowLeft,
  HiArrowUpTray,
  HiArrowUturnLeft,
  HiArrowsRightLeft,
  HiArrowsUpDown,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendar,
  HiChartBarSquare,
  HiCheckCircle,
  HiClock,
  HiDocumentText,
  HiEye,
  HiFlag,
  HiHome,
  HiInformationCircle,
  HiMinus,
  HiPencilSquare,
  HiPhone,
  HiPlus,
  HiQrCode,
  HiReceiptPercent,
  HiCurrencyDollar,
  HiUserGroup,
  HiUserMinus,
  HiUsers,
  HiTrophy,
  HiTableCells,
  HiStar,
  HiClipboardDocumentList,
  HiBookOpen,
  HiQuestionMarkCircle,
  HiMegaphone,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import IconButton from "../../ui/IconButton";
import useMediaQuery from "../../hooks/useMediaQuery";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import RowNumber from "../../ui/RowNumber";
import RankChip from "../../ui/RankChip";
import RankMedal from "../../ui/RankMedal";
import MonthNav from "../../ui/MonthNav";
import useQueryState from "../../hooks/useQueryState";
import Loading from "../../ui/Loading";
import ProgressBar from "../../ui/ProgressBar";
import { InfoMeta } from "../../ui/InfoCard";
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
import GradeCell from "./GradeCell";
import useTodayGrades from "./useTodayGrades";
import SyllabusTab from "./SyllabusTab";
import HomeworkTab from "./HomeworkTab";
import QuizTab from "./QuizTab";
import BroadcastDialog from "./BroadcastDialog";
import LatestHomeworkCard from "./LatestHomeworkCard";
import useLatestHomework from "./useLatestHomework";
import GroupSectionTabs from "./GroupSectionTabs";
import TodayLessonCard from "./TodayLessonCard";
import GroupHeader from "./GroupHeader";
import ShareChip from "../../ui/ShareChip";
import TeacherShareDialog from "./TeacherShareDialog";
import CoinsSwitchRow from "../Individual/CoinsSwitchRow";
import useCoinCenters from "../../hooks/useCoinCenters";
import HeaderCard from "./HeaderCard";
import AttendanceStatusCell, { DebtPill } from "./AttendanceStatusCell";
import { useLessonSchedule } from "./useLessonSchedule";
import {
  SORT_OPTIONS,
  computeRanks,
  isSortableTab,
  sortStudents,
  useSortKey,
  useStudentsSummary,
} from "./useStudentsSort";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import useSendQrCard from "../../hooks/useSendQrCard";
import StudentPhotoAvatar from "../../ui/StudentPhotoAvatar";
import CallChooserDialog from "./CallChooserDialog";
import { BADGE_FEATURE, currentMonthTashkent } from "../../utils/badges";
import { clampMonth, monthBilling } from "./monthBilling";
import useHideFinance from "../../hooks/useHideFinance";
import useClosingValue from "../../hooks/useClosingValue";
import TransferStudentDialog from "./TransferStudentDialog";
import IssueCertificateDialog from "../Certificates/IssueCertificateDialog";
import StudentDialog from "../Students/StudentDialog";
import ImportStudentsDialog from "./ImportStudentsDialog";
import StudentEditDialog from "../Students/StudentEditDialog";
import StudentContactDialog from "../Students/StudentContactDialog";
import AdjustCoinsDialog from "../Coins/AdjustCoinsDialog";
import TelegramStatusBadges from "../../ui/TelegramStatusBadges";
import PaymentDialog from "../Students/PaymentDialog";
import ReceiptPromptDialog from "../Students/ReceiptPromptDialog";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { isTodayLessonDay } from "../../utils/schedule";
import { maskMoney } from "../../utils/moneyFormat";
import { dateLocale } from "../../utils/locale";
import { downloadGroupQrCardsPdf } from "../Students/qrCard.util";

// Guruh holati — rang bilan ham farqlanadi (faqat matn emas).
const STATUS_CHIP_COLOR = { pending: "orange", active: "emerald", finished: "slate" };

// Mobil "xavfli amallar" menyusidagi ikonka foni — tugma rangiga mos.
const RISKY_ICON_CLASS = {
  orange: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  red: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
};

// Unix SONIYA → "YYYY-MM" (Asia/Tashkent) — oy filtri chegarasi uchun.
const tashkentMonthOf = (unixSeconds) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" })
    .format(new Date(unixSeconds * 1000))
    .slice(0, 7);

// Guruh detali butun guruhni bitta so'rovda oladi (server chegarasi 1000).
const GROUP_STUDENTS_LIMIT = 1000;

// O'qituvchi faqat bugun va kecha uchun davomat belgilay oladi (server ham
// shuni majburlaydi — attendance.service.js "teacherDateLimit").
const yesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Import eslatma qatoridagi vaqt: bugun bo'lsa faqat soat, aks holda sana+soat.
// Backend vaqtni UNIX SONIYAda yuboradi (`date.util.js#getNow`), shuning
// uchun `new Date()` ga berishdan oldin 1000 ga ko'paytiriladi — aks holda
// har qanday sana 1970-yilning yanvariga tushib qoladi.
//
// Locale — ilovada tanlangan til (utils/locale.js), brauzer tili emas.
// `hour12: false` majburiy — aks holda AM/PM chiqib, loyihaning qolgan
// qismidagi 24 soatlik formatga zid bo'ladi.
const formatBatchTime = (unixSeconds) => {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1000);
  const time = d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return time;
  return `${d.toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit" })} ${time}`;
};


// `groupId` — `/lesson` sahifasi joriy darsdagi guruhni shu prop bilan beradi
// (URL'dagi `:id` o'rniga). `live` — o'sha holat: statusda "Davom etmoqda",
// ortga tugmasi yo'q (docs/API_CONTRACT_lesson_merge.md).
function GroupDetail({ groupId, live = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const id = groupId || paramId;
  const can = useCan();
  // Telefon (< sm) — o'quvchilar ro'yxati kartalar ko'rinishida (avatar biroz kichik).
  const isPhone = useMediaQuery("(max-width: 639px)");
  const hasFeature = useFeature();
  const { menuItems: qrSendItems } = useSendQrCard();
  const [hideFinance] = useHideFinance();
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
  // Soddalashtirilgan ko'rinish (docs/API_CONTRACT_group_simple_view.md): tab
  // qatori yo'q — sahifa o'quvchilar ro'yxati, qolgan bo'limlar (davomat, baho,
  // vazifa, dastur, statistika) "⋮" menyudan ochiladi. Qaytarish — rolni
  // shu shartdan olib tashlash.
  const simpleView =
    authType === "owner" || (authType === "staff" && ["reception", "teacher", "assistant"].includes(role));
  // Qatordagi pul ustunlari (qarz + "To'lov") — faqat Owner/Reception.
  const ownerSimple = simpleView && !isTeacher;
  // O'qituvchi/Yordamchi qatorida bugungi baho (ko'rish va yozish shartlari kontrakt §2).
  const showGradeCol = simpleView && isTeacher && can("attendance:view") && hasFeature("student.rate");
  // Kalendarda sana→mavzu ko'rsatish va "Bugungi dars" kartochkasi —
  // ikkalasi ham bitta shartga bog'liq.
  const showPlans = isTeacher && can("lesson:view") && hasFeature("lesson.planning");
  // "Oxirgi vazifa" kartasi — guruh so'rovi bilan bir vaqtda yuklanadi.
  const canHomework = can("attendance:view") && hasFeature("homework.manage");
  // "Testlar" tabi — API_CONTRACT_quiz.md §"Tarif feature flag" (`quiz.manage` bitta flag yetarli).
  const canQuiz = can("attendance:view") && hasFeature("quiz.manage");
  const latestHomework = useLatestHomework(id, canHomework);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Boshqa filial/o'qituvchi guruhi — "topilmadi" emas, "ruxsat yo'q" ekrani.
  const [forbidden, setForbidden] = useState(false);
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
  // Individual guruh: o'qituvchi foizini tahrirlash oynasi (API_CONTRACT_individual_students.md §4).
  const [percentOpen, setPercentOpen] = useState(false);
  const [percentKey, setPercentKey] = useState(0);
  const [coinsSaving, setCoinsSaving] = useState(false);
  const coinCenters = useCoinCenters();
  const [activateKey, setActivateKey] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [finishTarget, setFinishTarget] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Arxivlash — API_CONTRACT_archive.md. Guruh HOLATIDAN qat'i nazar
  // (Yig'ilmoqda/Faol/Yakunlangan) arxivlanadi.
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveStudent, setArchiveStudent] = useState(null);
  const [archivingStudent, setArchivingStudent] = useState(false);

  const [students, setStudents] = useState([]);
  // O'quvchi rasmi — barcha rollar (o'qituvchi ham, faqat o'z guruhida;
  // cheklovni server qo'yadi). Javob darhol qatorga qo'llanadi.
  // Rasm almashtirish qator avatarining o'zida (StudentPhotoAvatar) —
  // javob darhol qatorga qo'llanadi.
  const applyStudentPhoto = (studentId, photo) =>
    setStudents((prev) => prev.map((st) => (st._id === studentId ? { ...st, photo } : st)));
  // "Kimga qo'ng'iroq qilamiz?" — ota-ona raqami bo'lsa (CallChooserDialog).
  const [callTarget, setCallTarget] = useState(null);
  const callTargetView = useClosingValue(callTarget);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollKey, setEnrollKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  // Oxirgi import batch — ingichka eslatma qatori uchun (API_CONTRACT_import_undo.md §1-band).
  const [importBatch, setImportBatch] = useState(null);
  const [undoBatchOpen, setUndoBatchOpen] = useState(false);
  const [undoingBatch, setUndoingBatch] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const payTargetView = useClosingValue(payTarget);
  const [receipt, setReceipt] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const transferTargetView = useClosingValue(transferTarget);
  // "O'qituvchi ulushi" dialogi (docs/API_CONTRACT_entry_teacher_percent.md §4).
  const [entryPercentTarget, setEntryPercentTarget] = useState(null);
  const entryPercentView = useClosingValue(entryPercentTarget);
  const [entryPercentKey, setEntryPercentKey] = useState(0);
  const [transferKey, setTransferKey] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const editTargetView = useClosingValue(editTarget);
  // O'qituvchi/yordamchi uchun faqat kontaktni tahrirlash (`student:contact`)
  // — docs/API_CONTRACT_student_contact_telegram.md §5.
  const [contactTarget, setContactTarget] = useState(null);
  // WECOIN qo'lda berish/ayirish (API_CONTRACT_coin_adjust.md).
  const [coinTarget, setCoinTarget] = useState(null);
  const coinTargetView = useClosingValue(coinTarget);
  const contactTargetView = useClosingValue(contactTarget);

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
  const [studentTab, setStudentTab] = useState(isTeacher && !simpleView ? "monthly" : "general");
  // "Umumiy" — o'quvchilar ro'yxati; ichidagi to'lov/o'tkazish/chiqarish
  // amallari hamon RESEPSHIN va BOSHLIQ ishi bo'lib qoladi (DropMenu ichida
  // `!isTeacher` bilan yopiq). Lekin O'qituvchi/Yordamchiga `student:create`
  // ruxsati berilgan bo'lsa, ular ham shu tab orqali o'quvchi qo'sha olishi
  // kerak. `student:contact` — ro'yxat kontaktni tahrirlash uchun ham ochiladi
  // (avval faqat /lesson'da edi, API_CONTRACT_student_contact_telegram.md §5).
  const hasGeneralTab = !isTeacher || can("student:create") || can("student:contact");
  const [excuseTarget, setExcuseTarget] = useState(null);
  // O'quvchilar ro'yxatini A-Z/Baholar/Davomat bo'yicha saralash —
  // docs/API_CONTRACT_group_students_sort.md. "Umumiy", "Davomat" va
  // "Baholar" tablarida bir xil tartib qo'llanadi.
  const [sortKey, setSortKey] = useSortKey();
  // "Umumiy" tabidagi oy filtri (API_CONTRACT_group_month_filter_and_start_date.md
  // §A.3): moliya ustunlari va reyting tanlangan oy bo'yicha. URL'da (`?month=`)
  // — sahifa yangilansa yo'qolmaydi. Oraliq: kurs boshlangan oy (yoki
  // o'quvchilardagi eng eski boshlang'ich qarz oyi) → joriy oy. Guruh
  // faollashmagan bo'lsa filtr yo'q — doim joriy oy.
  const currentMonth = currentMonthTashkent();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const [monthParam, setMonthParam] = useQueryState("month", currentMonth);
  // "Oylik davomat" tabidagi "Barchasi keldi" tugmasi matritsa ichidagi
  // state (selectedDate/bulkTargets/...) ga bog'liq, shuning uchun bu
  // state yuqoriga ko'tarilmaydi — o'rniga shared toolbar qatorida bo'sh
  // slot DOM node beriladi, `MonthlyAttendance` o'z tugmasini shu nodega
  // `createPortal` bilan chiqaradi.
  const [attendanceActionsSlot, setAttendanceActionsSlot] = useState(null);
  const monthFilterOn = !!group?.activatedAt;
  const monthMin = monthFilterOn
    ? students
        .flatMap((s) => s.groups.filter((g) => g.group === id && g.status === "active"))
        .map((g) => g.earliestPayableMonth)
        .filter(Boolean)
        .reduce((min, m) => (m < min ? m : min), tashkentMonthOf(group.activatedAt))
    : currentMonth;
  const selectedMonth = monthFilterOn ? clampMonth(monthParam, monthMin, currentMonth) : currentMonth;
  const isPastMonth = selectedMonth !== currentMonth;
  // "Oylik davomat" tabi endi SHU `selectedMonth`ni ishlatadi (oy filtri
  // global — qaysi tabda o'zgartirilsa, hammasiga tarqaladi). Baholar/Uyga
  // vazifa tablari hamon o'zgarmagan — ularda reyting doim joriy oy.
  const summaryMonth =
    hasGeneralTab && studentTab === "general" && selectedMonth !== currentMonth ? selectedMonth : undefined;
  const studentsSummary = useStudentsSummary(id, isSortableTab(studentTab), summaryMonth);
  // O'tgan oy nishonlari — ism yonidagi mini ikonkalar (API_CONTRACT_badges_monthly_rank.md §D.3).
  const todayGrades = useTodayGrades(id, showGradeCol);
  const [gradeOpenId, setGradeOpenId] = useState(null);
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
      // Butun guruh BIR so'rovda (API_CONTRACT_group_detail.md §1) — standart
      // 50 talik sahifa katta guruhni kesib qo'yardi.
      const res = await api.get("/students", {
        params: { page: 1, group: id, limit: GROUP_STUDENTS_LIMIT },
      });
      const { ok, data } = res.data;
      if (ok) setStudents(data || []);
    } catch {
      // jim o'tkazamiz — asosiy guruh ma'lumoti muhimroq
    } finally {
      setStudentsLoading(false);
    }
  }, [id]);

  // Shu guruh bo'yicha bekor qilinishi mumkin bo'lgan oxirgi import — ruxsat
  // bo'lmasa yoki topilmasa jim o'tkaziladi (asosiy guruh ma'lumoti muhimroq).
  const fetchImportBatch = useCallback(async () => {
    if (!can("student:create")) return;
    try {
      const res = await api.get("/students/import/batches/latest", { params: { groupId: id } });
      const { ok, data } = res.data;
      if (ok) setImportBatch(data || null);
    } catch {
      // jim o'tkazamiz
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      setForbidden(false);
      const res = await api.get(`/groups/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "auth.forbidden") {
          setForbidden(true);
          return;
        }
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
    // `allSettled` — har biri mustaqil. Avval `Promise.all` + bo'sh `catch`
    // edi: bitta so'rov xato bersa (masalan O'qituvchida `/rooms` 403)
    // markazlar, fanlar, o'qituvchilar — HAMMASI jimgina bo'sh qolardi.
    //
    // Xonalar `/rooms/lookup` dan olinadi (ruxsatsiz tanlov ro'yxati) —
    // `room:view` O'qituvchi/Yordamchiga hech qachon berilmaydi.
    const [centersRes, subjectsRes, staffRes, assistantRes, roomsRes, groupsRes] =
      await Promise.allSettled([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }),
        api.get("/staffs/lookup", { params: { role: "assistant" } }),
        api.get("/rooms/lookup"),
        api.get("/groups", { params: { page: 1 } }),
      ]);
    const take = (res, set) => {
      if (res.status === "fulfilled" && res.value.data.ok) set(res.value.data.data || []);
    };
    take(centersRes, setCenters);
    take(subjectsRes, setSubjects);
    take(staffRes, setTeachers);
    take(assistantRes, setAssistants);
    take(roomsRes, setRooms);
    take(groupsRes, setAllGroups);
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchGroup, 0);
    return () => clearTimeout(timer);
  }, [fetchGroup]);

  useEffect(() => {
    const timer = setTimeout(fetchLookups, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 0);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  useEffect(() => {
    const timer = setTimeout(fetchImportBatch, 0);
    return () => clearTimeout(timer);
  }, [fetchImportBatch]);

  useEffect(() => {
    const timer = setTimeout(fetchAttendance, 0);
    return () => clearTimeout(timer);
  }, [fetchAttendance]);

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

  const confirmArchive = async () => {
    try {
      setArchiving(true);
      const res = await api.delete(`/groups/${id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setArchiveOpen(false);
      // Guruh endi arxivda — bu sahifa uni ko'rsata olmaydi, ro'yxatga qaytamiz.
      navigate(group?.kind === "individual" ? "/individual" : "/groups");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setArchiving(false);
    }
  };

  // Bitta A'ZOLIKNI arxivlash: o'quvchi boshqa guruhlarida faol qolaveradi,
  // faqat shu guruhdagi yozuvi (va qarzdorligi) arxivga o'tadi.
  const confirmArchiveStudent = async () => {
    if (!archiveStudent) return;
    try {
      setArchivingStudent(true);
      const { student, entry } = archiveStudent;
      const res = await api.patch(`/students/${student._id}/groups/${entry._id}/archive`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setArchiveStudent(null);
      fetchStudents();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setArchivingStudent(false);
    }
  };

  // Importni bekor qilish — muvaffaqiyatli bo'lsa server "student:importUndone"
  // socket eventini yuboradi, lekin ro'yxatni shu yerda ham to'g'ridan-to'g'ri
  // refetch qilamiz (boshqa tab/foydalanuvchi kutmasin).
  const confirmUndoBatch = async () => {
    if (!importBatch?._id) return;
    try {
      setUndoingBatch(true);
      const res = await api.post(`/students/import/batches/${importBatch._id}/undo`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setUndoBatchOpen(false);
      setImportBatch(null);
      fetchStudents();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setUndoingBatch(false);
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

  // O'quvchi (yangi yoki mavjud) shu guruhga yozilganda — HTTP refetchsiz,
  // to'g'ridan-to'g'ri ro'yxatga qo'shiladi (API_CONTRACT.md §3).
  useSocketEvent(
    "student:enrolled",
    (payload) => {
      if (payload?.groupId !== id || !payload?.student || !payload?.entry) return;
      setStudents((prev) => {
        const existing = prev.find((s) => s._id === payload.student._id);
        // Avval shu guruhdan chiqarilgan o'quvchi qayta yozilsa — hujjat
        // ro'yxatda bor (eski "left" a'zolik bilan), yangi a'zolik qo'shiladi.
        if (existing) {
          if (existing.groups.some((g) => g._id === payload.entry._id)) return prev;
          return prev.map((s) =>
            s._id === existing._id ? { ...s, groups: [...s.groups, payload.entry] } : s,
          );
        }
        return [...prev, { ...payload.student, groups: [payload.entry] }];
      });
      // Sanoq ro'yxatdan hisoblanadi (`studentsCount`), limit esa `group`
      // state'idan — shuning uchun faqat limit shu yerda yangilanadi. Limit
      // backendda avtomatik ko'tarilgan bo'lishi mumkin (11-o'quvchi
      // qo'shilsa max 11 bo'ladi) — "11/10" ko'rinmasligi uchun.
      setGroup((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (payload.maxStudents !== undefined) next.maxStudents = payload.maxStudents;
        return next;
      });
    },
    !!id,
  );

  // O'quvchi boshqa joydan (masalan Students ro'yxati) tahrirlansa ham —
  // HTTP refetchsiz, to'g'ridan-to'g'ri local state'ga qo'llanadi
  // (StudentDetail.jsx bilan bir xil pattern).
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
    !!id,
  );

  // Ota-ona botga ulandi/uzildi/bloklandi — mos o'quvchilarning Telegram
  // holati joyida yangilanadi, refetchsiz
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
    !!id,
  );

  // O'quvchi summasi (StudentEditDialog orqali) o'zgarganda — attendance:marked
  // bilan bir xil applyEntryUpdate mexanizmi orqali refetchsiz yangilanadi
  // (docs/API_CONTRACT_student_edit_price.md).
  // "O'qituvchi ulushi" o'zgardi (shu yoki boshqa tab/xodim) — a'zolik joyida yangilanadi.
  const applyEntryPercent = useCallback((studentId, groupEntryId, teacherPercent) => {
    setStudents((prev) =>
      prev.map((s) =>
        s._id !== studentId
          ? s
          : {
              ...s,
              groups: s.groups.map((g) =>
                g._id === groupEntryId ? { ...g, teacherPercent: teacherPercent ?? null } : g,
              ),
            },
      ),
    );
  }, []);

  useSocketEvent(
    "student:teacherPercent",
    (payload) => {
      if (!payload?.studentId || !payload?.groupEntryId) return;
      if (payload.groupId && payload.groupId !== id) return;
      applyEntryPercent(payload.studentId, payload.groupEntryId, payload.teacherPercent);
    },
    !!id,
  );

  useSocketEvent(
    "student:priceUpdated",
    (payload) => {
      if (payload?.groupId !== id) return;
      applyEntryUpdate(payload.studentId, payload.entry);
    },
    !!id,
  );

  // O'quvchi shu guruhdan chiqarildi / arxivlandi / boshqa guruhga o'tkazildi
  // (shu yoki boshqa tab/xodimdan) — ro'yxatdan darhol yo'qoladi va
  // "soni / limit" katakchasi kamayadi. Payload'da guruh id yo'q, shuning
  // uchun a'zolik id'si local ro'yxatdagi FAOL a'zolik bilan solishtiriladi.
  useSocketEvent(
    "student:leftGroup",
    (payload) => {
      if (!payload?.groupEntryId) return;
      const wasActive = students.some((s) =>
        s.groups.some(
          (g) => g._id === payload.groupEntryId && g.group === id && g.status === "active",
        ),
      );
      if (!wasActive) return;
      setStudents((prev) =>
        prev.map((s) =>
          s._id !== payload.studentId
            ? s
            : {
                ...s,
                groups: s.groups.map((g) =>
                  g._id === payload.groupEntryId ? { ...g, status: "left" } : g,
                ),
              },
        ),
      );
    },
    !!id,
  );

  // Jadval (/schedule sahifasi yoki xona detali) yoki boshqa tab'dan shu
  // guruhning kun/vaqt/xonasi o'zgartirilsa — payload'da schedule maydonlari
  // yo'q (faqat invalidatsiya signali), shuning uchun to'liq refetch qilinadi.
  useSocketEvent(
    "group:changed",
    (payload) => {
      if (payload?.groupId !== id) return;
      // Telegram havolasi payload'da keladi — refetch'siz joyida yangilanadi.
      if (payload.action === "telegram") {
        setGroup((prev) => (prev ? { ...prev, telegramLink: payload.telegramLink ?? null } : prev));
        return;
      }
      fetchGroup();
    },
    !!id,
  );

  // Import bekor qilindi (shu tabdan yoki boshqa tab/foydalanuvchidan) —
  // o'quvchilar ommaviy olib tashlangani uchun payload bilan yamash o'rniga
  // to'liq refetch qilinadi (API_CONTRACT_import_undo.md §1-band).
  useSocketEvent(
    "student:importUndone",
    (payload) => {
      if (payload?.groupId !== id) return;
      setImportBatch((prev) => (prev && prev._id === payload.batchId ? null : prev));
      fetchStudents();
    },
    !!id,
  );

  if (loading) return <Loading height="40vh" />;

  if (forbidden) return <NotFound />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
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

  // Individual guruh — bitta o'quvchi; sarlavha o'quvchi ismi, guruh
  // yig'ish amallari (qo'shish/import/faollashtirish/limit) yashiriladi.
  const isIndividual = group.kind === "individual";
  // Foiz — moliyaviy: faqat Boshliq/Resepshin (o'qituvchiga `null` keladi).
  const canEditPercent = isIndividual && !isTeacher && (authType === "owner" || can("group:update"));
  // WECOIN switch — faqat filialda WECOIN ishlasa (tarif + sozlama).
  const showCoinsSwitch = canEditPercent && coinCenters.has(group?.center);
  // Individual guruhda faqat WECOIN yoqilgan bo'lsa (aks holda o'quvchiga filial hamyoni ko'rsatilmaydi).
  const canAdjustCoins = can("coin:manage") && coinCenters.has(group?.center) && (!isIndividual || !!group?.coinsEnabled);
  const toggleCoins = async (coinsEnabled) => {
    try {
      setCoinsSaving(true);
      const res = await api.patch(`/groups/${group._id}/individual`, { coinsEnabled });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setGroup((prev) => (prev ? { ...prev, coinsEnabled: !!data?.coinsEnabled } : prev));
      successMsg("individual.coinsSaved");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setCoinsSaving(false);
    }
  };
  // O'quvchi a'zoligiga "O'qituvchi ulushi" — oddiy guruhda, Boshliq/Resepshin
  // (`group:update`), o'qituvchi/yordamchiga yo'q (moliyaviy).
  const canEditEntryPercent = !isIndividual && !isTeacher && (authType === "owner" || can("group:update"));
  const groupLabel =
    (isIndividual && group.individualStudent?.fullName) ||
    group.name ||
    `${group.subjectName || subjectMap[group.subject] || "?"} - ${
      group.status === "pending" ? group.pendingId : group.activeId
    }${group.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""}`;

  // Guruh nomini tahrirlash — Yordamchi o'qituvchidan boshqa hamma
  // (Boshliq, Menejer, Resepshin, O'qituvchi) tahrirlay oladi (backend
  // "requireGroupRenameAccess" bilan bir xil qoida).
  const canRenameGroup = !isIndividual && (authType === "owner" || role !== "assistant");
  // Telegram guruh manzili — `PATCH /groups/:id/telegram` doirasi (/groups
  // ro'yxatidagi belgi bilan bir xil): Boshliq, O'qituvchi, `group:update`li hodim.
  const canEditTelegram =
    authType === "owner" || role === "teacher" || (role !== "assistant" && can("group:update"));


  // Guruhdan chiqarilgan ("left") a'zolik bu sahifada UMUMAN ko'rinmaydi —
  // ro'yxat, davomat va baho matritsalari faqat FAOL a'zolarni oladi. Bitta
  // o'quvchida shu guruh bo'yicha bir nechta a'zolik bo'lishi mumkin (chiqib,
  // qayta yozilgan), shuning uchun `entryOf` faol a'zolikni tanlaydi.
  const entryOf = (s) => s.groups.find((g) => g.group === id && g.status === "active");
  const activeStudents = students.filter((s) => entryOf(s));
  // Individual guruhda oylik to'lov — o'quvchining kelishilgan narxi (fan narxi emas).
  const monthlyFee =
    (isIndividual && activeStudents.length ? entryOf(activeStudents[0]).price : null) ??
    (subjectPriceMap[group.subject] || 0);
  // Faqat "Umumiy" ro'yxatning tartibi o'zgaradi — Baholar/Oylik davomat
  // tablari o'z ichki tartibida qoladi.
  const sortedStudents = sortStudents(activeStudents, sortKey, studentsSummary);
  // Top-3 medal — joriy saralashdan mustaqil, haqiqiy baho reytingi.
  const ranks = computeRanks(studentsSummary);
  // "Soni / limit" katakchasi ro'yxat bilan BITTA manbadan — ro'yxat hali
  // yuklanmagan birinchi lahzada serverdagi sanoq ko'rsatiladi.
  const studentsCount =
    studentsLoading && students.length === 0 ? group.studentsCount || 0 : activeStudents.length;
  // Joriy sikl (filial sozlamasiga qarab — sanadan-sanaga YOKI oy boshidan
  // oy boshiga) uchun to'langan/to'lanishi kerak summalar — ikkalasi ham
  // computeBilling'dan (server) to'g'ridan-to'g'ri keladi
  // (`currentCyclePrice`/`paidForCurrentCycle`), shu sikl chegaralariga mos
  // bo'lgani uchun. Eslatma: avval bu yerda `currentMonthDue` (faqat
  // O'TGAN kunlar uchun hisoblangan, hali TO'LIQ sikl summasi emas)
  // ishlatilgan edi — shu sabab donut noto'g'ri, kichikroq raqam ko'rsatib
  // turgan edi.
  const monthlyRevenue = activeStudents.reduce((sum, s) => {
    const entry = entryOf(s);
    return sum + (entry.paidForCurrentCycle || 0);
  }, 0);

  // Joriy sikl uchun qarzdorlik — donut chartda "qarzdorlar" segmenti.
  const monthlyDebt = activeStudents.reduce((sum, s) => {
    const entry = entryOf(s);
    return sum + Math.max(0, (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0));
  }, 0);

  // Tushum grafigi TARIXIY — chiqib ketgan o'quvchining shu guruhga qilgan
  // to'lovlari ham haqiqiy tushum, shuning uchun bu yerda barcha a'zoliklar.
  const allPayments = students.flatMap((s) =>
    s.groups.filter((g) => g.group === id).flatMap((g) => g.payments || []),
  );

  // Sarlavha qatoridagi amallar — guruh statusiga bog'liq. Mobil (ikonka)
  // va desktop (matnli) variantlar AYNAN shu ro'yxatdan chiziladi, shunda
  // biriga qo'shilgan amal ikkinchisida tushib qolmaydi.
  // Guruhni faollashtirish / yakunlash — bular `group:update` amali, va
  // o'qituvchiga (Owner tarif doirasida) berilishi mumkin (staffPermission.util.js)
  // — shu ikki tugma o'qituvchida ham ishlashi kerak, shuning uchun bu yerda
  // rol bo'yicha CHEKLANMAYDI.
  const canManageGroup = can("group:update");
  // Lekin xuddi shu `group:update` permission JADVAL-tahrirlash formasini
  // (GroupScheduleDialog'dagi kun/xona/o'qituvchi/vaqt) ochib yubormasligi
  // kerak — o'qituvchi/yordamchi "Tahrirlash" oynasida HAR DOIM faqat nom
  // ko'radi, permissiondan qat'i nazar (pastda `canEditSchedule` shu bilan
  // qo'shimcha cheklanadi).
  const canEditAssistantOnly = authType === "staff" && role === "teacher";
  const canOpenSchedule = canManageGroup || canEditAssistantOnly;
  const canIssueCertificates =
    can("certificate:create") && hasFeature("certificate.manage") && !isTeacher;
  const topActions = [
    ...(canRenameGroup || (canOpenSchedule && group.status === "active")
      ? [
          {
            key: "edit",
            icon: HiPencilSquare,
            label: t("group.editAction"),
            color: "blue",
            variant: "outlined",
            onClick: () => {
              setScheduleKey((k) => k + 1);
              setScheduleOpen(true);
            },
          },
        ]
      : []),
    ...(canManageGroup && group.status === "pending" && !isIndividual
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
            key: "finish",
            icon: HiFlag,
            label: t("group.finishAction"),
            color: "orange",
            variant: "filled",
            risky: true,
            onClick: () => setFinishTarget(true),
          },
        ]
      : []),
    // Arxivlash — har qanday holatdagi guruh uchun (`group:delete`).
    ...(can("group:delete") && !isTeacher
      ? [
          {
            key: "archive",
            icon: HiArchiveBox,
            label: t("archive.archive"),
            color: "red",
            variant: "outlined",
            risky: true,
            onClick: () => setArchiveOpen(true),
          },
        ]
      : []),
  ];
  // Asosiy amallar ekranda, qolganlari "⋮" menyuda (xavfli amallar oxirida).
  const primaryActions = topActions.filter((a) => a.key === "edit" || a.key === "activate");
  const menuActions = [
    ...topActions.filter((a) => !primaryActions.includes(a) && !a.risky),
    ...topActions.filter((a) => a.risky),
  ];

  // Tab ro'yxati ruxsat/tarifga bog'liq va socket orqali o'zgarishi mumkin
  // (masalan tarif tugab `lesson.planning` o'chsa). Tanlangan tab ro'yxatdan
  // yo'qolsa, uning kontenti "yetim" bo'lib qolmasligi uchun birinchi mavjud
  // tabga qaytiladi.
  const canAddStudents = group.status !== "finished" && can("student:create") && !isIndividual;
  const canGradeToday = canWriteStudy && can("attendance:create") && group.status === "active" && !!todayLesson;
  const studentTabs = [
    ...(hasGeneralTab || simpleView
      ? [{ key: "general", label: t("group.tabStudentsSection") }]
      : []),
    { key: "monthly", label: t("group.tabMonthly") },
    ...(can("attendance:view") && hasFeature("student.rate")
      ? [{ key: "grades", label: t("grade.tab") }]
      : []),
    ...(canHomework
      ? [{ key: "homework", label: t("homework.tab") }]
      : []),
    ...(can("lesson:view") && hasFeature("lesson.planning")
      ? [{ key: "plan", label: t("syllabus.tab") }]
      : []),
    ...(canQuiz ? [{ key: "quiz", label: t("quiz.tab") }] : []),
    // Exceldan import va Sertifikat berish — avval alohida tugma/menyu bandi
    // edi, endi tab qatorida (bosilganda mos dialog ochiladi, activeTab
    // o'zgarmaydi — pastdagi `handleTabChange` shu ikkisini ushlab qoladi).
    ...(canAddStudents ? [{ key: "import", label: t("import.buttonLabel") }] : []),
    ...(canIssueCertificates ? [{ key: "certificate", label: t("certificate.issueToGroup") }] : []),
    // Statistika (grafiklar/kalendar) — avval alohida yuqori bo'lim edi,
    // endi shu yagona tab qatorining oxirgisi.
    { key: "stats", label: t("group.tabStatistics") },
  ];
  const activeTab = studentTabs.some((tab) => tab.key === studentTab)
    ? studentTab
    : studentTabs[0]?.key;
  // "import" va "certificate" — haqiqiy kontent emas, bosilganda dialog
  // ochiladi; joriy ko'rinish (activeTab) o'zgarmay qoladi.
  const handleTabChange = (key) => {
    if (key === "import") {
      setImportOpen(true);
      return;
    }
    if (key === "certificate") {
      setCertificateOpen(true);
      return;
    }
    setStudentTab(key);
  };

  const VIEW_ICONS = {
    general: HiUsers,
    monthly: HiTableCells,
    grades: HiStar,
    homework: HiClipboardDocumentList,
    plan: HiBookOpen,
    quiz: HiQuestionMarkCircle,
    import: HiArrowUpTray,
    certificate: HiAcademicCap,
    stats: HiChartBarSquare,
  };
  // simpleView: ekranda faqat "Faollashtirish" + "O'quvchi qo'shish";
  // "Tahrirlash" — "⋮" ichida, xavfli amallar oxirida. Davomat/Baholar/
  // Vazifa/Reja/Statistika/Import/Sertifikat — sarlavha ostidagi tab qatorida.
  const hasHomeworkTab = studentTabs.some((tab) => tab.key === "homework");
  const sectionTabs = studentTabs.map((tab) => ({ ...tab, icon: VIEW_ICONS[tab.key] }));
  const shownPrimary = simpleView
    ? [
        ...primaryActions.filter((a) => a.key === "activate"),
        ...(canAddStudents
          ? [
              {
                key: "enroll",
                icon: HiPlus,
                label: t("student.create"),
                color: "blue",
                variant: "filled",
                onClick: () => {
                  setEnrollKey((k) => k + 1);
                  setEnrollOpen(true);
                },
              },
              {
                key: "broadcast",
                icon: HiMegaphone,
                label: t("group.broadcast.button"),
                color: "blue",
                variant: "outlined",
                onClick: () => setBroadcastOpen(true),
              },
            ]
          : []),
      ]
    : primaryActions;
  const shownMenu = simpleView
    ? [
        ...topActions.filter((a) => a.key === "edit"),
        ...topActions.filter((a) => !["edit", "activate"].includes(a.key) && !a.risky),
        ...topActions.filter((a) => a.risky),
      ]
    : menuActions;

  // QR kartalar va Excelga export — avval sarlavha qatorida alohida ikonka
  // tugma edi, endi "⋮" menyusi ichida (statistika/import/sertifikat kabi
  // tab bo'lmaydi — ikkisi ham to'g'ridan-to'g'ri yuklab olish amali).
  const canDownloadQrCards = hasFeature("attendance.qr") && can("attendance:view");
  const canDownloadExcel = !isTeacher;
  const downloadQrCards = async () => {
    try {
      const res = await api.get(`/attendance/qr/group/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (!data.students.length) throw new Error("attendance.qrGroupEmpty");
      const cards = data.students.map((s) => ({
        fullName: s.fullName,
        qrToken: s.qrToken,
        centerName: data.center.name,
        centerLogo: data.center.logo,
        groups: [data.group.name],
      }));
      await downloadGroupQrCardsPdf(cards, data.group.name, t);
      successMsg("attendance.qrGroupDownloaded");
    } catch (error) {
      errorMsg(error.message);
    }
  };
  const downloadExcelExport = async () => {
    try {
      const res = await api.get(`/groups/${id}/export`, { responseType: "blob" });
      const isJsonError = res.data?.type === "application/json";
      if (isJsonError) {
        const text = await res.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.msg || "common.exportError");
      }
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : "export.xlsx";
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      successMsg("common.exportSuccess");
    } catch (error) {
      errorMsg(error.message || "common.exportError");
    }
  };
  const downloadMenuItems = [
    ...(canDownloadQrCards
      ? [
          {
            key: "qrCards",
            icon: HiQrCode,
            label: t("attendance.qrGroupCards"),
            onClick: downloadQrCards,
          },
        ]
      : []),
    ...(canDownloadExcel
      ? [
          {
            key: "exportExcel",
            icon: HiTableCells,
            label: t("common.exportExcel"),
            onClick: downloadExcelExport,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        {live ? (
          <span />
        ) : (
          <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
            <HiArrowLeft />
          </IconButton>
        )}

        {/* Ekranda faqat asosiy amal (Tahrirlash / Faollashtirish + O'quvchi
            qo'shish); qolgan hammasi (Sertifikat/Import/Statistika — tab
            qatorida; QR kartalar/Excelga export/Yakunlash/Arxivlash) bitta
            "⋮" menyuda, xavfli amallar eng pastda. Ko'rsatish/yashirish
            KONTEYNER div'da — Button/IconButton ning `inline-flex` bazasi
            `hidden` ni bosib ketadi. */}
        <div className="flex items-center gap-2">
          {shownPrimary.map((action) => (
            <div key={action.key} className="contents">
              <div className="sm:hidden">
                <IconButton
                  color={action.color}
                  variant={action.variant}
                  title={action.label}
                  onClick={action.onClick}
                >
                  <action.icon />
                </IconButton>
              </div>
              <div className="hidden sm:block">
                <Button
                  color={action.color}
                  variant={action.variant}
                  className="gap-1.5"
                  onClick={action.onClick}
                >
                  <action.icon className="text-base" />
                  {action.label}
                </Button>
              </div>
            </div>
          ))}
          {(shownMenu.length > 0 || downloadMenuItems.length > 0) && (
            <DropMenu
              items={[
                ...downloadMenuItems.map((action) => ({
                  label: action.label,
                  icon: action.icon,
                  iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                  onClick: action.onClick,
                })),
                ...shownMenu.map((action, index) => ({
                  label: action.label,
                  icon: action.icon,
                  iconClass: action.risky
                    ? RISKY_ICON_CLASS[action.color]
                    : "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
                  onClick: action.onClick,
                  divider: index === 0 && downloadMenuItems.length > 0,
                })),
              ]}
            />
          )}
        </div>
      </div>

      <GroupHeader
        group={group}
        label={groupLabel}
        titleBadge={isIndividual ? <ShareChip individual /> : null}
        studentsCard={
          canEditPercent ? (
            <HeaderCard
              icon={<HiReceiptPercent />}
              title={t("teacherShare.title")}
              value={group.teacherPercent != null ? `${group.teacherPercent}%` : "—"}
              accent="violet"
            >
              {/* Tor katak — tugma sarlavha yonida uni kesib qo'yardi, shuning
                  uchun qiymat ostida matnli havola. */}
              <button
                type="button"
                className="self-start inline-flex items-center gap-1 h-6 px-2 rounded-md bg-violet-50 dark:bg-violet-500/15 ring-1 ring-inset ring-violet-200 dark:ring-violet-400/30 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25 cursor-pointer whitespace-nowrap transition-colors"
                onClick={() => {
                  setPercentKey((k) => k + 1);
                  setPercentOpen(true);
                }}
              >
                <HiPencilSquare className="text-sm" />
                {t("individual.editShort")}
              </button>
              {showCoinsSwitch && (
                <div className="mt-1 pt-2 border-t border-slate-100 dark:border-night-700">
                  <CoinsSwitchRow compact checked={!!group.coinsEnabled} disabled={coinsSaving} onChange={toggleCoins} />
                </div>
              )}
            </HeaderCard>
          ) : null
        }
        status={
          live ? (
            <Chip value={t("dashboard.lessonStatus.ongoing")} color="blue" variant="filled" />
          ) : (
            <Chip
              value={t(`group.status${group.status[0].toUpperCase()}${group.status.slice(1)}`)}
              color={STATUS_CHIP_COLOR[group.status] || "blue"}
              variant="filled"
            />
          )
        }
        details={
          <>
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
          </>
        }
        studentsCount={studentsCount}
        studentsFooter={
          group.status === "pending" && group.maxStudents && !isIndividual ? (
            <ProgressBar value={studentsCount} max={group.maxStudents} color="orange" />
          ) : null
        }
        /* Uchinchi katak rolga qarab: Boshliq/resepshin oylik to'lovni
           ko'radi (moliyaviy ma'lumot o'qituvchiga yubormaymiz), o'qituvchi
           esa o'sha joyda "Bugungi dars"ni ko'radi. */
        extra={
          !isTeacher ? (
            <HeaderCard
              icon={<HiBanknotes />}
              title={t("group.monthlyFee")}
              value={maskMoney(monthlyFee, hideFinance)}
              suffix={hideFinance ? "" : t("student.somSuffix")}
              accent="emerald"
            />
          ) : showPlans ? (
            <TodayLessonCard todayLesson={schedule.todayLesson} nextLesson={schedule.nextLesson} group={group} />
          ) : null
        }
        homework={
          hasHomeworkTab ? (
            <LatestHomeworkCard
              item={latestHomework.item}
              loaded={latestHomework.loaded}
              studentsCount={studentsCount} onOpen={() => setStudentTab("homework")} />
          ) : null
        }
        canEditTelegram={canEditTelegram}
        onTelegramSaved={(data) =>
          setGroup((prev) => (prev ? { ...prev, telegramLink: data?.telegramLink ?? null } : prev))
        }
      />

      {/* Yagona tab qatori: o'quvchilar ro'yxati, davomat, baholar, vazifa,
          dastur va statistika (avval ikki qavat edi: O'quvchilar|Statistika
          + ichki tablar). */}

      <GroupSectionTabs tabs={sectionTabs} active={activeTab} onChange={handleTabChange} />

      {activeTab === "stats" && (
        <>
      {/* Moliya bitta qatorda (tushum grafigi + joriy sikl donuti), o'qish
          esa keyingisida (kalendar + davomat) — ma'no bo'yicha guruhlangan.
          O'qituvchiga moliya ko'rsatilmaydi, "ko'z" yopiq bo'lsa Owner/
          Resepshinga ham (Dashboard bilan bir xil qoida). */}
      {!isTeacher &&
        (hideFinance ? (
          <HiddenFinancePanel />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
            <div className="lg:col-span-2 min-w-0">
              <RevenueChart payments={allPayments} month={selectedMonth} />
            </div>
            <PaymentDonut paid={monthlyRevenue} debt={monthlyDebt} />
          </div>
        ))}

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

        </>
      )}

      {activeTab !== "stats" && (
      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        {isSortableTab(activeTab) && (
        <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-night-700">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {((activeTab === "general" && !isTeacher) || activeTab === "monthly") && monthFilterOn && (
                <>
                  <MonthNav
                    month={selectedMonth}
                    label={`${monthNames[Number(selectedMonth.slice(5, 7)) - 1] || ""} ${selectedMonth.slice(0, 4)}`}
                    onChange={setMonthParam}
                    min={monthMin}
                    max={currentMonth}
                    className={`w-full justify-between sm:w-auto sm:justify-start ${
                      isPastMonth ? "ring-1 ring-blue-200 dark:ring-blue-500/40 bg-blue-50/60 dark:bg-blue-500/10" : ""
                    }`}
                  />
                  {isPastMonth && (
                    <button
                      type="button"
                      onClick={() => setMonthParam(currentMonth)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors"
                    >
                      <HiArrowUturnLeft className="shrink-0" />
                      {t("group.backToCurrentMonth")}
                    </button>
                  )}
                </>
              )}
              <Select
                variant="slate"
                icon={<HiArrowsUpDown className="text-base" />}
                value={sortKey}
                onChange={setSortKey}
                className="w-full sm:w-auto sm:min-w-[220px]"
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              />
            </div>
            {/* "Barchasi keldi" tugmasi shu yerga `createPortal` orqali
                chiqadi (pastdagi `<MonthlyAttendance actionsSlot=…>`).
                Faqat md+ (desktop matritsa ko'rinishi) — mobilda
                `MonthlyAttendance` o'zining alohida tezkor tugmasini
                ko'rsatadi, shuning uchun bu yerda `hidden` qoldiriladi
                (aks holda ikkita bir xil tugma chiqib qolardi). */}
            {activeTab === "monthly" && (
              <div ref={setAttendanceActionsSlot} className="hidden md:flex md:ml-auto" />
            )}
            {activeTab === "general" && group.status !== "finished" && can("student:create") && !isIndividual && !simpleView && (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto">
                <div className="max-sm:flex-1 max-sm:min-w-[140px]">
                  {/* 390px da ikki tugma yonma-yon ~158px dan oladi, tarkib
                      (px-5 + ikonka + matn) esa ~167px — `whitespace-nowrap`
                      matn qisqarmaydi, shuning uchun flex SVG ikonkani 0 gacha
                      siqib yuborardi (320px da tugmalar alohida qatorga
                      tushib, joy yetgani uchun ko'rinardi). Ikonka `shrink-0`,
                      telefonda ichki chekinish kichikroq. */}
                  <Button
                    variant="outlined"
                    color="slate"
                    className="gap-1.5 w-full sm:w-auto max-sm:px-3"
                    onClick={() => setImportOpen(true)}
                  >
                    <HiArrowUpTray className="text-base shrink-0" />
                    {t("import.buttonLabel")}
                  </Button>
                </div>
                <div className="max-sm:flex-1 max-sm:min-w-[140px]">
                  <Button
                    variant="outlined"
                    className="gap-1.5 w-full sm:w-auto max-sm:px-3"
                    onClick={() => {
                      setEnrollKey((k) => k + 1);
                      setEnrollOpen(true);
                    }}
                  >
                    <HiPlus className="text-base shrink-0" />
                    {t("student.create")}
                  </Button>
                </div>
                <div className="max-sm:flex-1 max-sm:min-w-[140px]">
                  <Button
                    variant="outlined"
                    className="gap-1.5 w-full sm:w-auto max-sm:px-3"
                    onClick={() => setBroadcastOpen(true)}
                  >
                    <HiMegaphone className="text-base shrink-0" />
                    {t("group.broadcast.button")}
                  </Button>
                </div>
              </div>
            )}
        </div>
        )}

        {/* Oxirgi import haqida ingichka eslatma — API_CONTRACT_import_undo.md
            §1-band. `canUndo:false` bo'lsa tugma o'rniga sabab ko'rsatiladi. */}
        {activeTab === "general" && importBatch && (
          <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
            <HiInformationCircle className="shrink-0 text-amber-500" />
            <span className="flex-1">
              {t("import.lastImportHint", {
                time: formatBatchTime(importBatch.createdAt),
                count: (importBatch.counts?.created ?? 0) + (importBatch.counts?.enrolled ?? 0),
              })}
            </span>
            {importBatch.canUndo ? (
              <button
                type="button"
                onClick={() => setUndoBatchOpen(true)}
                className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-400 cursor-pointer shrink-0"
              >
                <HiArrowUturnLeft className="shrink-0" />
                {t("import.undoButton")}
              </button>
            ) : (
              <span className="shrink-0 text-amber-500">
                {t(importBatch.undoBlockedReason, { defaultValue: importBatch.undoBlockedReason })}
              </span>
            )}
          </div>
        )}

        {/* Tab kontenti uchun barqaror maydon: yuklanish paytida ham,
            almashganda ham blok balandligi keskin o'zgarmaydi (avval
            spinner kichkina bo'lgani uchun sahifa "sakrardi"). */}
        <div className="flex flex-col flex-1 min-h-[28rem]">
        {activeTab === "grades" ? (
          <GradesTab
            groupId={id}
            students={sortedStudents}
            ranks={ranks}
            canWrite={canWriteStudy && can("attendance:create") && group.status === "active"}
            canDeleteAny={canDeleteAnyStudy}
            userId={userId}
          />
        ) : activeTab === "homework" ? (
          <HomeworkTab
            groupId={id}
            canWrite={can("attendance:create") && group.status === "active"}
            canImport={can("lesson:view") && hasFeature("lesson.planning")}
            lessonByDate={schedule.lessonByDate}
            extendTo={schedule.extendTo}
            students={sortedStudents}
            ranks={ranks}
            onPhotoUpdated={(studentId, photo) =>
              setStudents((prev) => prev.map((st) => (st._id === studentId ? { ...st, photo } : st)))
            }
          />
        ) : activeTab === "plan" ? (
          <SyllabusTab
            groupId={id}
            canWrite={canWriteSyllabus && can("lesson:update")}
            canImport={canWriteSyllabus && can("lesson:create")}
          />
        ) : activeTab === "quiz" ? (
          <QuizTab
            groupId={id}
            subjectId={group.subject}
            canWrite={can("attendance:create") && group.status === "active"}
          />
        ) : activeTab === "monthly" ? (
          <MonthlyAttendance
            groupId={id}
            students={sortedStudents}
            ranks={ranks}
            month={selectedMonth}
            actionsSlot={attendanceActionsSlot}
            canMark={can("attendance:create") && group.status === "active"}
            minDate={isTeacher ? yesterdayString() : ""}
            onOpenStudent={isTeacher && hasFeature(BADGE_FEATURE) ? (s) => navigate(`/students/${s._id}`) : undefined}
            onPhotoUpdated={(studentId, photo) =>
              setStudents((prev) => prev.map((st) => (st._id === studentId ? { ...st, photo } : st)))
            }
          />
        ) : studentsLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loading />
          </div>
        ) : activeStudents.length === 0 ? (
          <div className="flex flex-1 items-center justify-center w-full text-slate-400 dark:text-slate-500 text-sm">
            {t("student.empty")}
          </div>
        ) : (
          // Telefonda (< sm) jadval emas — alohida kartalar ro'yxati: tashqi
          // ramka yo'q, kartalar orasida bo'sh joy.
          <div className="flex flex-col w-full overflow-hidden rounded-lg border border-slate-100 dark:border-night-700 max-sm:gap-2.5 max-sm:overflow-visible max-sm:rounded-none max-sm:border-0">
            <div
              // 5 ustunli (moliyaviy) jadval faqat xl'da: planshet/kichik
              // noutbukda birinchi ustunga ~150px qolib, ism kesilar va telefon
              // + Telegram belgilari summa ustiga tushardi. O'qituvchining 3
              // ustunli qatori sm'dan sig'adi.
              className={`hidden gap-2 px-3 py-2 bg-slate-50 dark:bg-night-800 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500 ${
                isTeacher
                  ? showGradeCol
                    ? "sm:grid grid-cols-[1fr_176px_140px_44px]"
                    : "sm:grid grid-cols-[1fr_140px_44px]"
                  : ownerSimple
                    ? "xl:grid grid-cols-[1fr_150px_140px_104px_44px]"
                    : "xl:grid grid-cols-[1fr_190px_120px_140px_44px]"
              }`}
            >
              <span>{t("student.fullName")}</span>
              {ownerSimple && <span>{t("student.debt")}</span>}
              {!isTeacher && !ownerSimple && <span className={isPastMonth ? "text-blue-500 dark:text-blue-400" : undefined}>
                  {isPastMonth
                    ? t("group.paymentFractionOfMonth", { month: monthNames[Number(selectedMonth.slice(5, 7)) - 1] || "" })
                    : t("student.paymentFraction")}
                </span>}
              {!isTeacher && !ownerSimple && <span>{t("student.debtStatus")}</span>}
              {showGradeCol && <span>{t("grade.add")}</span>}
              <span>{t("group.attendanceColumn")}</span>
              {ownerSimple && <span />}
              <span />
            </div>

            {sortedStudents.map((s, index) => {
              const entry = entryOf(s);
              // Tanlangan oy bo'yicha moliya (joriy oyda — avvalgi mantiq).
              // `null` — shu oyda a'zolik yo'q → "—".
              const bill = monthBilling(entry, selectedMonth, currentMonth);
              const noBill = entry.groupStatus === "pending" || !bill;
              const hasDebt = !noBill && bill.debt > 0;
              const openPay = () =>
                setPayTarget({
                  student: s,
                  entry,
                  month: bill && !bill.isCurrent ? selectedMonth : null,
                  monthDebt: bill && !bill.isCurrent ? bill.debt : 0,
                });
              // Owner: qarzi bor faol a'zolikda qatorning o'zida "To'lov".
              const payButton =
                ownerSimple && hasDebt && entry.status === "active" ? (
                  <Button
                    variant="ghost"
                    color="emerald"
                    className="gap-1.5 px-3! min-h-9! max-h-9!"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPay();
                    }}
                  >
                    <HiBanknotes className="text-base shrink-0" />
                    {t("group.payShort")}
                  </Button>
                ) : null;
              const gradeCell = showGradeCol ? (
                <GradeCell
                  value={todayGrades.grades[s._id]}
                  canWrite={canGradeToday}
                  blocked={["absent", "excused"].includes(attendanceMarks[s._id])}
                  open={gradeOpenId === s._id}
                  saving={todayGrades.saving === s._id}
                  onOpen={() => setGradeOpenId(s._id)}
                  onClose={() => setGradeOpenId(null)}
                  onPick={async (v) => {
                    if (await todayGrades.setGrade(s._id, v)) setGradeOpenId(null);
                  }}
                  onRemove={async () => {
                    if (await todayGrades.removeGrade(s._id)) setGradeOpenId(null);
                  }}
                />
              ) : null;
              return (
                <div
                  key={s._id}
                  className={`relative grid grid-cols-1 gap-2.5 px-2 py-3 border-t border-slate-100 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors max-sm:gap-2.5 max-sm:p-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200/80 dark:max-sm:border-night-700/80 max-sm:bg-white dark:max-sm:bg-night-900 max-sm:hover:bg-white dark:max-sm:hover:bg-night-900 ${
                    isTeacher
                      ? showGradeCol
                        ? "sm:grid-cols-[1fr_176px_140px_44px] sm:items-center sm:gap-2 sm:px-3 sm:py-2.5"
                        : "sm:grid-cols-[1fr_140px_44px] sm:items-center sm:gap-2 sm:px-3 sm:py-2.5"
                      : ownerSimple
                        ? "xl:grid-cols-[1fr_150px_140px_104px_44px] xl:items-center xl:gap-2 xl:px-3 xl:py-2.5"
                        : "xl:grid-cols-[1fr_190px_120px_140px_44px] xl:items-center xl:gap-2 xl:px-3 xl:py-2.5"
                  }`}
                >
                  <div className={`flex items-center gap-3 min-w-0 pr-11 ${isTeacher ? "sm:pr-0" : "xl:pr-0"}`}>
                    <RowNumber value={index + 1} />
                    {/* Avatar — rasm qo'yish/almashtirishning kirish nuqtasi
                        (oylik davomatdagi kabi); "⋮" menyusida takrorlanmaydi. */}
                    <StudentPhotoAvatar
                      student={s}
                      onUpdated={applyStudentPhoto}
                      size={isPhone ? 36 : 38}
                      rounded="rounded-full"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {/* Ism — o'quvchi sahifasiga (o'qituvchida — yutuqlar,
                            faqat badge tarifida). "Batafsil" menyu bandi o'rnida. */}
                        {!isTeacher || hasFeature(BADGE_FEATURE) ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/students/${s._id}`)}
                            className="font-semibold text-slate-800 dark:text-slate-100 truncate text-left cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                          >
                            {s.fullName}
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.fullName}</span>
                        )}
                        {!isTeacher && entry.teacherPercent != null && (
                          <ShareChip percent={entry.teacherPercent} />
                        )}
                        {/* Telefonda medal yashirin — o'rin pastki qatorda. */}
                        <span className="contents max-sm:hidden">
                          <RankMedal position={ranks[s._id]} size={21} />
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                        {/* Telefonda o'rin — telefon raqami oldida: ism qisqarmasin. */}
                        <RankChip position={ranks[s._id]} />
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{s.phone}</span>
                        {/* Mobilda Telegram alohida ustunda (pastda). */}
                        <span className={isTeacher ? "hidden sm:inline-flex" : "hidden xl:inline-flex"}>
                          <TelegramStatusBadges student={s.studentTelegram} parent={s.parentTelegram} />
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* ── Mobil: ustunlar — Qarzdorlik | Davomat | Telegram.
                      Davomat (112px — eng keng "Davomat" pill'i 100px) va
                      Telegram (94px) sobit: qatorlar bir-biri ostida tekis
                      turadi, qarzdorlik qolgan joyni oladi. 390px dan tor
                      ekranda 3 ustun sig'maydi — Telegram pastki qatorga
                      tushadi. O'qituvchida moliya yo'q → 2 ustun. Desktop
                      jadval katakchalari quyida (`hidden …:contents`). */}
                  {/* ── Telefon (< sm): ustun/ajratgichsiz ma'lumot bloklari.
                      Bloklar `flex-wrap` bilan o'raladi — 320px da Davomat
                      Qarzdorlik ostiga tushadi, kengroqda yonma-yon. Qiymatlar
                      va komponentlar quyidagi planshet bloki bilan bir xil. */}
                  <div className="sm:hidden grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2.5">
                    {!isTeacher && (
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t("student.debt")}</span>
                        {noBill ? (
                          <span title={t("group.noMembershipInMonth")} className="text-sm font-semibold text-slate-300 dark:text-slate-600">—</span>
                        ) : hasDebt ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-bold leading-tight text-red-600 dark:text-red-400 whitespace-nowrap">
                              {maskMoney(bill.debt, hideFinance)}{" "}
                              <span className="text-xs font-medium text-red-400">{t("student.somSuffix")}</span>
                            </span>
                            {payButton}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t("student.noDebt")}</span>
                        )}
                      </div>
                    )}

                    {showGradeCol && (
                      <div onClick={(e) => e.stopPropagation()} className={`flex flex-col items-start gap-1 min-w-0 ${gradeOpenId === s._id ? "col-span-2" : ""}`}>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t("grade.add")}</span>
                        {gradeCell}
                      </div>
                    )}
                    <div onClick={(e) => e.stopPropagation()} className={`flex flex-col items-start gap-1 min-w-0 ${isTeacher && !showGradeCol ? "col-span-2" : ""}`}>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t("group.attendanceColumn")}</span>
                      <AttendanceStatusCell
                        status={attendanceMarks[s._id]}
                        isToday={!!todayLesson}
                        open={attendanceOpenId === s._id}
                        onOpen={() => setAttendanceOpenId(s._id)}
                        onMark={(mark) => markAttendance(s._id, mark)}
                        onExcuse={() => openExcuse(s)}
                      />
                    </div>

                    <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{t("telegram.title")}</span>
                      <TelegramStatusBadges
                        className="flex-wrap"
                        student={s.studentTelegram}
                        parent={s.parentTelegram}
                      />
                    </div>
                  </div>

                  {/* ── Planshet (sm..xl): ustunli blok — o'zgarishsiz. */}
                  <div
                    className={`max-sm:hidden grid gap-y-2 rounded-lg bg-slate-50/70 dark:bg-night-800/70 px-1 py-2 ${
                      isTeacher
                        ? "grid-cols-2 sm:hidden"
                        : "grid-cols-[minmax(0,1fr)_112px] min-[390px]:grid-cols-[minmax(0,1fr)_112px_94px] xl:hidden"
                    }`}
                  >
                    {!isTeacher && (
                      <div className="flex flex-col gap-1 min-w-0 px-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 truncate">
                          {t("student.debt")}
                        </span>
                        {noBill ? (
                          <span title={t("group.noMembershipInMonth")} className="text-sm font-semibold text-slate-300 dark:text-slate-600">—</span>
                        ) : hasDebt ? (
                          <span className="flex flex-col items-start gap-1.5 min-w-0 leading-tight">
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-red-500 truncate">
                                {maskMoney(bill.debt, hideFinance)}
                              </span>
                              <span className="text-[11px] font-medium text-red-400">{t("student.somSuffix")}</span>
                            </span>
                            {payButton}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate">{t("student.noDebt")}</span>
                        )}
                      </div>
                    )}

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`flex flex-col gap-1 min-w-0 px-1.5 ${isTeacher ? "" : "border-l border-slate-200/70 dark:border-night-700/70"}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 truncate">
                        {t("group.attendanceColumn")}
                      </span>
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
                      className={`flex flex-col gap-1 min-w-0 px-1.5 ${
                        isTeacher
                          ? "border-l border-slate-200/70 dark:border-night-700/70"
                          : "col-span-2 pt-2 border-t border-slate-200/70 dark:border-night-700/70 min-[390px]:col-span-1 min-[390px]:pt-0 min-[390px]:border-t-0 min-[390px]:border-l"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 truncate">
                        {t("telegram.title")}
                      </span>
                      <TelegramStatusBadges
                        className={isTeacher ? "flex-col items-start!" : "min-[390px]:flex-col min-[390px]:items-start!"}
                        student={s.studentTelegram}
                        parent={s.parentTelegram}
                      />
                    </div>
                  </div>

                  {/* ── Desktop jadval katakchalari (xl+ / o'qituvchida sm+) ── */}
                  <div className={isTeacher ? "hidden sm:contents" : "hidden xl:contents"}>
                    {ownerSimple && (
                      <div className="text-sm font-semibold">
                        {noBill ? (
                          <span title={t("group.noMembershipInMonth")} className="text-slate-300 dark:text-slate-600">—</span>
                        ) : hasDebt ? (
                          <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                            {maskMoney(bill.debt, hideFinance)} <span className="text-xs font-medium text-red-400">{t("student.somSuffix")}</span>
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">{t("student.noDebt")}</span>
                        )}
                      </div>
                    )}
                    {!isTeacher && !ownerSimple && (
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {entry.groupStatus === "pending" ? (
                          <span className="text-slate-400 dark:text-slate-500">
                            {maskMoney(0, hideFinance)} / {maskMoney(0, hideFinance)} {t("student.somSuffix")}
                          </span>
                        ) : !bill ? (
                          <span title={t("group.noMembershipInMonth")} className="text-slate-300 dark:text-slate-600 cursor-default">—</span>
                        ) : (
                          <span>
                            {maskMoney(bill.paid, hideFinance)} /{" "}
                            {maskMoney(bill.due, hideFinance)} {t("student.somSuffix")}
                          </span>
                        )}
                      </div>
                    )}
                    {!isTeacher && !ownerSimple && <div>{hasDebt && <DebtPill />}</div>}
                    {showGradeCol && (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                        {gradeCell}
                      </div>
                    )}
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
                    {ownerSimple && <div>{payButton}</div>}
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    // Telefonda — kichikroq, kartaga singib ketgan yumshoq tugma
                    // (36px; IconButton'ning 44px o'lchami faqat shu yerda toraytiriladi).
                    className={`absolute top-2.5 right-2 max-sm:top-3 max-sm:right-3 max-sm:[&_button]:min-w-9 max-sm:[&_button]:max-w-9 max-sm:[&_button]:min-h-9 max-sm:[&_button]:max-h-9 max-sm:[&_button]:rounded-lg max-sm:[&_button]:bg-slate-50 max-sm:[&_button]:text-slate-500 ${
                      isTeacher ? "sm:static sm:flex sm:justify-end" : "xl:static xl:flex xl:justify-end"
                    }`}
                  >
                    <DropMenu
                      items={[
                        ...(entry.status === "active" && !isTeacher
                          ? [
                              {
                                label: t("student.addPayment"),
                                icon: HiBanknotes,
                                iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                                // Tanlangan (o'tgan) oy bo'lsa — to'lov aynan
                                // shu oyga, summa shu oyning qarzi bilan.
                                onClick: () =>
                                  setPayTarget({
                                    student: s,
                                    entry,
                                    month: bill && !bill.isCurrent ? selectedMonth : null,
                                    monthDebt: bill && !bill.isCurrent ? bill.debt : 0,
                                  }),
                              },
                            ]
                          : []),
                        {
                          label: t("student.callAction"),
                          icon: HiPhone,
                          iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                          // Ota-ona raqami bo'lsa — kimga ekani so'raladi.
                          onClick: () => {
                            if (s.parentPhone && s.parentPhone !== s.phone) setCallTarget(s);
                            else window.location.href = `tel:${s.phone}`;
                          },
                        },
                        // Tahrirlash — Students ro'yxatidagi bilan bir xil
                        // dialog, profilga kirmasdan (`student:update`).
                        ...(can("student:update")
                          ? [
                              {
                                label: t("common.edit"),
                                icon: HiPencilSquare,
                                iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                                onClick: () => setEditTarget({ student: s, entry }),
                              },
                            ]
                          : []),
                        // O'qituvchi/yordamchi — faqat kontakt (ism/raqam/
                        // ota-ona raqami), `student:contact` ruxsati bilan.
                        // `student:update` bor bo'lsa yuqoridagi to'liq dialog.
                        ...(!can("student:update") && can("student:contact")
                          ? [
                              {
                                label: t("common.edit"),
                                icon: HiPencilSquare,
                                iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                                onClick: () => setContactTarget(s),
                              },
                            ]
                          : []),
                        ...(entry.status === "active" && canAdjustCoins
                          ? [
                              {
                                label: t("coins.adjust.menu"),
                                icon: HiCurrencyDollar,
                                iconClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
                                onClick: () => setCoinTarget(s),
                              },
                            ]
                          : []),
                        // QR kartani o'quvchi/ota-onaning Telegramiga yuborish.
                        ...qrSendItems(s),
                        // Boshqa guruhga o'tkazish va guruhdan chiqarish —
                        // Resepshin/Boshliq ishi (`student:update`).
                        // O'qituvchi/yordamchida bu ruxsat yo'q, backend ham
                        // rol darajasida rad etadi (blockTeachingRoles).
                        ...(entry.status === "active" &&
                        can("student:update") &&
                        hasFeature("student.transfer")
                          ? [
                              {
                                label: t("student.transferMenu"),
                                icon: HiArrowsRightLeft,
                                iconClass: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
                                onClick: () => {
                                  setTransferTarget({ student: s, entry });
                                  setTransferKey((k) => k + 1);
                                },
                              },
                            ]
                          : []),
                        ...(entry.status === "active" && canEditEntryPercent
                          ? [
                              {
                                label: t("teacherShare.title"),
                                icon: HiReceiptPercent,
                                iconClass: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
                                onClick: () => {
                                  setEntryPercentTarget({ student: s, entry });
                                  setEntryPercentKey((k) => k + 1);
                                },
                              },
                            ]
                          : []),
                        // Arxivlash — "o'chirish" o'rniga. Faqat SHU guruhdagi
                        // a'zolik arxivga o'tadi (API_CONTRACT_archive.md §1).
                        ...(can("student:delete") && !isTeacher
                          ? [
                              {
                                label: t("archive.archive"),
                                icon: HiArchiveBox,
                                iconClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
                                onClick: () => setArchiveStudent({ student: s, entry }),
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
      )}

      <StudentDialog
        key={`enroll-${enrollKey}`}
        open={enrollOpen}
        fixedGroup={group}
        subjects={subjects}
        onClose={() => setEnrollOpen(false)}
        onSaved={() => setEnrollOpen(false)}
      />

      <ImportStudentsDialog
        open={importOpen}
        group={group}
        subjects={subjects}
        onClose={() => setImportOpen(false)}
        onSaved={() => {
          fetchStudents();
          fetchImportBatch();
        }}
      />

      <BroadcastDialog
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        groupId={group._id}
      />

      {editTargetView && (
        <StudentEditDialog
          key={editTargetView.student._id}
          open={!!editTarget}
          student={editTargetView.student}
          entries={
            editTargetView.entry.status === "active"
              ? [
                  {
                    _id: editTargetView.entry._id,
                    price: editTargetView.entry.price,
                    cycles: editTargetView.entry.priceCycles,
                    joinedAt: editTargetView.entry.joinedAt,
                    groupStatus: group.status,
                    activatedAt: group.activatedAt,
                  },
                ]
              : []
          }
          onClose={() => setEditTarget(null)}
          onSaved={fetchStudents}
        />
      )}

      <CallChooserDialog open={Boolean(callTarget)} student={callTargetView} onClose={() => setCallTarget(null)} />

      {contactTargetView && (
        <StudentContactDialog
          key={contactTargetView._id}
          open={!!contactTarget}
          student={contactTargetView}
          onClose={() => setContactTarget(null)}
          onSaved={(data) => mergeContact(data?._id, data)}
        />
      )}

      {coinTargetView && (
        <AdjustCoinsDialog
          key={coinTargetView._id}
          open={!!coinTarget}
          student={coinTargetView}
          centers={[{ _id: group.center, name: centerMap[group.center] || "" }]}
          onClose={() => setCoinTarget(null)}
        />
      )}

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
        currentLabel={groupLabel}
        teachers={teachers}
        assistants={assistants}
        rooms={rooms}
        canRenameName={canRenameGroup}
        individual={isIndividual}
        canEditSchedule={canManageGroup && !isTeacher && group.status === "active"}
        onClose={() => setScheduleOpen(false)}
        onSaved={fetchGroup}
      />

      {entryPercentView && (
        <TeacherShareDialog
          key={`entry-percent-${entryPercentKey}`}
          mode="entry"
          open={!!entryPercentTarget}
          studentId={entryPercentView.student._id}
          studentName={entryPercentView.student.fullName}
          entry={entryPercentView.entry}
          onClose={() => setEntryPercentTarget(null)}
          onSaved={(entryId, p) => applyEntryPercent(entryPercentView.student._id, entryId, p)}
        />
      )}

      {canEditPercent && (
        <TeacherShareDialog
          key={`percent-${percentKey}`}
          mode="individual"
          open={percentOpen}
          group={group}
          studentName={group.individualStudent?.fullName}
          price={monthlyFee}
          onClose={() => setPercentOpen(false)}
          onSaved={(data) =>
            setGroup((prev) =>
              prev ? { ...prev, teacherPercent: data?.teacherPercent ?? prev.teacherPercent } : prev,
            )
          }
        />
      )}

      <IssueCertificateDialog
        open={certificateOpen}
        onClose={() => setCertificateOpen(false)}
        mode="group"
        groupId={id}
      />

      {payTargetView && (
        <PaymentDialog
          open={!!payTarget}
          studentId={payTargetView.student._id}
          groupEntryId={payTargetView.entry._id}
          debt={payTargetView.entry.debt}
          // O'tgan oy tanlangan bo'lsa: oy shu oyga qo'yiladi, summa — shu oy
          // qarzi (0 bo'lsa bo'sh; joriy sikl qoldig'i aralashmasin).
          currentCyclePrice={payTargetView.month ? 0 : payTargetView.entry.currentCyclePrice}
          paidForCurrentCycle={payTargetView.month ? 0 : payTargetView.entry.paidForCurrentCycle}
          presetForMonth={payTargetView.month || undefined}
          presetAmount={payTargetView.month && payTargetView.monthDebt > 0 ? payTargetView.monthDebt : undefined}
          currentCycleMonth={payTargetView.entry.currentCycleMonth}
          courseStartMonth={payTargetView.entry.courseStartMonth}
          earliestPayableMonth={payTargetView.entry.earliestPayableMonth}
          onClose={() => setPayTarget(null)}
          onSaved={fetchStudents}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            hasFeature("receipt.manage") &&
            setReceipt({
              centerName: centerMap[payTargetView.entry.center],
              groupLabel,
              studentName: payTargetView.student.fullName,
              phone: payTargetView.student.phone,
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

      {transferTargetView && (
        <TransferStudentDialog
          key={`transfer-${transferKey}`}
          open={!!transferTarget}
          student={transferTargetView.student}
          entry={transferTargetView.entry}
          centers={centers}
          groups={allGroups}
          subjects={subjects}
          teachers={teachers}
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
            <span>
              <span className="text-slate-400 dark:text-slate-500">{t("student.fullName")}:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{excuseTarget?.student?.fullName}</span>
            </span>
            <span>
              <span className="text-slate-400 dark:text-slate-500">{t("student.receiptGroupLabel")}:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{groupLabel}</span>
            </span>
            <span>
              <span className="text-slate-400 dark:text-slate-500">{t("center.date")}:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">{new Date().toLocaleDateString(dateLocale())}</span>
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

      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={t("archive.archiveGroupTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setArchiveOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={archiving} onClick={confirmArchive}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p>{t("archive.archiveGroupConfirm", { name: groupLabel })}</p>
      </Dialog>

      <Dialog
        open={!!archiveStudent}
        onClose={() => setArchiveStudent(null)}
        title={t("archive.archiveStudentTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setArchiveStudent(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={archivingStudent} onClick={confirmArchiveStudent}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p>
          {t("archive.archiveStudentConfirm", {
            name: archiveStudent?.student?.fullName || "",
          })}
        </p>
      </Dialog>

      <Dialog
        open={undoBatchOpen}
        onClose={() => setUndoBatchOpen(false)}
        title={t("import.undoTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setUndoBatchOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={undoingBatch} onClick={confirmUndoBatch}>
              {t("import.undoButton")}
            </Button>
          </>
        }
      >
        <p>
          {t("import.undoConfirm", {
            count: (importBatch?.counts?.created ?? 0) + (importBatch?.counts?.enrolled ?? 0),
          })}
        </p>
      </Dialog>
    </div>
  );
}

export default GroupDetail;
