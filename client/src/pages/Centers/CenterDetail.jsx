import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendar,
  HiCog6Tooth,
  HiHome,
  HiLockClosed,
  HiPencil,
  HiRectangleGroup,
  HiTrash,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import LazyImage from "../../ui/LazyImage";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import Loading from "../../ui/Loading";
import NumberText from "../../ui/NumberText";
import Avatar from "../../ui/Avatar";
import MonthInput from "../../ui/MonthInput";
import CenterDialog from "./CenterDialog";
import CenterSettingsDialog from "./CenterSettingsDialog";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import ExpenseCategoryDonut from "./ExpenseCategoryDonut";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useHideFinance from "../../hooks/useHideFinance";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function CenterDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [hideFinance] = useHideFinance();

  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [roomsCount, setRoomsCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [teacherSalary, setTeacherSalary] = useState({ total: 0, count: 0 });

  const fetchCenter = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      const res = await api.get(`/centers/${id}`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "center.notFound") setNotFound(true);
        throw new Error(msg);
      }
      setCenter(data);
    } catch (error) {
      if (!notFound) setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [id, notFound]);

  useEffect(() => {
    const id_ = setTimeout(fetchCenter, 0);
    return () => clearTimeout(id_);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get("/dashboard", { params: { month, center: id } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setStats(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setStatsLoading(false);
    }
  }, [id, month]);

  const fetchExpenseByCategory = useCallback(async () => {
    try {
      const res = await api.get("/expenses/by-category", { params: { month, center: id } });
      const { ok, data } = res.data;
      if (ok) setExpenseByCategory(data || []);
    } catch (error) {
      errorMsg(error.message);
    }
  }, [id, month]);

  const fetchTeacherSalary = useCallback(async () => {
    try {
      const res = await api.get("/salaries/summary", { params: { month, center: id } });
      const { ok, data } = res.data;
      if (!ok) return;
      const teachers = (data || []).filter((row) => row.staff.role === "teacher");
      setTeacherSalary({
        total: teachers.reduce((sum, row) => sum + row.final, 0),
        count: teachers.length,
      });
    } catch (error) {
      errorMsg(error.message);
    }
  }, [id, month]);

  useEffect(() => {
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [fetchStats]);

  useEffect(() => {
    const t = setTimeout(fetchExpenseByCategory, 0);
    return () => clearTimeout(t);
  }, [fetchExpenseByCategory]);

  useEffect(() => {
    const t = setTimeout(fetchTeacherSalary, 0);
    return () => clearTimeout(t);
  }, [fetchTeacherSalary]);

  useEffect(() => {
    (async () => {
      try {
        const [roomsRes, subjectsRes] = await Promise.all([
          api.get("/rooms", { params: { page: 1, center: id } }),
          api.get("/subjects", { params: { page: 1, center: id } }),
        ]);
        if (roomsRes.data.ok) setRoomsCount(roomsRes.data.meta?.total ?? roomsRes.data.data?.length ?? 0);
        if (subjectsRes.data.ok)
          setSubjectsCount(subjectsRes.data.meta?.total ?? subjectsRes.data.data?.length ?? 0);
      } catch {
        // faqat kichik hisoblagichlar, xato bo'lsa jim o'tkazamiz
      }
    })();
  }, [id]);

  // Real vaqtda — to'lov/xarajat/davomat/oylik o'zgarsa markaz statistikasi
  // qayta yuklanadi, refresh talab qilinmaydi.
  useSocketEvent("payment:created", fetchStats);
  useSocketEvent("payment:updated", fetchStats);
  useSocketEvent("expense:created", fetchStats);
  useSocketEvent("expense:updated", fetchStats);
  useSocketEvent("attendance:marked", fetchStats);
  useSocketEvent("expense:created", fetchExpenseByCategory);
  useSocketEvent("expense:updated", fetchExpenseByCategory);
  useSocketEvent("center:statusChanged", ({ blocked = [], active = [] } = {}) => {
    const changed = [...blocked, ...active].map(String);
    if (changed.includes(String(id))) fetchCenter();
  });
  useSocketEvent("salary:updated", fetchTeacherSalary);
  useSocketEvent("payment:created", fetchTeacherSalary);
  useSocketEvent("payment:updated", fetchTeacherSalary);

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/centers/${id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      navigate("/centers");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loading height="40vh" />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiBuildingOffice2 className="text-4xl" />
        <p className="text-sm">{t("center.notFound")}</p>
        <Button variant="outlined" onClick={() => navigate("/centers")}>
          {t("center.backToList")}
        </Button>
      </div>
    );
  }

  if (!center) return null;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>

        {/* Bloklangan filial (tarif pasaygan) — Read-Only: tahrirlash
            amallari ko'rsatilmaydi, backend ham `center.blocked` qaytaradi. */}
        {center.status !== "blocked" && (
        <div className="flex items-center gap-2">
          <IconButton
            variant="ghost"
            color="black"
            title={t("settings.centerSectionTitle")}
            onClick={() => setSettingsOpen(true)}
          >
            <HiCog6Tooth />
          </IconButton>
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
          <IconButton variant="ghost" color="red" onClick={() => setDeleteTarget(true)}>
            <HiTrash />
          </IconButton>
        </div>
        )}
      </div>

      {center.status === "blocked" && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <HiLockClosed className="text-lg text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-sm font-semibold text-amber-900">{t("center.readOnlyTitle")}</p>
            <p className="text-xs text-amber-800">{t("center.blockedHint")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={
            center.logo ? (
              <LazyImage
                src={center.logo.startsWith("http") ? center.logo : `${API}${center.logo}`}
                className="w-11 h-11 rounded-xl object-cover"
              />
            ) : (
              <HiBuildingOffice2 />
            )
          }
          title={center.name}
          subtitle={center.slogan || t("center.title")}
          accent="blue"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100">
            {center.date && <InfoMeta icon={<HiCalendar />}>{center.date}</InfoMeta>}
            <InfoMeta icon={<HiHome />}>
              {roomsCount} {t("center.roomsCount").toLowerCase()}
            </InfoMeta>
            <InfoMeta icon={<HiRectangleGroup />}>
              {subjectsCount} {t("center.subjectsCount").toLowerCase()}
            </InfoMeta>
          </div>
        </InfoCard>

        <MetricCard
          icon={<HiUsers />}
          title={t("dashboard.activeStudents")}
          subtitle={t("center.studentsGroupsCardDesc")}
          value={statsLoading ? "…" : (stats?.activeStudents ?? 0)}
          accent="indigo"
        >
          <p className="text-xs text-slate-400">
            {statsLoading
              ? "…"
              : `${stats?.activeGroups ?? 0} ${t("group.statusActive").toLowerCase()} · ${
                  stats?.pendingGroups ?? 0
                } ${t("group.statusPending").toLowerCase()}`}
          </p>
        </MetricCard>

        <MetricCard
          icon={<HiUserGroup />}
          title={t("dashboard.staffCount")}
          subtitle={t("center.staffCardDesc")}
          value={statsLoading ? "…" : (stats?.staffCount ?? 0)}
          accent="violet"
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-slate-800">{t("center.statsTitle")}</p>
        <MonthInput
          className="w-44"
          value={month}
          onChange={(m) => setMonth(m || currentMonth())}
          max={currentMonth()}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          icon={<HiBanknotes />}
          title={t("dashboard.monthRevenue")}
          subtitle={t("center.revenueCardDesc")}
          value={statsLoading ? "…" : maskMoney(stats?.monthRevenue, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          accent="emerald"
        />

        <MetricCard
          icon={<HiBanknotes />}
          title={t("dashboard.monthExpenses")}
          subtitle={t("center.expenseCardDesc")}
          value={statsLoading ? "…" : maskMoney(stats?.monthExpenses, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          accent="red"
        />

        <MetricCard
          icon={<HiBanknotes />}
          title={t("center.teacherSalaryCardTitle")}
          subtitle={t("center.teacherSalaryCardDesc")}
          value={maskMoney(teacherSalary.total, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          accent="amber"
        >
          <p className="text-xs text-slate-400">
            {t("center.teacherSalaryCount", { count: teacherSalary.count })}
          </p>
        </MetricCard>
      </div>

      {statsLoading || !stats ? (
        <Loading height="20vh" />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
            <div className="lg:col-span-1">
              {hideFinance ? (
                <HiddenFinancePanel />
              ) : (
                <PaymentDonut
                  paid={stats.currentCyclePaid || 0}
                  debt={stats.currentCycleDebt || 0}
                />
              )}
            </div>
            <div className="lg:col-span-2">
              {hideFinance ? (
                <HiddenFinancePanel />
              ) : (
                <RevenueChart payments={stats.chartPayments} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
            <div className="lg:col-span-1">
              {hideFinance ? <HiddenFinancePanel /> : <ExpenseCategoryDonut data={expenseByCategory} />}
            </div>
            <div className="lg:col-span-2 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800 text-sm">
                {t("dashboard.recentPayments")}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto max-h-72">
                {stats.recentPayments.length === 0 ? (
                  <div className="flex items-center justify-center w-full h-24 text-slate-400 text-sm">
                    {t("dashboard.noPayments")}
                  </div>
                ) : (
                  <table className="w-full text-sm min-w-max">
                    <tbody>
                      {stats.recentPayments.map((p, i) => (
                        <tr key={i} className="border-t border-slate-100 first:border-t-0">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar user={{ _id: p.student._id, name: p.student.fullName, avatar: p.student.photo }} size={30} />
                              <span className="font-semibold text-slate-800">{p.student.fullName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <NumberText className="text-emerald-600">
                              {maskMoney(p.amount, hideFinance)}
                            </NumberText>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                            {p.date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <CenterSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} centerId={id} />

      <CenterDialog
        key={dialogKey}
        open={dialogOpen}
        center={center}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchCenter}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(false)}
        title={t("center.delete")}
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
        <p>{t("center.deleteConfirm", { name: center?.name })}</p>
      </Dialog>
    </div>
  );
}

export default CenterDetail;
