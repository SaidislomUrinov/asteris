import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiAcademicCap,
  HiArrowLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendar,
  HiCalendarDays,
  HiClipboardDocumentList,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentArrowDown,
  HiPencilSquare,
  HiPaperAirplane,
  HiPhone,
  HiQrCode,
  HiUser,
  HiUserGroup,
  HiArchiveBox,
  HiOutlineArrowPath,
  HiOutlineArrowsRightLeft,
  HiUserMinus,
  HiUsers,
  HiXCircle,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import GradeSummary from "./GradeSummary";
import StudentBadges from "./StudentBadges";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import StudentEditDialog from "./StudentEditDialog";
import PaymentDialog from "./PaymentDialog";
import DebtBreakdownDialog from "./DebtBreakdownDialog";
import OpeningDebtsDialog from "./OpeningDebtsDialog";
import MovePaymentMonthDialog from "./MovePaymentMonthDialog";
import ReceiptPromptDialog from "./ReceiptPromptDialog";
import AttendanceCalendar from "./AttendanceCalendar";
import QrCardDialog from "./QrCardDialog";
import IssueCertificateDialog from "../Certificates/IssueCertificateDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import useHideFinance from "../../hooks/useHideFinance";
import useClosingValue from "../../hooks/useClosingValue";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadPaymentReceiptPdf } from "./receiptPdf.util";
import { maskMoney } from "../../utils/moneyFormat";
import { formatMonthName } from "./openingDebts.util";
import { monthOfUnix } from "./paymentMonth.util";

