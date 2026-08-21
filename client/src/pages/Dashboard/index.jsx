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
import NumberText from "../../ui/NumberText";
import Loading from "../../ui/Loading";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import ExpenseCategoryDonut from "../Centers/ExpenseCategoryDonut";
import TodayLessonsScroll from "./TodayLessonsScroll";
import RevenueByCollector from "./RevenueByCollector";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Moliyaviy ko'rsatkichlar — sahifadagi ENG muhim raqamlar, shuning uchun
// katta, rangli (gradient) kartalarda. `NumberText`da `text-black` qat'iy
// yozilgani uchun oq rang `!` bilan bekor qilinadi.
function MoneyCard({ icon, label, value, suffix, hint, gradient, shadow }) {
  return (
    <div
      className={`relative overflow-hidden flex flex-col justify-between gap-4 p-5 rounded-2xl text-white bg-gradient-to-br ${gradient} shadow-lg ${shadow}`}
    >
      {/* Fon dekoratsiyasi — ikonka suvbelgi sifatida */}
      <span className="absolute -right-5 -bottom-6 text-[6.5rem] leading-none text-white/[0.07] pointer-events-none">
        {icon}
      </span>

      <div className="relative flex items-center gap-2">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-white/20 text-lg">
          {icon}
        </span>
        <span className="text-sm font-medium text-white/90">{label}</span>
      </div>

      <div className="relative flex flex-col gap-0.5 min-w-0">
        <span className="flex items-baseline gap-1.5 min-w-0">
          <NumberText className="!text-white !text-2xl sm:!text-3xl 2xl:!text-[2rem] font-bold leading-none truncate">
            {value}
          </NumberText>
          {suffix && <span className="text-sm text-white/70 shrink-0">{suffix}</span>}
        </span>
        {hint && <span className="text-xs text-white/70 truncate">{hint}</span>}
      </div>
    </div>
  );
}

// Ikkilamchi hisoblagichlar — ixcham oq kartalar, moliyaviy bloklardan
// aniq past darajada turadi.
function StatCard({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300">
      <div className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-xl ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <NumberText className="text-lg leading-none">{value}</NumberText>
        <span className="text-xs text-slate-400 truncate">{label}</span>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchExpenseByCategory();
  }, [fetchExpenseByCategory]);

  useEffect(() => {
    fetchTeacherSalary();
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
  useSocketEvent("expense:created", reloadStats);
  useSocketEvent("expense:updated", reloadStats);
  useSocketEvent("attendance:marked", reloadStats);
  useSocketEvent("expense:created", reloadExpenses);
  useSocketEvent("expense:updated", reloadExpenses);
  useSocketEvent("salary:updated", reloadSalary);
  useSocketEvent("payment:created", reloadSalary);

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
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-amber-50 text-amber-500 text-lg">
            <HiChartPie />
          </span>
          <span className="text-lg font-space font-bold text-slate-900">
            {t("dashboard.title")}
          </span>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
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
      </div>

      {/* MOLIYA — sahifadagi eng muhim raqamlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MoneyCard
          icon={<HiBanknotes />}
          label={t("dashboard.monthRevenue")}
          value={money(data.monthRevenue)}
          suffix={t("student.somSuffix")}
          gradient="from-emerald-500 to-teal-600"
          shadow="shadow-emerald-500/20"
        />
        <MoneyCard
          icon={<HiArrowTrendingDown />}
          label={t("dashboard.monthExpenses")}
          value={money(data.monthExpenses)}
          suffix={t("student.somSuffix")}
          gradient="from-rose-500 to-red-600"
          shadow="shadow-rose-500/20"
        />
        <MoneyCard
          icon={<HiWallet />}
          label={t("center.teacherSalaryCardTitle")}
          value={money(teacherSalary.total)}
          suffix={t("student.somSuffix")}
          hint={t("dashboard.teacherSalaryHint", { count: teacherSalary.count })}
          gradient="from-violet-500 to-indigo-600"
          shadow="shadow-violet-500/20"
        />
        <MoneyCard
          icon={<HiExclamationTriangle />}
          label={t("student.debt")}
          value={money(data.currentCycleDebt)}
          suffix={t("student.somSuffix")}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <div className="lg:col-span-1">
          <PaymentDonut
            paid={data.currentCyclePaid || 0}
            debt={data.currentCycleDebt || 0}
          />
        </div>
        <div className="lg:col-span-2">
          <RevenueChart payments={data.chartPayments} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <div className="lg:col-span-1">
          <ExpenseCategoryDonut data={expenseByCategory} />
        </div>

        {/* Owner'da yonida "kim qancha yig'gani", staff'da esa (kartochka
            ko'rinmagani uchun) o'rnini bugungi darslar egallaydi — bo'sh
            ustun qolmasligi kerak. */}
        <div className="lg:col-span-2">
          {authType === "owner" ? (
            <RevenueByCollector month={month} center={filterCenter} />
          ) : (
            <TodayLessonsScroll center={filterCenter} />
          )}
        </div>
      </div>

      {authType === "owner" && <TodayLessonsScroll center={filterCenter} />}
    </div>
  );
}

export default Dashboard;
