import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendar,
  HiCalendarDays,
  HiClipboardDocumentList,
  HiOutlineDocumentArrowDown,
  HiPhone,
  HiQrCode,
  HiUser,
  HiUserGroup,
  HiUserMinus,
  HiUsers,
  HiXCircle,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import GradeSummary from "./GradeSummary";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import PaymentDialog from "./PaymentDialog";
import DebtBreakdownDialog from "./DebtBreakdownDialog";
import ReceiptPromptDialog from "./ReceiptPromptDialog";
import AttendanceCalendar from "./AttendanceCalendar";
import QrCardDialog from "./QrCardDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadPaymentReceiptPdf } from "./receiptPdf.util";

function StudentDetail() {
  const { t } = useTranslation();
  const can = useCan();
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
  const [payTarget, setPayTarget] = useState(null);
  const [payPreset, setPayPreset] = useState(null); // { amount, forMonth } — "Qarzdorliklar"dan bitta oy tanlanganda
  // entry — "Qarzdorliklar" modali ochilganda
  const [breakdownTarget, setBreakdownTarget] = useState(null);
  // O'qituvchi qo'ygan baholar xulosasi — har guruh uchun umumiy o'rtacha
  // va faqat o'zi o'qigan oylar kesimi (`GET /grades/summary/:studentId`).
  const [gradeSummary, setGradeSummary] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [paymentsTarget, setPaymentsTarget] = useState(null); // entry — "To'lovlarni ko'rish" modali
  const [downloadingPaymentId, setDownloadingPaymentId] = useState(null);
  const [attendanceTarget, setAttendanceTarget] = useState(null); // entry — "Davomatni ko'rish" modali
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

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
          paymentId: payment._id,
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
    fetchStudent();
  }, [fetchStudent]);

  useEffect(() => {
    const timer = setTimeout(fetchGrades, 0);
    return () => clearTimeout(timer);
  }, [fetchGrades]);

  useEffect(() => {
    fetchLookups();
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
    fetchAttendanceHistory();
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
  useSocketEvent("student:leftGroup", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
  });
  useSocketEvent("attendance:marked", (payload) => {
    if (payload?.studentId !== id) return;
    fetchStudent();
    if (attendanceTarget) fetchAttendanceHistory();
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
          {hasFeature("attendance.qr") && (
            <Button variant="outlined" color="slate" onClick={() => setQrOpen(true)}>
              <HiQrCode className="text-base" />
              {t("attendance.qrCardAction")}
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
          value={totalDebt.toLocaleString("uz-UZ")}
          suffix={t("student.somSuffix")}
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
            const hasDebt =
              entry.status === "active" && entry.groupStatus !== "pending" && entry.debt > 0;
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
                  {entry.status === "active" && (
                    <div className="flex items-center gap-1 shrink-0">
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
                      {/* Guruhdan chiqarish — `student:update` ruxsati
                          bo'lganlarda (Resepshin/Boshliq). O'qituvchi bu
                          sahifani umuman ocha olmaydi (backend 403). */}
                      {can("student:update") && (
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
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <HiBuildingOffice2 className="text-slate-400 shrink-0" />
                  <span className="truncate">{centerMap[entry.center] || "—"}</span>
                  <span className="ml-auto shrink-0 text-slate-400">
                    {entry.price.toLocaleString("uz-UZ")} {t("student.somSuffix")}
                  </span>
                </div>

                {entry.groupStatus === "pending" ? (
                  <div className="p-2.5 rounded-lg bg-slate-50 text-sm text-slate-400">
                    {t("student.debt")}: 0 {t("student.somSuffix")}
                    {entry.paidAmount > 0 ? ` — ${t("student.creditForFuture")}` : ""}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5 p-2.5 rounded-lg bg-slate-50">
                      <span className="text-xs text-slate-400">{t("student.currentMonthLabel")}</span>
                      <span
                        className={`text-sm font-semibold ${
                          (entry.currentCyclePrice || 0) - (entry.paidForCurrentCycle || 0) > 0
                            ? "text-red-600"
                            : "text-slate-800"
                        }`}
                      >
                        {(entry.paidForCurrentCycle || 0).toLocaleString("uz-UZ")} /{" "}
                        {(entry.currentCyclePrice || 0).toLocaleString("uz-UZ")} {t("student.somSuffix")}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${
                        hasDebt ? "bg-red-50" : "bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs text-slate-400">{t("student.totalDebtLabel")}</span>
                        <span className={`text-sm font-semibold ${hasDebt ? "text-red-600" : "text-slate-800"}`}>
                          {hasDebt
                            ? entry.debt.toLocaleString("uz-UZ") + " " + t("student.somSuffix")
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

      {breakdownTarget && (
        <DebtBreakdownDialog
          open={!!breakdownTarget}
          onClose={() => setBreakdownTarget(null)}
          breakdown={breakdownTarget.debtBreakdown}
          onPayMonth={(item) => payMonth(breakdownTarget, item)}
        />
      )}

      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          studentId={id}
          groupEntryId={payTarget._id}
          debt={payTarget.debt}
          currentCyclePrice={payTarget.currentCyclePrice}
          paidForCurrentCycle={payTarget.paidForCurrentCycle}
          currentCycleMonth={payTarget.currentCycleMonth}
          courseStartMonth={payTarget.courseStartMonth}
          presetAmount={payPreset?.amount}
          presetForMonth={payPreset?.forMonth}
          onClose={() => {
            setPayTarget(null);
            setPayPreset(null);
          }}
          onSaved={fetchStudent}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            setReceipt({
              centerName: centerMap[payTarget.center],
              groupLabel: groupLabel(payTarget.group),
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

      <ReceiptPromptDialog open={!!receipt} receipt={receipt} onClose={() => setReceipt(null)} />

      <Dialog
        open={!!paymentsTarget}
        onClose={() => setPaymentsTarget(null)}
        title={`${t("student.paymentHistory")} — ${paymentsTarget ? groupLabel(paymentsTarget.group) : ""}`}
      >
        {!livePaymentsEntry || livePaymentsEntry.payments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t("student.noPayments")}</p>
        ) : (
          <div className="flex flex-col gap-1.5 w-full">
            {livePaymentsEntry.payments.map((p) => (
              <div
                key={p._id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      p.status === "paid" ? "text-slate-800" : "text-slate-400 line-through"
                    }`}
                  >
                    {p.amount.toLocaleString("uz-UZ")} {t("student.somSuffix")}
                  </span>
                  <Chip value={t(`student.paymentType${capitalize(p.type)}`)} color="slate" variant="ghost" />
                  {p.status !== "paid" && (
                    <Chip
                      value={t(`student.paymentStatus${capitalize(p.status)}`)}
                      color="red"
                      variant="ghost"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="flex items-center gap-1 text-xs">
                    <HiCalendar /> {formatUnix(p.date)}
                  </span>
                  {p.status === "paid" && (
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
                  {p.status === "paid" && (
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

      <QrCardDialog open={qrOpen} onClose={() => setQrOpen(false)} student={student} />
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