function StudentDetail() {
  const { t } = useTranslation();
  const can = useCan();
  const [hideFinance] = useHideFinance();
  const navigate = useNavigate();
  const { id } = useParams();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const groupMap = Object.fromEntries(groups.map((g) => [g._id, g]));

  const groupLabel = (groupId) => {
    const g = groupMap[groupId];
    if (!g) return "?";
    const displayId = g.status === "pending" ? g.pendingId : g.activeId;
    return `${subjectMap[g.subject] || "?"} - ${displayId}${
      g.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""
    }`;
  };

  const hasFeature = useFeature();
  const [qrOpen, setQrOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const payTargetView = useClosingValue(payTarget);
  const [payPreset, setPayPreset] = useState(null); // { amount, forMonth } — "Qarzdorliklar"dan bitta oy tanlanganda
  // entry — "Qarzdorliklar" modali ochilganda
  const [breakdownTarget, setBreakdownTarget] = useState(null);
  const breakdownTargetView = useClosingValue(breakdownTarget);
  // O'qituvchi qo'ygan baholar xulosasi — har guruh uchun umumiy o'rtacha
  // va faqat o'zi o'qigan oylar kesimi (`GET /grades/summary/:studentId`).
  const [gradeSummary, setGradeSummary] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);
  // Arxivlash — API_CONTRACT_archive.md §1: arxiv birligi o'quvchi HUJJATI
  // emas, uning bitta guruhdagi a'zoligi.
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [paymentsTarget, setPaymentsTarget] = useState(null); // entry — "To'lovlarni ko'rish" modali
  const [downloadingPaymentId, setDownloadingPaymentId] = useState(null);
  const [attendanceTarget, setAttendanceTarget] = useState(null); // entry — "Davomatni ko'rish" modali
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const editOpenView = useClosingValue(editOpen);
  // entry — "Boshlang'ich qarz" modali (API_CONTRACT_opening_debts.md §3.2)
  const [openingTarget, setOpeningTarget] = useState(null);
  const openingTargetView = useClosingValue(openingTarget);
  // { groupEntryId, payment } — "Oyni o'zgartirish" (API_CONTRACT_payment_move_month.md)
  const [moveTarget, setMoveTarget] = useState(null);
  const moveTargetView = useClosingValue(moveTarget);
  const monthNames = t("common.monthNames", { returnObjects: true });

  const payMonth = (entry, item) => {
    setBreakdownTarget(null);
    setPayPreset({ amount: item.debt, forMonth: item.month });
    setPayTarget(entry);
  };

  // Tranzaksiyalar ro'yxatidagi ISTALGAN o'tgan to'lov uchun chekni qayta
  // yuklab olish — receiptPdf.util shu ma'lumotlarni to'lov qilingan
  // paytdagidek qabul qiladi, faqat "qolgan qarzdorlik" hozirgi holatga mos.
  const downloadPastReceipt = async (entry, payment) => {
    try {
      setDownloadingPaymentId(payment._id);
      await downloadPaymentReceiptPdf(
        {
          centerName: centerMap[entry.center],
          groupLabel: groupLabel(entry.group),
          studentName: student.fullName,
          phone: student.phone,
          amount: payment.amount,
          forMonth: payment.forMonth,
          remainingDebt: entry.debt,
          debtBreakdown: entry.debtBreakdown,
          paymentId: payment.code || payment._id,
        },
        t,
      );
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  const fetchGrades = useCallback(async () => {
    try {
      const res = await api.get(`/grades/summary/${id}`);
      if (res.data.ok) setGradeSummary(res.data.data || []);
    } catch {
      // baholar ikkinchi darajali — sahifa ularsiz ham ishlaydi
    }
  }, [id]);

  const fetchStudent = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      const res = await api.get(`/students/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "student.notFound") setNotFound(true);
        throw new Error(msg);
      }
      setStudent(data);
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
      const [centersRes, subjectsRes, groupsRes] = await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/groups", { params: { page: 1 } }),
      ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (groupsRes.data.ok) setGroups(groupsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchStudent, 0);
    return () => clearTimeout(t);
  }, [fetchStudent]);

  useEffect(() => {
    const timer = setTimeout(fetchGrades, 0);
    return () => clearTimeout(timer);
  }, [fetchGrades]);

  useEffect(() => {
    const t = setTimeout(fetchLookups, 0);
    return () => clearTimeout(t);
  }, [fetchLookups]);

  const fetchAttendanceHistory = useCallback(async () => {
    if (!attendanceTarget) return;
    try {
      setAttendanceLoading(true);
      const res = await api.get(`/attendance/${attendanceTarget.group}/student/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setAttendanceHistory(data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceTarget, id]);

  useEffect(() => {
    const t = setTimeout(fetchAttendanceHistory, 0);
    return () => clearTimeout(t);
  }, [fetchAttendanceHistory]);

  // Boshqa tab/oyna orqali shu o'quvchiga to'lov qo'shilsa/bekor qilinsa,
  // guruhdan chiqarilsa yoki davomat belgilansa — sahifa avtomatik
  // yangilanadi, qo'lda refresh talab qilinmaydi.
  useSocketEvent("payment:created", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  useSocketEvent("payment:cancelled", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  // To'lov boshqa oyga o'tkazilsa — qarz taqsimoti qayta hisoblanadi.
  useSocketEvent("payment:updated", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  // Boshlang'ich qarz / summa boshqa tab'dan o'zgarsa — qarz ko'rsatkichlari
  // server hisobidan qayta olinadi.
  useSocketEvent("student:priceUpdated", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  useSocketEvent("student:leftGroup", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  useSocketEvent("attendance:marked", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
    if (attendanceTarget) fetchAttendanceHistory();
  });
  // Boshqa tab/xodim shu o'quvchini tahrirlasa (fullName/phone/parentPhone/
  // photo) — HTTP refetchsiz, to'g'ridan-to'g'ri local state'ga qo'llanadi.
  useSocketEvent("student:updated", (payload) => {
    if (payload?.studentId !== id) return;
    setStudent((prev) =>
      prev
        ? {
            ...prev,
            fullName: payload.fullName ?? prev.fullName,
            phone: payload.phone ?? prev.phone,
            parentPhone: payload.parentPhone ?? prev.parentPhone,
            telegramSame: payload.telegramSame ?? prev.telegramSame,
            telegramPhone: payload.telegramPhone ?? prev.telegramPhone,
            parentTelegramSame: payload.parentTelegramSame ?? prev.parentTelegramSame,
            parentTelegramPhone: payload.parentTelegramPhone ?? prev.parentTelegramPhone,
            photo: payload.photo !== undefined ? payload.photo : prev.photo,
          }
        : prev,
    );
  });

  const confirmLeave = async () => {
    if (!leaveTarget) return;
    try {
      setLeaving(true);
      const res = await api.patch(`/students/${id}/groups/${leaveTarget._id}/leave`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setLeaveTarget(null);
      fetchStudent();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLeaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      setArchiving(true);
      const res = await api.patch(`/students/${id}/groups/${archiveTarget._id}/archive`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setArchiveTarget(null);
      fetchStudent();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setArchiving(false);
    }
  };

  const confirmCancelPayment = async () => {
    if (!cancelTarget) return;
    try {
      setCancelling(true);
      const res = await api.patch(
        `/students/${id}/groups/${cancelTarget.groupEntryId}/payments/${cancelTarget.paymentId}/cancel`,
      );
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setCancelTarget(null);
      fetchStudent();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Loading height="40vh" />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiUsers className="text-4xl" />
        <p className="text-sm">{t("student.notFound")}</p>
        <Button variant="outlined" onClick={() => navigate("/students")}>
          {t("student.backToList")}
        </Button>
      </div>
    );
  }

  if (!student) return null;

  const activeGroups = student.groups.filter((g) => g.status === "active");
  const totalDebt = activeGroups.reduce((sum, g) => sum + (g.debt || 0), 0);
  // Dialog ochiq turganda ham (masalan to'lov bekor qilinganda) ro'yxat
  // yangi ma'lumot bilan yangilanib tursin deb entry'ni har renderda
  // student.groups'dan qayta topamiz — saqlangan snapshot emas.
  const livePaymentsEntry = paymentsTarget
    ? student.groups.find((g) => g._id === paymentsTarget._id) || paymentsTarget
    : null;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>
        <div className="flex items-center gap-2">
          {can("student:update") && (
            <IconButton variant="ghost" color="black" title={t("student.edit")} onClick={() => setEditOpen(true)}>
              <HiPencilSquare />
            </IconButton>
          )}
          {hasFeature("attendance.qr") && (
            <Button variant="outlined" color="slate" onClick={() => setQrOpen(true)}>
              <HiQrCode className="text-base" />
              {t("attendance.qrCardAction")}
            </Button>
          )}
          {can("certificate:create") && hasFeature("certificate.manage") && (
            <Button variant="outlined" color="violet" onClick={() => setCertificateOpen(true)}>
              <HiAcademicCap className="text-base" />
              {t("certificate.issue")}
            </Button>
          )}
          <ExportExcelButton endpoint={`/students/${id}/export`} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={<HiUser />}
          title={student.fullName}
          subtitle={student.phone}
          accent="blue"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100">
            <InfoMeta icon={<HiPhone />}>{student.parentPhone || "—"}</InfoMeta>
            {/* Telegram raqami telefondan farq qilsa — alohida qator
                (API_CONTRACT_telegram_phone.md §7). */}
            {student.telegramSame === false && (
              <InfoMeta icon={<HiPaperAirplane />}>
                {t("telegramPhone.detailStudent")}: {student.telegramPhone || "—"}
              </InfoMeta>
            )}
            {student.parentTelegramSame === false && (
              <InfoMeta icon={<HiPaperAirplane />}>
                {t("telegramPhone.detailParent")}: {student.parentTelegramPhone || "—"}
              </InfoMeta>
            )}
          </div>
        </InfoCard>

        <MetricCard
          icon={<HiUserGroup />}
          title={t("student.activeGroups")}
          subtitle={t("nav.groups")}
          value={activeGroups.length}
          accent="indigo"
        />

        {/* Qarzdorlik bo'lsa qizil, aks holda yashil — bu farq muhim */}
        <MetricCard
          icon={<HiBanknotes />}
          title={t("student.totalDebtLabel")}
          subtitle={t("student.currentMonthLabel")}
          value={maskMoney(totalDebt, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          accent={totalDebt > 0 ? "red" : "emerald"}
        />
      </div>

      <p className="font-semibold text-slate-800">{t("nav.groups")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {student.groups.length === 0 ? (
          <div className="col-span-full flex items-center justify-center w-full py-10 text-slate-400 text-sm">
            {t("group.empty")}
          </div>
        ) : (
          student.groups.map((entry) => {
            // Faollashmagan (pending) guruhda sikllar yo'q, lekin boshlang'ich
            // qarz bo'lishi mumkin — `debt` shu holatda faqat o'sha qoldiq.
            const hasDebt = entry.status === "active" && entry.debt > 0;
            return (
              <div
                key={entry._id}
                className={`flex flex-col gap-3 p-4 rounded-xl border bg-white ${
                  hasDebt ? "border-red-300" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p
                      className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer truncate"
                      onClick={() => navigate(`/groups/${entry.group}`)}
                    >
                      {groupLabel(entry.group)}
                    </p>
                    <Chip
                      className="self-start"
                      value={t(entry.status === "active" ? "student.statusActive" : "student.statusLeft")}
                      color={entry.status === "active" ? "emerald" : "slate"}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.status === "active" && can("student:update") && (
                      <span className="relative inline-flex">
                        <IconButton
                          variant="ghost"
                          color="black"
                          title={t("student.openingDebtAction")}
                          onClick={() => setOpeningTarget(entry)}
                        >
                          <HiOutlineClipboardDocumentList />
                        </IconButton>
                        {entry.openingDebtRemaining > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white pointer-events-none" />
                        )}
                      </span>
                    )}
                    {entry.status === "active" && (
                      <IconButton
                        variant="ghost"
                        color="emerald"
                        title={t("student.addPayment")}
                        onClick={() => {
                          setPayPreset(null);
                          setPayTarget(entry);
                        }}
                      >
                        <HiBanknotes />
                      </IconButton>
                    )}
                    {/* Arxivlash — "o'chirish" o'rniga. Guruhdan chiqarilgan
                        (left) a'zolikni ham arxivlash mumkin, shuning uchun
                        `status === "active"` shartidan TASHQARIDA turadi
                        (API_CONTRACT_archive.md §1). */}
                    {can("student:delete") && (
                      <IconButton
                        variant="ghost"
                        color="orange"
                        title={t("archive.archive")}
                        onClick={() => setArchiveTarget(entry)}
                      >
                        <HiArchiveBox />
                      </IconButton>
                    )}
                    {/* Guruhdan chiqarish — `student:update` ruxsati
                        bo'lganlarda (Resepshin/Boshliq). O'qituvchi bu
                        sahifani umuman ocha olmaydi (backend 403). */}
                    {entry.status === "active" && can("student:update") && (
                      <IconButton
                        variant="ghost"
                        color="red"
                        title={t("student.leaveGroup")}
                        onClick={() => setLeaveTarget(entry)}
                      >
                        <HiUserMinus />
                      </IconButton>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <HiBuildingOffice2 className="text-slate-400 shrink-0" />
                  <span className="truncate">{centerMap[entry.center] || "—"}</span>
                  <span className="ml-auto shrink-0 text-slate-400">
                    {maskMoney(entry.price, hideFinance)} {t("student.somSuffix")}
                  </span>
                </div>

                {/* Guruhdan guruhga o'tkazish zanjiri (API_CONTRACT_student_transfer.md) */}
                {(entry.transferredTo || entry.transferredFrom?.length > 0) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <HiOutlineArrowsRightLeft className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {entry.transferredTo
                        ? t("student.transferredToGroup", { group: groupLabel(entry.transferredTo.group) })
                        : t("student.transferredFromGroup", {
                            group: entry.transferredFrom.map((src) => groupLabel(src.group)).join(" → "),
                          })}
                    </span>
                  </div>
                )}

                {entry.groupStatus === "pending" && !hasDebt ? (
                  <div className="p-2.5 rounded-lg bg-slate-50 text-sm text-slate-400">
                    {t("student.debt")}: {maskMoney(0, hideFinance)} {t("student.somSuffix")}
                    {entry.paidAmount > 0 ? ` — ${t("student.creditForFuture")}` : ""}
                  </div>
                ) : (
                  <>
                    {entry.groupStatus !== "pending" && (
                    <div className="flex flex-col gap-0.5 p-2.5 rounded-lg bg-slate-50">
                      <span className="text-xs text-slate-400">{t("student.currentMonthLabel")}</span>
                      <span
                        className={`text-sm font-semibold ${
                          (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0) > 0
                            ? "text-red-600"
                            : "text-slate-800"
                        }`}
                      >
                        {maskMoney(entry.paidForCurrentCycle, hideFinance)} /{" "}
                        {maskMoney(entry.currentCyclePrice, hideFinance)} {t("student.somSuffix")}
                      </span>
                    </div>
                    )}

                    <div
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${
                        hasDebt ? "bg-red-50" : "bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs text-slate-400">{t("student.totalDebtLabel")}</span>
                        <span className={`text-sm font-semibold ${hasDebt ? "text-red-600" : "text-slate-800"}`}>
                          {hasDebt
                            ? maskMoney(entry.debt, hideFinance) + " " + t("student.somSuffix")
                            : t("student.noDebt")}
                        </span>
                      </div>
                      {hasDebt && entry.debtBreakdown?.length > 0 && (
                        <Button
                          color="red"
                          variant="outlined"
                          className="gap-1.5 !py-1 !px-2.5 text-xs shrink-0"
                          onClick={() => setBreakdownTarget(entry)}
                        >
                          {t("student.debtBreakdownButton")}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* O'qituvchi qo'ygan baholar — o'rtacha va oylar kesimi */}
                <GradeSummary summary={gradeSummary.find((g) => g.group === entry.group)} />

                <div className="flex flex-col gap-2 mt-auto">
                  <Button
                    variant="outlined"
                    className="gap-1.5 w-full"
                    onClick={() => setPaymentsTarget(entry)}
                  >
                    <HiClipboardDocumentList className="text-base" />
                    {t("student.viewPaymentsButton")}
                    {entry.payments.length > 0 && (
                      <Chip
                        value={entry.payments.length}
                        color="slate"
                        variant="ghost"
                        className="!py-0.5 !px-1.5"
                      />
                    )}
                  </Button>
                  {entry.groupStatus !== "pending" && (
                    <Button
                      variant="outlined"
                      className="gap-1.5 w-full"
                      onClick={() => setAttendanceTarget(entry)}
                    >
                      <HiCalendarDays className="text-base" />
                      {t("student.viewAttendanceButton")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Oylik yutuq nishonlari — tarif flagi + student:view ichkarida tekshiriladi */}
      <StudentBadges studentId={id} />

      {breakdownTargetView && (
        <DebtBreakdownDialog
          open={!!breakdownTarget}
          onClose={() => setBreakdownTarget(null)}
          breakdown={breakdownTargetView.debtBreakdown}
          onPayMonth={(item) => payMonth(breakdownTargetView, item)}
        />
      )}

      {payTargetView && (
        <PaymentDialog
          open={!!payTarget}
          studentId={id}
          groupEntryId={payTargetView._id}
          debt={payTargetView.debt}
          currentCyclePrice={payTargetView.currentCyclePrice}
          paidForCurrentCycle={payTargetView.paidForCurrentCycle}
          currentCycleMonth={payTargetView.currentCycleMonth}
          courseStartMonth={payTargetView.courseStartMonth}
          earliestPayableMonth={payTargetView.earliestPayableMonth}
          presetAmount={payPreset?.amount}
          presetForMonth={payPreset?.forMonth}
          onClose={() => {
            setPayTarget(null);
            setPayPreset(null);
          }}
          onSaved={fetchStudent}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            hasFeature("receipt.manage") &&
            setReceipt({
              centerName: centerMap[payTargetView.center],
              groupLabel: groupLabel(payTargetView.group),
              studentName: student.fullName,
              phone: student.phone,
              amount,
              forMonth,
              remainingDebt,
              debtBreakdown,
              paymentId,
            })
          }
        />
      )}

      {openingTargetView && (
        <OpeningDebtsDialog
          key={openingTargetView._id}
          open={!!openingTarget}
          studentId={id}
          entry={openingTargetView}
          title={`${t("student.openingDebtAction")} — ${groupLabel(openingTargetView.group)}`}
          onClose={() => setOpeningTarget(null)}
          onSaved={fetchStudent}
        />
      )}

      {moveTargetView && (
        <MovePaymentMonthDialog
          key={moveTargetView.payment._id}
          open={!!moveTarget}
          studentId={id}
          entry={student.groups.find((g) => g._id === moveTargetView.groupEntryId)}
          payment={moveTargetView.payment}
          onClose={() => setMoveTarget(null)}
          onSaved={fetchStudent}
        />
      )}

      <ReceiptPromptDialog open={!!receipt} receipt={receipt} onClose={() => setReceipt(null)} />

      <Dialog
        open={!!paymentsTarget}
        onClose={() => setPaymentsTarget(null)}
        title={`${t("student.paymentHistory")} — ${paymentsTarget ? groupLabel(paymentsTarget.group) : ""}`}
      >
        {!livePaymentsEntry ||
        (livePaymentsEntry.payments.length === 0 && !livePaymentsEntry.transferredPayments?.length) ? (
          <p className="text-sm text-slate-400 text-center py-4">{t("student.noPayments")}</p>
        ) : (
          <div className="flex flex-col gap-1.5 w-full">
            {livePaymentsEntry.payments.map((p) => (
              <div
                key={p._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 px-3 py-2 rounded-lg bg-slate-50 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span
                    className={`font-semibold ${
                      p.status === "paid" ? "text-slate-800" : "text-slate-400 line-through"
                    }`}
                  >
                    {maskMoney(p.amount, hideFinance)} {t("student.somSuffix")}
                  </span>
                  <Chip value={t(`student.paymentType${capitalize(p.type)}`)} color="slate" variant="ghost" />
                  {p.status !== "paid" && (
                    <Chip
                      value={t(`student.paymentStatus${capitalize(p.status)}`)}
                      color="red"
                      variant="ghost"
                    />
                  )}
                  {/* Belgi faqat to'lov HOZIR asl oyidan boshqa oyda bo'lsa —
                      boshqa oyga o'tkazilib, keyin qaytarilgan to'lovda
                      ("Avval: Avgust" — o'sha oyning o'zi) chalkashtirmasin. */}
                  {p.forMonthHistory?.length > 0 &&
                    (p.forMonthHistory[0].from || monthOfUnix(p.date)) !== (p.forMonth || monthOfUnix(p.date)) && (
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-600 shrink-0"
                      title={`${t("student.paymentMovedFrom")}: ${formatMonthName(
                        p.forMonthHistory[0].from || monthOfUnix(p.date),
                        monthNames,
                      )}`}
                    >
                      <HiOutlineArrowPath className="text-xs" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 text-slate-400 shrink-0">
                  <span className="flex items-center gap-1 text-xs mr-auto sm:mr-0">
                    <HiCalendar /> {formatUnix(p.date)}
                  </span>
                  {p.status === "paid" && hasFeature("receipt.manage") && (
                    <IconButton
                      variant="ghost"
                      color="blue"
                      loading={downloadingPaymentId === p._id}
                      title={t("student.downloadReceipt")}
                      onClick={() => downloadPastReceipt(livePaymentsEntry, p)}
                    >
                      <HiOutlineDocumentArrowDown />
                    </IconButton>
                  )}
                  {p.status === "paid" && can("payment:create") && (
                    <IconButton
                      variant="ghost"
                      color="slate"
                      title={t("student.movePaymentMonth")}
                      onClick={() => setMoveTarget({ groupEntryId: livePaymentsEntry._id, payment: p })}
                    >
                      <HiOutlineArrowsRightLeft />
                    </IconButton>
                  )}
                  {p.status === "paid" && hasFeature("finance.refund") && can("payment:refund") && (
                    <IconButton
                      variant="ghost"
                      color="red"
                      title={t("student.cancelPayment")}
                      onClick={() =>
                        setCancelTarget({ groupEntryId: livePaymentsEntry._id, paymentId: p._id })
                      }
                    >
                      <HiXCircle />
                    </IconButton>
                  )}
                </div>
              </div>
            ))}

            {/* Oldingi guruh(lar)dagi to'lovlar — faqat ko'rish: ular o'z
                guruhida qoladi (oylik/tushum tarixi buzilmasligi uchun),
                qoldiq esa bu a'zolikka avans/qarz sifatida o'tgan. */}
            {livePaymentsEntry.transferredPayments?.length > 0 && (
              <>
                <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("student.transferredPayments")}
                </span>
                {livePaymentsEntry.transferredPayments.map((p) => (
                  <div
                    key={p._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`font-semibold ${
                          p.status === "paid" ? "text-slate-600" : "text-slate-400 line-through"
                        }`}
                      >
                        {maskMoney(p.amount, hideFinance)} {t("student.somSuffix")}
                      </span>
                      <Chip value={t(`student.paymentType${capitalize(p.type)}`)} color="slate" variant="ghost" />
                      <span className="text-xs text-slate-400 truncate">{groupLabel(p.fromGroup)}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                      <HiCalendar /> {formatUnix(p.date)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
        title={`${t("student.attendanceHistory")} — ${attendanceTarget ? groupLabel(attendanceTarget.group) : ""}`}
      >
        {attendanceLoading ? (
          <Loading height="15vh" />
        ) : attendanceHistory.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t("student.noAttendance")}</p>
        ) : (
          <AttendanceCalendar records={attendanceHistory} />
        )}
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
        <p>{t("student.leaveGroupConfirm", { name: student.fullName })}</p>
      </Dialog>

      <Dialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        title={t("archive.archiveTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setArchiveTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={archiving} onClick={confirmArchive}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p>{t("archive.archiveStudentConfirm", { name: student.fullName })}</p>
      </Dialog>

      <Dialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t("student.cancelPayment")}
        zIndex="z-40"
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setCancelTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={cancelling} onClick={confirmCancelPayment}>
              {t("student.cancelPayment")}
            </Button>
          </>
        }
      >
        <p>{t("student.cancelPaymentConfirm")}</p>
      </Dialog>

      {editOpenView && (
        <StudentEditDialog
          key={student._id}
          open={editOpen}
          student={student}
          entries={activeGroups.map((g) => ({ _id: g._id, label: groupLabel(g.group), price: g.price }))}
          onClose={() => setEditOpen(false)}
          onSaved={fetchStudent}
        />
      )}

      <QrCardDialog open={qrOpen} onClose={() => setQrOpen(false)} student={student} />
      <IssueCertificateDialog
        open={certificateOpen}
        onClose={() => setCertificateOpen(false)}
        mode="student"
        studentId={id}
        groupOptions={activeGroups.map((g) => ({ value: g.group, label: groupLabel(g.group) }))}
      />
    </div>
  );
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatUnix(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("uz-UZ");
}

export default StudentDetail;
