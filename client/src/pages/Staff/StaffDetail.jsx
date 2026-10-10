import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiChartBar,
  HiClipboardDocumentList,
  HiEye,
  HiLockClosed,
  HiLockOpen,
  HiPencil,
  HiPlus,
  HiTrash,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import NumberText from "../../ui/NumberText";
import MonthInput from "../../ui/MonthInput";
import StaffDialog from "./StaffDialog";
import SalaryTransactionDialog from "../Salary/SalaryTransactionDialog";
import { RateBar } from "../Reports/shared";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import useHideFinance from "../../hooks/useHideFinance";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import IndividualSalaryRows from "../../components/IndividualSalaryRows";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const TX_COLOR = { advance: "orange", withdrawal: "red", bonus: "emerald", penalty: "red" };

function StaffDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const can = useCan();
  const hasFeature = useFeature();
  const [hideFinance] = useHideFinance();
  const money = (v) => maskMoney(v, hideFinance);
  const canManageSalary = can("salary:manage");

  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [salary, setSalary] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [txOpen, setTxOpen] = useState(false);
  const [txKey, setTxKey] = useState(0);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  const [performance, setPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r._id, r.name]));

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      const res = await api.get(`/staffs/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "staff.notFound") setNotFound(true);
        throw new Error(msg);
      }
      setStaff(data);
    } catch (error) {
      if (!notFound) setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  const fetchSalary = useCallback(async () => {
    try {
      setSalaryLoading(true);
      const res = await api.get(`/salaries/${id}`, { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSalary(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSalaryLoading(false);
    }
  }, [id, month]);

  // Samaradorlik bo'limi — faqat O'qituvchi/Yordamchi uchun, ko'ruvchida
  // `report:view` ruxsati bo'lsa VA tarif "teacher.performance" ochgan bo'lsa.
  const showPerformance =
    staff && ["teacher", "assistant"].includes(staff.role) && can("report:view") && hasFeature("teacher.performance");

  const fetchPerformance = useCallback(async () => {
    if (!staff || !showPerformance) {
      setPerformanceLoading(false);
      return;
    }
    try {
      setPerformanceLoading(true);
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const res = await api.get("/reports/by-teacher", {
        params: {
          period: "custom",
          from: `${month}-01`,
          to: `${month}-${String(lastDay).padStart(2, "0")}`,
          center: staff.center,
        },
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setPerformance((data || []).find((row) => String(row.staff._id) === String(id)) || null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setPerformanceLoading(false);
    }
  }, [staff, showPerformance, month, id]);

  // Hodim qamrovidagi guruhlar: Teacher — faqat o'zi biriktirilgan guruhlar,
  // Manager/Reception — markazdagi barcha guruhlar (feedback_staff_salary_scope
  // bilan bir xil naqsh: [[feedback_staff_salary_scope]]).
  const fetchGroups = useCallback(async () => {
    if (!staff) return;
    try {
      setGroupsLoading(true);
      const params =
        staff.role === "teacher" ? { page: 1, teacher: id } : { page: 1, center: staff.center };
      const [groupsRes, subjectsRes, roomsRes] = await Promise.all([
        api.get("/groups", { params }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/rooms", { params: { page: 1 } }),
      ]);
      if (groupsRes.data.ok) setGroups(groupsRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setGroupsLoading(false);
    }
  }, [staff, id]);

  useEffect(() => {
    const t = setTimeout(fetchStaff, 0);
    return () => clearTimeout(t);
  }, [fetchStaff]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  useEffect(() => {
    const t = setTimeout(fetchSalary, 0);
    return () => clearTimeout(t);
  }, [fetchSalary]);

  useEffect(() => {
    const t = setTimeout(fetchGroups, 0);
    return () => clearTimeout(t);
  }, [fetchGroups]);

  useEffect(() => {
    const timer = setTimeout(fetchPerformance, 0);
    return () => clearTimeout(timer);
  }, [fetchPerformance]);

  // Boshqa joydan (Salary sahifasi, to'lov qabul qilinishi) shu hodimning
  // oyligi o'zgarsa — realtime qayta yuklanadi, refresh talab qilinmaydi.
  useSocketEvent("salary:updated", fetchSalary);
  useSocketEvent("payment:created", fetchSalary);
  useSocketEvent("payment:cancelled", fetchPerformance);
  useSocketEvent("payment:updated", fetchSalary);
  useSocketEvent("payment:updated", fetchPerformance);
  useSocketEvent("attendance:marked", fetchPerformance);

  const toggleBlock = async () => {
    try {
      setBlocking(true);
      const action = staff.blocked ? "unblock" : "block";
      const res = await api.patch(`/staffs/${id}/${action}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      fetchStaff();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBlocking(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/staffs/${id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      navigate("/staff");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const confirmCancelTx = async () => {
    if (!cancelTarget) return;
    try {
      setCancelingId(cancelTarget._id);
      const res = await api.patch(`/salaries/transactions/${cancelTarget._id}/cancel`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setCancelTarget(null);
      fetchSalary();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setCancelingId(null);
    }
  };

  const salaryTypeChip = useMemo(() => {
    if (!salary) return null;
    if (salary.salaryType === "fixed") return <Chip value={t("salary.typeFixed")} color="blue" />;
    if (salary.salaryType === "percentage")
      return <Chip value={`${salary.percent ?? staff?.salaryValue ?? 0}%`} color="violet" />;
    return <Chip value="—" color="slate" />;
  }, [salary, staff, t]);

  if (loading) return <Loading height="40vh" />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
        <HiUser className="text-4xl" />
        <p className="text-sm">{t("staff.notFound")}</p>
        <Button variant="outlined" onClick={() => navigate("/staff")}>
          {t("staff.backToList")}
        </Button>
      </div>
    );
  }

  if (!staff) return null;

  const centerName = centers.find((c) => c._id === staff.center)?.name || "—";

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>

        <div className="flex items-center gap-2">
          <IconButton
            variant="ghost"
            color="blue"
            onClick={() => {
              setDialogKey((k) => k + 1);
              setDialogOpen(true);
            }}
          >
            <HiPencil />
          </IconButton>
          <IconButton
            variant="ghost"
            color={staff.blocked ? "emerald" : "orange"}
            loading={blocking}
            onClick={toggleBlock}
            title={t(staff.blocked ? "staff.unblock" : "staff.block")}
          >
            {staff.blocked ? <HiLockOpen /> : <HiLockClosed />}
          </IconButton>
          <IconButton variant="ghost" color="red" onClick={() => setDeleteTarget(true)}>
            <HiTrash />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={<HiUser />}
          title={staff.name}
          subtitle={staff.login}
          accent="blue"
          badge={
            <Chip
              value={staff.blocked ? t("staff.statusBlocked") : t("staff.active")}
              color={staff.blocked ? "red" : "emerald"}
              variant="filled"
            />
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Chip value={t(`role.${staff.role}`)} color="slate" variant="ghost" />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100 dark:border-night-700">
            <InfoMeta icon={<HiBuildingOffice2 />}>{centerName}</InfoMeta>
          </div>
        </InfoCard>

        <MetricCard
          icon={<HiUserGroup />}
          title={t("nav.groups")}
          subtitle={staff.role === "teacher" ? t("group.infoCardDesc") : t("dashboard.center")}
          value={groups.length}
          accent="indigo"
        />

        <MetricCard
          icon={<HiBanknotes />}
          title={t("salary.final")}
          subtitle={t("salary.base")}
          value={salaryLoading ? "…" : money(salary?.final)}
          suffix={t("student.somSuffix")}
          accent="emerald"
        >
          {/* Oy tanlagich aynan shu kartaga tegishli — oylik summa shunga bog'liq */}
          <MonthInput
            className="self-start w-44"
            value={month}
            onChange={(m) => setMonth(m || currentMonth())}
            max={currentMonth()}
          />
        </MetricCard>
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("salary.title")}</p>
            {salaryTypeChip}
          </div>
          {canManageSalary && (
            <Button
              variant="outlined"
              className="gap-1.5"
              onClick={() => {
                setTxKey((k) => k + 1);
                setTxOpen(true);
              }}
            >
              <HiPlus className="text-base" />
              {t("salary.paymentPenaltyAction")}
            </Button>
          )}
        </div>

        {salaryLoading || !salary ? (
          <Loading height="15vh" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.base")}</span>
                <NumberText>{money(salary.base)}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.advance")}</span>
                <NumberText>{money(salary.advance)}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.withdrawal")}</span>
                <NumberText>{money(salary.withdrawal)}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.bonus")}</span>
                <NumberText className="text-emerald-600 dark:text-emerald-400">{money(salary.bonus)}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.penalty")}</span>
                <NumberText className="text-red-600 dark:text-red-400">
                  {salary.penalty ? `-${money(salary.penalty)}` : money(0)}
                </NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800 col-span-2 sm:col-span-1">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("salary.final")}</span>
                <NumberText className={salary.final < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                  {money(salary.final)}
                </NumberText>
              </div>
            </div>

            <IndividualSalaryRows
              individual={salary.individual}
              hidden={hideFinance}
              className="px-3 rounded-lg bg-slate-50 dark:bg-night-800"
            />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HiClipboardDocumentList className="text-slate-400 dark:text-slate-500" />
                {t("salary.transactions")}
              </p>
              {salary.transactions.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">{t("salary.noTransactions")}</p>
              ) : (
                salary.transactions.map((tx) => {
                  const cancelled = tx.status === "cancelled";
                  return (
                    <div
                      key={tx._id}
                      className={`relative flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 dark:border-night-700 ${
                        cancelled ? "opacity-50" : ""
                      }`}
                    >
                      {cancelled && (
                        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-400 -translate-y-1/2 pointer-events-none" />
                      )}
                      <div className="flex items-center gap-2">
                        <Chip value={t(`salary.txType.${tx.type}`)} color={TX_COLOR[tx.type]} />
                        <div className="flex flex-col">
                          <NumberText>
                            {tx.type === "penalty" ? `-${money(tx.amount)}` : money(tx.amount)}
                          </NumberText>
                          {tx.note && <span className="text-xs text-slate-400 dark:text-slate-500">{tx.note}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{tx.date}</span>
                        {canManageSalary && tx.status === "active" && tx.type !== "advance" && (
                          <Button variant="text" color="red" onClick={() => setCancelTarget(tx)}>
                            <HiTrash className="text-base" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {showPerformance && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
          <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <HiChartBar className="text-fuchsia-500" />
            {t("report.teacherPerformanceTitle")}
          </p>

          {performanceLoading ? (
            <Loading height="12vh" />
          ) : !performance ? (
            <div className="flex items-center justify-center w-full py-6 text-slate-400 dark:text-slate-500 text-sm">
              {t("report.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("report.lessonsHeld")}</span>
                <NumberText>{performance.lessonsHeld}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("report.attendanceRate")}</span>
                <RateBar value={performance.attendanceRate} />
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("report.revenueGenerated")}</span>
                <NumberText className="text-emerald-600 dark:text-emerald-400">{money(performance.revenueGenerated)}</NumberText>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <span className="text-xs text-slate-400 dark:text-slate-500">{t("report.students")}</span>
                <NumberText>{performance.students}</NumberText>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t("nav.groups")}</p>

        {groupsLoading ? (
          <Loading height="15vh" />
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center w-full py-8 text-slate-400 dark:text-slate-500 text-sm">
            {t("group.empty")}
          </div>
        ) : (
          <div className="flex flex-col w-full overflow-hidden rounded-lg border border-slate-100 dark:border-night-700">
            <div className="hidden sm:grid grid-cols-[1fr_140px_110px_100px_44px] gap-2 px-3 py-2 bg-slate-50 dark:bg-night-800 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
              <span>{t("group.subject")}</span>
              <span>{t("room.title")}</span>
              <span>{t("group.status")}</span>
              <span>{t("group.studentsCount")}</span>
              <span />
            </div>

            {groups.map((g) => (
              <div
                key={g._id}
                onClick={() => navigate(`/groups/${g._id}`)}
                className="grid grid-cols-1 sm:grid-cols-[1fr_140px_110px_100px_44px] items-center gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors cursor-pointer"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {subjectMap[g.subject] || "?"} - {g.status === "pending" ? g.pendingId : g.activeId}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{roomMap[g.room] || "—"}</span>
                <span>
                  <Chip
                    value={t(`group.status${g.status[0].toUpperCase()}${g.status.slice(1)}`)}
                    color={g.status === "active" ? "emerald" : g.status === "pending" ? "orange" : "slate"}
                    variant="ghost"
                  />
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{g.studentsCount || 0}</span>
                <span className="flex items-center justify-end">
                  <HiEye className="text-slate-300 dark:text-slate-600" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <StaffDialog
        key={`dialog-${dialogKey}`}
        open={dialogOpen}
        staff={staff}
        centers={centers}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchStaff}
      />

      <SalaryTransactionDialog
        key={`tx-${txKey}`}
        open={txOpen}
        staff={staff}
        month={month}
        onClose={() => setTxOpen(false)}
        onSaved={fetchSalary}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(false)}
        title={t("staff.delete")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p>{t("staff.deleteConfirm", { name: staff?.name })}</p>
      </Dialog>

      <Dialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t("salary.cancelTxTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setCancelTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={!!cancelingId} onClick={confirmCancelTx}>
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <p>
          {t("salary.cancelTxConfirm", {
            type: cancelTarget ? t(`salary.txType.${cancelTarget.type}`) : "",
            amount: cancelTarget ? money(cancelTarget.amount) : "",
          })}
        </p>
      </Dialog>
    </div>
  );
}

export default StaffDetail;
