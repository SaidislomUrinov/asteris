import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiArrowTrendingDown,
  HiBanknotes,
  HiChartPie,
  HiExclamationTriangle,
  HiHome,
  HiRectangleGroup,
  HiUserGroup,
  HiUsers,
  HiWallet,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import MonthInput from "../../ui/MonthInput";
import Loading from "../../ui/Loading";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import ExpenseCategoryDonut from "../Centers/ExpenseCategoryDonut";
import TodayLessonsScroll from "./TodayLessonsScroll";
import RevenueByCollector from "./RevenueByCollector";
import LeadDonut from "./LeadDonut";
import LeadsBySubject from "./LeadsBySubject";
import useCan from "../../hooks/useCan";
import MoneyCard from "../../components/dashboard/MoneyCard";
import StatCard from "../../components/dashboard/StatCard";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import HideFinanceToggle from "../../components/HideFinanceToggle";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";
import useHideFinance from "../../hooks/useHideFinance";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Dashboard() {
  const { t } = useTranslation();
  // "Tushumlar" kartochkasi faqat Client Owner uchun — backend ham
  // `requireOwner` bilan yopilgan, staff'da so'rov umuman yuborilmaydi.
  const authType = useSelector((e) => e.user.authType);
  const [month, setMonth] = useState(currentMonth());
  const [filterCenter, setFilterCenter] = useState("");
  const [centers, setCenters] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [teacherSalary, setTeacherSalary] = useState({ total: 0, count: 0 });
  const [roomsCount, setRoomsCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  // Moliyaviy raqamlarni vaqtincha yashirish — resepshin oldida odam
  // o'tirgan yoki noutbuk HDMI orqali proyektorga ulangan holatlar uchun.
  const [hideFinance, toggleHideFinance] = useHideFinance();
  const can = useCan();
  const canLeads = can("lead:view");
  const [leadStats, setLeadStats] = useState(null);
  const [subjectNames, setSubjectNames] = useState({});

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/dashboard", { params: { month, center: filterCenter } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(data);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [month, filterCenter]);

  const fetchExpenseByCategory = useCallback(async () => {
    try {
      const res = await api.get("/expenses/by-category", { params: { month, center: filterCenter } });
      const { ok, data } = res.data;
      if (ok) setExpenseByCategory(data || []);
    } catch (error) {
      errorMsg(error.message);
    }
  }, [month, filterCenter]);

  const fetchTeacherSalary = useCallback(async () => {
    try {
      const res = await api.get("/salaries/summary", { params: { month, center: filterCenter } });
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
  }, [month, filterCenter]);

  // Oylik lid statistikasi — yuqoridagi oy/filial tanlovi bilan birga o'zgaradi.
  const fetchLeadStats = useCallback(async () => {
    if (!canLeads) return;
    try {
      const [statsRes, subjectsRes] = await Promise.all([
        api.get("/student-leads/stats", { params: { month, center: filterCenter } }),
        api.get("/subjects", { params: { page: 1 } }),
      ]);
      if (statsRes.data.ok) setLeadStats(statsRes.data.data);
      if (subjectsRes.data.ok) {
        setSubjectNames(Object.fromEntries((subjectsRes.data.data || []).map((s) => [s._id, s.name])));
      }
    } catch (error) {
      errorMsg(error.message);
    }
  }, [month, filterCenter, canLeads]);

  useSocketEvent("lead:changed", () => fetchLeadStats(), canLeads);

  useEffect(() => {
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [fetchStats]);

  useEffect(() => {
    const id = setTimeout(fetchLeadStats, 0);
    return () => clearTimeout(id);
  }, [fetchLeadStats]);

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
        const res = await api.get("/centers", { params: { page: 1 } });
        if (res.data.ok) setCenters(res.data.data || []);
      } catch {
        // markazlar faqat filtr uchun
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const params = { page: 1, ...(filterCenter ? { center: filterCenter } : {}) };
        const [roomsRes, subjectsRes] = await Promise.all([
          api.get("/rooms", { params }),
          api.get("/subjects", { params }),
        ]);
        if (roomsRes.data.ok) setRoomsCount(roomsRes.data.meta?.total ?? roomsRes.data.data?.length ?? 0);
        if (subjectsRes.data.ok)
          setSubjectsCount(subjectsRes.data.meta?.total ?? subjectsRes.data.data?.length ?? 0);
      } catch {
        // faqat kichik hisoblagichlar, xato bo'lsa jim o'tkazamiz
      }
    })();
  }, [filterCenter]);

  // Realtime — to'lov/davomat/xarajat/oylik o'zgarsa dashboard qayta yuklanadi.
  // Debounce SHART: `attendance:marked` har QR skanida keladi va ertalabki
  // oqimda bu og'ir `/dashboard` so'rovini daqiqada yuzlab marta qo'zg'atardi
  // (API_CONTRACT_performance.md §4). 3 soniya foydalanuvchiga sezilmaydi,
  // lekin ketma-ket skanlarni bitta so'rovga yig'adi.
  const reloadStats = useDebouncedCallback(fetchStats, 3000);
  const reloadExpenses = useDebouncedCallback(fetchExpenseByCategory, 3000);
  const reloadSalary = useDebouncedCallback(fetchTeacherSalary, 3000);

  useSocketEvent("payment:created", reloadStats);
  useSocketEvent("payment:cancelled", reloadStats);
  useSocketEvent("payment:updated", reloadStats);
  useSocketEvent("expense:created", reloadStats);
  useSocketEvent("expense:updated", reloadStats);
  useSocketEvent("attendance:marked", reloadStats);
  // Arxivlash/qaytarish va guruhdan chiqish qarzdorlik/o'quvchi sonini
  // o'zgartiradi — server keshi shu hodisalarda bekor qilinadi
  // (emitter.util.js CACHE_BUSTING), Dashboard ham shu yerda qayta so'raydi.
  useSocketEvent("archive:changed", reloadStats);
  useSocketEvent("student:leftGroup", reloadStats);
  useSocketEvent("expense:created", reloadExpenses);
  useSocketEvent("expense:updated", reloadExpenses);
  useSocketEvent("salary:updated", reloadSalary);
  useSocketEvent("payment:created", reloadSalary);
  useSocketEvent("payment:updated", reloadSalary);

  if (loading && !data) return <Loading height="60vh" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiChartPie className="text-4xl" />
        <p className="text-sm">{t("dashboard.loadError")}</p>
        <Button variant="outlined" onClick={fetchStats}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <DashboardHeader
        icon={<HiChartPie />}
        title={t("dashboard.title")}
        toggle={<HideFinanceToggle hidden={hideFinance} onToggle={toggleHideFinance} />}
      >
        <MonthInput
          className="w-full sm:w-44"
          value={month}
          onChange={(m) => setMonth(m || currentMonth())}
          max={currentMonth()}
        />
        {centers.length > 1 && (
          <Select
            className="w-full sm:w-56"
            placeholder={t("dashboard.center")}
            variant="white"
            value={filterCenter}
            onChange={setFilterCenter}
            options={[
              { value: "", label: t("common.all") },
              ...centers.map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
        )}
      </DashboardHeader>

      {/* MOLIYA — sahifadagi eng muhim raqamlar. Ko'z tugmasi bosilganda
          har bir son ANIQ "****" bilan almashadi (blur emas — blur bilan
          asl piksel DOM'da qolib, ba'zi holatda o'qilishi mumkin edi).
          Resepshin oldida odam o'tirgani yoki noutbuk HDMI orqali
          proyektorga ulanganida shu tugma bilan darhol yashiriladi. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MoneyCard
          icon={<HiBanknotes />}
          label={t("dashboard.monthRevenue")}
          value={maskMoney(data.monthRevenue, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          gradient="from-emerald-500 to-teal-600"
          shadow="shadow-emerald-500/20"
        />
        <MoneyCard
          icon={<HiArrowTrendingDown />}
          label={t("dashboard.monthExpenses")}
          value={maskMoney(data.monthExpenses, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          gradient="from-rose-500 to-red-600"
          shadow="shadow-rose-500/20"
        />
        <MoneyCard
          icon={<HiWallet />}
          label={t("center.teacherSalaryCardTitle")}
          value={maskMoney(teacherSalary.total, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          hint={t("dashboard.teacherSalaryHint", { count: teacherSalary.count })}
          gradient="from-violet-500 to-indigo-600"
          shadow="shadow-violet-500/20"
        />
        <MoneyCard
          icon={<HiExclamationTriangle />}
          label={t("student.debt")}
          value={maskMoney(data.currentCycleDebt, hideFinance)}
          suffix={hideFinance ? "" : t("student.somSuffix")}
          hint={t("dashboard.debtHint")}
          gradient="from-amber-500 to-orange-600"
          shadow="shadow-amber-500/20"
        />
      </div>

      {/* Ixcham hisoblagichlar */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        <StatCard
          icon={<HiUsers />}
          label={t("dashboard.activeStudents")}
          value={data.activeStudents}
          color="bg-cyan-50 text-cyan-500"
        />
        <StatCard
          icon={<HiUserGroup />}
          label={t("dashboard.activeGroups")}
          value={data.activeGroups}
          color="bg-pink-50 text-pink-500"
        />
        <StatCard
          icon={<HiUserGroup />}
          label={t("dashboard.pendingGroups")}
          value={data.pendingGroups}
          color="bg-slate-100 text-slate-500"
        />
        <StatCard
          icon={<HiUsers />}
          label={t("dashboard.staffCount")}
          value={data.staffCount}
          color="bg-violet-50 text-violet-500"
        />
        <StatCard
          icon={<HiHome />}
          label={t("room.title")}
          value={roomsCount}
          color="bg-orange-50 text-orange-500"
        />
        <StatCard
          icon={<HiRectangleGroup />}
          label={t("subject.title")}
          value={subjectsCount}
          color="bg-blue-50 text-blue-500"
        />
      </div>

      {/* Analitika qatorlari SOBIT balandlikda (lg+). Aks holda yonidagi
          kartochka (masalan kassirlar ro'yxati) uzayganda grid qatori
          o'sib, donut ham keraksiz cho'zilib ketardi — ro'yxat endi
          kartochka ichida scroll bo'ladi. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch lg:h-88">
        <div className="lg:col-span-1 min-h-0">
          {hideFinance ? (
            <HiddenFinancePanel />
          ) : (
            <PaymentDonut paid={data.currentCyclePaid || 0} debt={data.currentCycleDebt || 0} />
          )}
        </div>
        <div className="lg:col-span-2 min-h-0">
          {hideFinance ? <HiddenFinancePanel /> : <RevenueChart payments={data.chartPayments} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch lg:h-88">
        <div className="lg:col-span-1 min-h-0">
          {hideFinance ? <HiddenFinancePanel /> : <ExpenseCategoryDonut data={expenseByCategory} />}
        </div>

        {/* Owner'da yonida "kim qancha yig'gani", staff'da esa (kartochka
            ko'rinmagani uchun) o'rnini bugungi darslar egallaydi — bo'sh
            ustun qolmasligi kerak. Bugungi darslar pul emas, yashirilmaydi. */}
        <div className="lg:col-span-2 min-h-0">
          {authType === "owner" ? (
            hideFinance ? (
              <HiddenFinancePanel />
            ) : (
              <RevenueByCollector month={month} center={filterCenter} />
            )
          ) : (
            <TodayLessonsScroll center={filterCenter} />
          )}
        </div>
      </div>

      {canLeads && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch lg:h-88">
          <div className="lg:col-span-1 min-h-0">
            <LeadDonut stats={leadStats} />
          </div>
          <div className="lg:col-span-2 min-h-0">
            <LeadsBySubject rows={leadStats?.bySubject || []} subjectNames={subjectNames} />
          </div>
        </div>
      )}

      {authType === "owner" && (
        <div className="shrink-0">
          <TodayLessonsScroll center={filterCenter} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
