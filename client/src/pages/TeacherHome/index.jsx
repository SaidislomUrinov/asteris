import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiArrowPath,
  HiBanknotes,
  HiCalendarDays,
  HiExclamationTriangle,
  HiHome,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import MoneyCard from "../../components/dashboard/MoneyCard";
import StatCard from "../../components/dashboard/StatCard";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import HideFinanceToggle from "../../components/HideFinanceToggle";
import useHideFinance from "../../hooks/useHideFinance";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import TodayLessons from "./TodayLessons";
import MyGroups from "./MyGroups";
import SalaryPanel from "./SalaryPanel";
import TransactionsCard from "./TransactionsCard";
import DashboardSkeleton from "./DashboardSkeleton";
import { lessonState, nowMinutes } from "./lessonTime";

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * O'qituvchi paneli bosh sahifasi — "teacher workspace".
 *
 * Barcha ma'lumot BITTA so'rovda keladi (`GET /teacher/dashboard`) —
 * guruhlar, xonalar, o'quvchilar soni, bugungi darslar va tanlangan oy oyligi.
 *
 * Dizayn (2026-09-26 qayta qurildi): ixcham sarlavha → 5 ta alohida KPI
 * karta → ikki ustun: chapda asosiy ish (bugungi darslar, guruhlarim,
 * tranzaksiyalar + bot havolasi bitta kartada), o'ngda oylik paneli. Mobilda bitta ustun, xuddi
 * shu tartibda. Birinchi yuklanishda skeleton; socket yangilanishlari va oy
 * almashishi sahifani skeleton'ga qaytarmaydi (faqat oylik paneli yuklanadi).
 */
