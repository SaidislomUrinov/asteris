import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiArchiveBox,
  HiArrowTrendingDown,
  HiBanknotes,
  HiBuildingOffice2,
  HiChartPie,
  HiCog6Tooth,
  HiExclamationTriangle,
  HiHome,
  HiPencil,
  HiRectangleGroup,
  HiUserGroup,
  HiUsers,
  HiWallet,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import LazyImage from "../../ui/LazyImage";
import MonthInput from "../../ui/MonthInput";
import Loading from "../../ui/Loading";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import ExpenseCategoryDonut from "../../components/center/ExpenseCategoryDonut";
import CenterDialog from "../../components/center/CenterDialog";
import CenterSettingsDialog from "../../components/center/CenterSettingsDialog";
import RecentPayments from "./RecentPayments";
import TodayLessonsScroll from "./TodayLessonsScroll";
import RevenueByCollector from "./RevenueByCollector";
import LeadDonut from "./LeadDonut";
import LeadsBySubject from "./LeadsBySubject";
import useCan from "../../hooks/useCan";
import MoneyCard from "../../components/dashboard/MoneyCard";
import StatCard from "../../components/dashboard/StatCard";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";
import useHideFinance from "../../hooks/useHideFinance";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { api, API, notifyCentersChanged, setActiveCenter } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import switchCenter from "../../utils/switchCenter";
import { maskMoney } from "../../utils/moneyFormat";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Dashboard() {
  const { t } = useTranslation();
  // "Tushumlar" kartochkasi faqat Client Owner uchun — backend ham
  // `requireOwner` bilan yopilgan, staff'da so'rov umuman yuborilmaydi.
  const { authType, centers = [], activeCenter } = useSelector((e) => e.user);
  const isOwner = authType === "owner";
  const [month, setMonth] = useState(currentMonth());
  // Dashboard = FAOL filial statistikasi (docs/API_CONTRACT_multi_center.md §5) —
  // so'rovlarda `center` berilmaydi, backend faol filialni o'zi qo'llaydi.
  // Alohida filial sahifasi yo'q: filial ma'lumoti va amallari shu sarlavhada.
  const centerList = Array.isArray(centers) ? centers : [];
  const activeInfo = centerList.find((c) => c._id === activeCenter) || centerList[0] || null;
  const [center, setCenter] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [teacherSalary, setTeacherSalary] = useState({ total: 0, count: 0 });
  const [roomsCount, setRoomsCount] = useState(0);
  const [subjectsCount, setSubjectsCount] = useState(0);
  // Moliyaviy raqamlarni vaqtincha yashirish — resepshin oldida odam
  // o'tirgan yoki noutbuk HDMI orqali proyektorga ulangan holatlar uchun.
  const [hideFinance] = useHideFinance();
  const can = useCan();
  const canLeads = can("lead:view");
  const [leadStats, setLeadStats] = useState(null);
  const [subjectNames, setSubjectNames] = useState({});

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/dashboard", { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(data);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  const fetchExpenseByCategory = useCallback(async () => {
    try {
      const res = await api.get("/expenses/by-category", { params: { month } });
      const { ok, data } = res.data;
      if (ok) setExpenseByCategory(data || []);
    } catch (error) {
      errorMsg(error.message);
    }
  }, [month]);

  const fetchTeacherSalary = useCallback(async () => {
    try {
      const res = await api.get("/salaries/summary", { params: { month } });
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
  }, [month]);

  // Oylik lid statistikasi — yuqoridagi oy/filial tanlovi bilan birga o'zgaradi.
  const fetchLeadStats = useCallback(async () => {
    if (!canLeads) return;
    try {
      const [statsRes, subjectsRes] = await Promise.all([
        api.get("/student-leads/stats", { params: { month } }),
        api.get("/subjects", { params: { page: 1 } }),
      ]);
      if (statsRes.data.ok) setLeadStats(statsRes.data.data);
      if (subjectsRes.data.ok) {
        setSubjectNames(Object.fromEntries((subjectsRes.data.data || []).map((s) => [s._id, s.name])));
      }
    } catch (error) {
      errorMsg(error.message);
    }
  }, [month, canLeads]);

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

  // Faol filialning to'liq ma'lumoti (shior, sana) — nom/logo Redux'da bor,
  // qolgani shu so'rovdan. Xato bo'lsa sarlavha Redux'dagi bilan qoladi.
  const activeId = activeInfo?._id;
  const fetchCenter = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await api.get(`/centers/${activeId}`);
      if (res.data.ok) setCenter(res.data.data);
    } catch {
      // sarlavha Redux'dagi nom bilan ko'rinadi
    }
  }, [activeId]);

  useEffect(() => {
    const id = setTimeout(fetchCenter, 0);
    return () => clearTimeout(id);
  }, [fetchCenter]);

  // Arxivlangach boshqa ishlaydigan filialga o'tiladi; qolmasa — filialsiz holat.
  const confirmArchive = async () => {
    if (!activeId) return;
    try {
      setArchiving(true);
      const res = await api.delete(`/centers/${activeId}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      const next = centerList.find((c) => c._id !== activeId && c.status !== "blocked");
      if (next) {
        switchCenter(next._id);
      } else {
        setActiveCenter("");
        window.location.replace("/dashboard");
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const params = { page: 1 };
        // Ruxsat bo'lmasa API chaqirilmaydi (CLAUDE.md).
        const skip = Promise.resolve({ data: { ok: false } });
        const [roomsRes, subjectsRes] = await Promise.all([
          can("room:view") ? api.get("/rooms", { params }) : skip,
          can("subject:view") ? api.get("/subjects", { params }) : skip,
        ]);
        if (roomsRes.data.ok) setRoomsCount(roomsRes.data.meta?.total ?? roomsRes.data.data?.length ?? 0);
        if (subjectsRes.data.ok) setSubjectsCount(subjectsRes.data.meta?.total ?? subjectsRes.data.data?.length ?? 0);
      } catch {
        // faqat kichik hisoblagichlar, xato bo'lsa jim o'tkazamiz
      }
    })();
  }, [can]);

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
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
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
        leading={<CenterLogo logo={center?.logo ?? activeInfo?.logo} />}
        title={center?.name || activeInfo?.name || t("dashboard.title")}
        subtitle={center?.slogan || (activeInfo ? t("dashboard.title") : undefined)}
      >
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none sm:w-44 min-w-0">
            <MonthInput
              className="w-full"
              value={month}
              onChange={(m) => setMonth(m || currentMonth())}
              max={currentMonth()}
            />
          </div>
          {/* Filial amallari — faqat Owner (Center CRUD hodim ruxsati emas).
            Bloklangan filial Read-Only: amallar ko'rinmaydi. */}
          {isOwner && activeInfo && activeInfo.status !== "blocked" && (
            <div className="flex items-center gap-1">
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
                title={t("center.edit")}
                onClick={() => {
                  setEditKey((k) => k + 1);
                  setEditOpen(true);
                }}
              >
                <HiPencil />
              </IconButton>
              <IconButton variant="ghost" color="red" title={t("center.archive")} onClick={() => setArchiveOpen(true)}>
                <HiArchiveBox />
              </IconButton>
            </div>
          )}
        </div>
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
          hint={t("dashboard.teacherSalaryHint", {
            count: teacherSalary.count,
          })}
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
          color="bg-cyan-50 dark:bg-cyan-500/15 text-cyan-500"
        />
        <StatCard
          icon={<HiUserGroup />}
          label={t("dashboard.activeGroups")}
          value={data.activeGroups}
          color="bg-pink-50 dark:bg-pink-500/15 text-pink-500"
        />
        <StatCard
          icon={<HiUserGroup />}
          label={t("dashboard.pendingGroups")}
          value={data.pendingGroups}
          color="bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400"
        />
        <StatCard
          icon={<HiUsers />}
          label={t("dashboard.staffCount")}
          value={data.staffCount}
          color="bg-violet-50 dark:bg-violet-500/15 text-violet-500"
        />
        <StatCard
          icon={<HiHome />}
          label={t("room.title")}
          value={roomsCount}
          color="bg-orange-50 dark:bg-orange-500/15 text-orange-500"
        />
        <StatCard
          icon={<HiRectangleGroup />}
          label={t("subject.title")}
          value={subjectsCount}
          color="bg-blue-50 dark:bg-blue-500/15 text-blue-500"
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
              <RevenueByCollector month={month} />
            )
          ) : (
            <TodayLessonsScroll />
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

      {/* Oxirgi to'lovlar (avvalgi filial sahifasidan) — Owner'da bugungi
          darslar yonida, hodimda (darslar yuqorida) yolg'iz. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch lg:h-72">
        <div className={`min-h-0 ${isOwner ? "lg:col-span-1" : "lg:col-span-3"}`}>
          {/* Ismlar ko'rinadi, summalar ko'z tugmasi bilan "****" bo'ladi. */}
          <RecentPayments payments={data.recentPayments || []} hideFinance={hideFinance} />
        </div>
        {isOwner && (
          <div className="lg:col-span-2 min-h-0">
            <TodayLessonsScroll />
          </div>
        )}
      </div>

      {isOwner && activeInfo && (
        <>
          <CenterSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} centerId={activeInfo._id} />
          <CenterDialog
            key={editKey}
            open={editOpen}
            center={center || activeInfo}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              fetchCenter();
              // Top'dagi filial nomi/logosi (Redux) ham yangilansin.
              notifyCentersChanged();
            }}
          />
          <Dialog
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
            title={t("center.archive")}
            actions={
              <>
                <Button color="black" variant="text" onClick={() => setArchiveOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button color="red" loading={archiving} onClick={confirmArchive}>
                  {t("center.archive")}
                </Button>
              </>
            }
          >
            <p>{t("center.archiveConfirm", { name: activeInfo.name })}</p>
          </Dialog>
        </>
      )}
    </div>
  );
}

// Sarlavhadagi filial logosi — yo'q bo'lsa bino ikonkasi.
function CenterLogo({ logo }) {
  if (logo) {
    return (
      <LazyImage
        src={logo.startsWith("http") ? logo : `${API}${logo}`}
        className="w-10 h-10 shrink-0 rounded-xl object-cover bg-slate-100 dark:bg-night-800"
      />
    );
  }
  return (
    <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-500 text-lg">
      <HiBuildingOffice2 />
    </span>
  );
}

export default Dashboard;