function TeacherHome() {
  const { t } = useTranslation();
  const user = useSelector((e) => e.user);
  // Yordamchi o'qituvchi ham shu panelni ko'radi — matnlar rolga moslanadi.
  const isAssistant = user.role === "assistant";

  const [hideFinance, toggleHideFinance] = useHideFinance();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Dars holati (bo'lyapti/tugagan) vaqt o'tishi bilan o'zi yangilanishi uchun.
  const [mins, setMins] = useState(() => nowMinutes());

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/teacher/dashboard", { params: { month } });
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const id = setTimeout(fetchDashboard, 0);
    return () => clearTimeout(id);
  }, [fetchDashboard]);

  useEffect(() => {
    const id = setInterval(() => setMins(nowMinutes()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Realtime sinxronlar ────────────────────────────────────────────
  useSocketEvent("payment:created", fetchDashboard);
  useSocketEvent("payment:cancelled", fetchDashboard);
  useSocketEvent("payment:updated", fetchDashboard);
  useSocketEvent("salary:updated", fetchDashboard);

  const mine = useCallback(
    (payload) =>
      String(payload?.teacher || "") === String(user._id) ||
      String(payload?.assistant || "") === String(user._id),
    [user._id],
  );

  useSocketEvent("group:changed", (payload) => {
    if (payload?.action === "telegram") return; // bu sahifada havola ko'rsatilmaydi
    const known = (data?.groups || []).some((g) => g._id === payload?.groupId);
    if (mine(payload) || known) fetchDashboard();
  });

  useSocketEvent("student:enrolled", (payload) => {
    if ((data?.groups || []).some((g) => g._id === payload?.groupId)) fetchDashboard();
  });
  useSocketEvent("student:leftGroup", (payload) => {
    if ((data?.groups || []).some((g) => g._id === payload?.groupId)) fetchDashboard();
  });

  const stats = data?.stats;
  const salary = data?.salary;
  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = `${monthNames[monthOf(month)]} ${yearOf(month)}`;

  const today = new Date();
  const todayLabel = `${today.getDate()}-${monthNames[today.getMonth()].toLowerCase()}, ${t(
    `group.day.${JS_DAY_TO_CODE[today.getDay()]}`,
  )}`;

  // "Bugungi darslar" kartasi ostidagi jonli holat: hozir dars bormi,
  // keyingisi qachon yoki hammasi tugadimi.
  const todayLessons = data?.todayLessons || [];
  const ongoing = todayLessons.find((g) => lessonState(g, mins) === "ongoing");
  const next = todayLessons.find((g) => lessonState(g, mins) === "upcoming");
  const todayHint = !todayLessons.length
    ? t("teacherHome.noLessonsShort")
    : ongoing
      ? t("teacherHome.lessonNow")
      : next
        ? t("teacherHome.nextAt", { time: next.startTime })
        : t("teacherHome.allDone");

  const capacity = (data?.rooms || []).reduce((sum, r) => sum + (r.capacity || 0), 0);

  return (
    <div className="flex flex-col w-full gap-4 pb-3">
      {/* ── Sarlavha ─────────────────────────────────────────────────────── */}
      <DashboardHeader
        leading={<Avatar user={user} size={44} />}
        title={t("teacherHome.greeting", { name: user.name })}
        subtitle={t(isAssistant ? "teacherHome.greetingDescAssistant" : "teacherHome.greetingDesc")}
        toggle={<HideFinanceToggle hidden={hideFinance} onToggle={toggleHideFinance} />}
      >
        <div className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200/70 bg-white text-xs font-medium text-slate-600 capitalize">
          <HiCalendarDays className="text-slate-400" aria-hidden="true" />
          {todayLabel}
        </div>
      </DashboardHeader>

      {!data && loading ? (
        <DashboardSkeleton />
      ) : !data && failed ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 rounded-2xl border border-slate-200/70 bg-white text-center">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-rose-50 text-xl text-rose-500">
            <HiExclamationTriangle aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-slate-700">{t("teacherHome.loadError")}</p>
          <button
            type="button"
            onClick={fetchDashboard}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <HiArrowPath aria-hidden="true" />
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          {/* ── KPI: oylik (gradient) + 4 ta ixcham hisoblagich ───────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <MoneyCard
              icon={<HiBanknotes />}
              label={t("teacherHome.salaryRemaining")}
              value={salary ? maskMoney(salary.final, hideFinance) : "—"}
              suffix={salary && !hideFinance ? t("student.somSuffix") : ""}
              hint={t("teacherHome.forMonth", { month: monthLabel })}
              gradient="from-emerald-500 to-teal-600"
              shadow="shadow-emerald-500/20"
            />
            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              <StatCard
                icon={<HiCalendarDays />}
                color="bg-orange-50 text-orange-500"
                label={t("teacherHome.todayLessons")}
                value={stats?.todayLessons ?? 0}
                hint={todayHint}
              />
              <StatCard
                icon={<HiUserGroup />}
                color="bg-pink-50 text-pink-500"
                label={t("teacherHome.activeGroups")}
                value={stats?.groups ?? 0}
                hint={stats?.pendingGroups ? t("teacherHome.pendingCount", { count: stats.pendingGroups }) : ""}
              />
              <StatCard
                icon={<HiUsers />}
                color="bg-cyan-50 text-cyan-500"
                label={t("teacherHome.myStudents")}
                value={stats?.students ?? 0}
                hint={stats?.groups ? t("teacherHome.inGroups", { count: stats.groups }) : ""}
              />
              <StatCard
                icon={<HiHome />}
                color="bg-violet-50 text-violet-500"
                label={t("teacherHome.myRooms")}
                value={stats?.rooms ?? 0}
                hint={capacity ? t("teacherHome.totalCapacity", { count: capacity }) : ""}
              />
            </div>
          </div>

          {/* ── Asosiy ish (chap) + moliya (o'ng) ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-3 items-start">
            {/* Mobil/planshetda ustun o'ramlari `contents` bo'lib, bo'limlar
                `order` bilan tiziladi: darslar → guruhlar → oylik → tranzaksiyalar
                (tranzaksiyalar oylik panelidagi tanlangan oyga tegishli). */}
            <div className="flex flex-col gap-3 min-w-0 max-lg:contents">
              <div className="order-1 min-w-0">
                <TodayLessons lessons={todayLessons} mins={mins} />
              </div>
              <div className="order-2 min-w-0">
                <MyGroups groups={data?.groups || []} />
              </div>
              <div className="order-4 min-w-0">
                <TransactionsCard
                  salary={salary}
                  loading={loading && data?.month !== month}
                  hidden={hideFinance}
                  monthLabel={monthLabel}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-0 max-lg:contents">
              <div className="order-3 min-w-0">
                <SalaryPanel
                  salary={salary}
                  loading={loading && data?.month !== month}
                  hidden={hideFinance}
                  month={month}
                  monthLabel={monthLabel}
                  maxMonth={currentMonth()}
                  onMonthChange={setMonth}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TeacherHome;
