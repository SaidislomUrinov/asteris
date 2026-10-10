import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiBanknotes,
  HiCalendarDays,
  HiChevronRight,
  HiClipboardDocumentCheck,
  HiChartPie,
  HiClock,
  HiExclamationTriangle,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Chip from "../../ui/Chip";
import ChartCard from "../../ui/ChartCard";
import MoneyCard from "../../components/dashboard/MoneyCard";
import StatCard from "../../components/dashboard/StatCard";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import SectionError from "../../components/dashboard/SectionError";
import Avatar from "../../ui/Avatar";
import Loading from "../../ui/Loading";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import HideFinanceToggle from "../../components/HideFinanceToggle";
import HiddenFinancePanel from "../../components/HiddenFinancePanel";
import useHideFinance from "../../hooks/useHideFinance";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { getTashkentNow, toMinutes } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import IndBadge from "../../ui/IndBadge";

// Dars holati — chap rangli chegara va kichik yorliq uchun. Reception uchun
// eng muhim savol "hozir nima bo'layapti", shuning uchun bo'layotgan dars
// ko'k, tugagani so'ngan, kutilayotgani neytral ko'rinadi.
const lessonState = (g) => {
  const { time } = getTashkentNow();
  const now = toMinutes(time);
  const start = g.startTime ? toMinutes(g.startTime) : null;
  const end = g.endTime ? toMinutes(g.endTime) : null;
  if (start === null || end === null)
    return { border: "border-slate-200 dark:border-night-700", text: "text-slate-400 dark:text-slate-500", key: "" };
  if (now >= start && now < end)
    return { border: "border-blue-500", text: "text-blue-600 dark:text-blue-400", key: "ongoing" };
  if (now >= end)
    return { border: "border-slate-200 dark:border-night-700", text: "text-slate-300 dark:text-slate-600", key: "finished" };
  return { border: "border-orange-300", text: "text-orange-500", key: "upcoming" };
};

// Student hujjatida qarz saqlanmaydi — har guruh-yozuv jonli hisoblanadi
// (Students/index.jsx'dagi "totalDebtOf" bilan bir xil formula).
const totalDebtOf = (row) =>
  (row.groups || [])
    .filter((g) => g.status === "active")
    .reduce((sum, g) => sum + (g.debt || 0), 0);

// Reception kunlik front-desk ish oqimi: bugungi darslar, qarzdor o'quvchilar va
// O'quvchilar/Guruhlar/Davomatga tezkor o'tish. Vizual til Owner Dashboard bilan
// BIR XIL (DashboardHeader/MoneyCard/StatCard/ChartCard) — video darsliklarda
// rollar almashganda sahifa boshqacha ko'rinmasligi uchun.
function ReceptionHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();

  const canViewGroups = can("group:view");
  const canViewStudents = can("student:view");
  // Moliya kartalari va grafiklar — `/dashboard` (backendda `dashboard:view`).
  const canViewStats = can("dashboard:view");
  const [hideFinance, toggleHideFinance] = useHideFinance();

  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r._id, r.name]));

  const [debtors, setDebtors] = useState([]);
  const [debtorsTotal, setDebtorsTotal] = useState(0);
  const [debtorsLoading, setDebtorsLoading] = useState(true);
  const [activeStudents, setActiveStudents] = useState(0);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  // Xato holatlari — muvaffaqiyatsiz so'rov "bo'sh" ro'yxat bo'lib
  // ko'rinmasligi uchun (avval "Bugun dars yo'q" deb noto'g'ri xabar berardi).
  const [statsFailed, setStatsFailed] = useState(false);
  const [groupsFailed, setGroupsFailed] = useState(false);
  const [debtorsFailed, setDebtorsFailed] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!canViewStats) {
      setStatsLoading(false);
      return;
    }
    try {
      setStatsLoading(true);
      const res = await api.get("/dashboard");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setStats(data);
      setStatsFailed(false);
    } catch (error) {
      setStatsFailed(true);
      errorMsg(error.message);
    } finally {
      setStatsLoading(false);
    }
  }, [canViewStats]);

  const fetchGroups = useCallback(async () => {
    if (!canViewGroups) {
      setGroupsLoading(false);
      return;
    }
    try {
      setGroupsLoading(true);
      const res = await api.get("/dashboard/today-lessons");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setGroups(data || []);
      setGroupsFailed(false);
    } catch (error) {
      setGroupsFailed(true);
      errorMsg(error.message);
    } finally {
      setGroupsLoading(false);
    }
  }, [canViewGroups]);

  const fetchLookups = useCallback(async () => {
    try {
      // Faqat nomlar uchun zaxira (today-lessons odatda nomni o'zi beradi).
      // `/rooms` `room:view` talab qiladi — resepshinga ruxsatsiz `lookup`.
      const [subjectsRes, roomsRes] = await Promise.all([
        can("subject:view")
          ? api.get("/subjects", { params: { page: 1 } })
          : Promise.resolve({ data: { ok: false } }),
        api.get("/rooms/lookup"),
      ]);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
    } catch {
      // lookup — sahifa asosiy funksiyasiga xalaqit bermasin
    }
  }, [can]);

  const fetchStudents = useCallback(async () => {
    if (!canViewStudents) {
      setDebtorsLoading(false);
      return;
    }
    try {
      setDebtorsLoading(true);
      const [debtorsRes, activeRes] = await Promise.all([
        api.get("/students", { params: { page: 1, debtStatus: "debtor" } }),
        api.get("/students", { params: { page: 1, status: "active" } }),
      ]);
      if (debtorsRes.data.ok) {
        const all = debtorsRes.data.data || [];
        // Ro'yxatda faqat 5 tasi ko'rsatiladi, LEKIN kartochkadagi son
        // to'liq bo'lishi kerak — avval `debtors.length` ishlatilgani uchun
        // kartochka har doim maksimum 5 ko'rsatib turgan edi.
        setDebtorsTotal(debtorsRes.data.meta?.total ?? all.length);
        // Server qarzdorlarni `createdAt` bo'yicha qaytaradi — bu yerda eng
        // katta qarzdorlar kerak (qo'ng'iroq navbati), shuning uchun qarz bo'yicha.
        setDebtors([...all].sort((a, b) => totalDebtOf(b) - totalDebtOf(a)).slice(0, 5));
      }
      if (activeRes.data.ok) setActiveStudents(activeRes.data.meta?.total ?? 0);
      if (!debtorsRes.data.ok || !activeRes.data.ok) throw new Error(debtorsRes.data.msg || activeRes.data.msg);
      setDebtorsFailed(false);
    } catch (error) {
      setDebtorsFailed(true);
      errorMsg(error.message);
    } finally {
      setDebtorsLoading(false);
    }
  }, [canViewStudents]);

  useEffect(() => {
    const t = setTimeout(fetchGroups, 0);
    return () => clearTimeout(t);
  }, [fetchGroups]);

  useEffect(() => {
    const t = setTimeout(fetchLookups, 0);
    return () => clearTimeout(t);
  }, [fetchLookups]);

  useEffect(() => {
    const t = setTimeout(fetchStudents, 0);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  useEffect(() => {
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [fetchStats]);

  useSocketEvent("payment:created", fetchStudents);
  useSocketEvent("payment:cancelled", fetchStudents);
  useSocketEvent("payment:updated", fetchStudents);
  useSocketEvent("student:leftGroup", fetchStudents);
  useSocketEvent("payment:created", fetchStats);
  useSocketEvent("payment:cancelled", fetchStats);
  useSocketEvent("payment:updated", fetchStats);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <DashboardHeader
        icon={<HiChartPie />}
        title={t("dashboard.title")}
        toggle={<HideFinanceToggle hidden={hideFinance} onToggle={toggleHideFinance} />}
      />

      {/* Moliya — gradient kartalar. Moliyani yashirish tugmasi sarlavhada. */}
      {canViewStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MoneyCard
            icon={<HiBanknotes />}
            label={t("receptionHome.monthRevenue")}
            value={statsLoading ? "…" : statsFailed && !stats ? "—" : maskMoney(stats?.monthRevenue, hideFinance)}
            suffix={hideFinance || (statsFailed && !stats) ? "" : t("student.somSuffix")}
            gradient="from-emerald-500 to-teal-600"
            shadow="shadow-emerald-500/20"
          />
          <MoneyCard
            icon={<HiExclamationTriangle />}
            label={t("student.debt")}
            value={statsLoading ? "…" : statsFailed && !stats ? "—" : maskMoney(stats?.currentCycleDebt, hideFinance)}
            suffix={hideFinance || (statsFailed && !stats) ? "" : t("student.somSuffix")}
            hint={t("dashboard.debtHint")}
            gradient="from-amber-500 to-orange-600"
            shadow="shadow-amber-500/20"
          />
        </div>
      )}

      {/* Ixcham hisoblagichlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<HiUsers />}
          label={t("receptionHome.activeStudents")}
          value={debtorsLoading ? "…" : debtorsFailed ? "—" : activeStudents}
          color="bg-cyan-50 dark:bg-cyan-500/15 text-cyan-500"
        />
        <StatCard
          icon={<HiCalendarDays />}
          label={t("receptionHome.todayLessons")}
          value={groupsLoading ? "…" : groupsFailed ? "—" : groups.length}
          color="bg-orange-50 dark:bg-orange-500/15 text-orange-500"
        />
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <StatCard
            icon={<HiBanknotes />}
            label={t("receptionHome.debtors")}
            value={debtorsLoading ? "…" : debtorsFailed ? "—" : debtorsTotal}
            color="bg-red-50 dark:bg-red-500/15 text-red-500"
          />
        </div>
      </div>

      {/* Bugungi darslar (chap) va Qarzdorlar (o'ng) — yonma-yon, statistikadan
          keyingi eng muhim ma'lumot. Ikkalasi ham ichki scroll bilan
          cheklangan, shuning uchun ro'yxat uzun bo'lsa ham sahifa cho'zilib
          ketmaydi. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <ChartCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("receptionHome.todayLessons")}</p>
            {!groupsLoading && groups.length > 0 && (
              <Chip value={groups.length} color="orange" variant="ghost" />
            )}
          </div>

          {!canViewGroups ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">{t("receptionHome.noPermission")}</p>
          ) : groupsLoading ? (
            <Loading height="15vh" />
          ) : groupsFailed ? (
            <SectionError message={t("receptionHome.loadError")} onRetry={fetchGroups} />
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">{t("receptionHome.noLessonsToday")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-night-700 border-t border-slate-100 dark:border-night-700 -mx-5 -mb-5 max-h-80 overflow-y-auto">
              {groups.map((g) => {
                const state = lessonState(g);
                return (
                  <div
                    key={g._id}
                    onClick={() => navigate(g.isIndividual ? `/individual/${g._id}` : `/groups/${g._id}`)}
                    className={`flex items-center gap-3 px-5 py-2.5 border-l-3 hover:bg-slate-50 dark:hover:bg-night-800 cursor-pointer transition-colors ${state.border}`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {(g.isIndividual && g.studentName) || g.subjectName || subjectMap[g.subject] || "?"}
                        </span>
                        {g.isIndividual && <IndBadge title={`${t("individual.badgeTitle")} · ${g.subjectName || ""}`} />}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {g.teacherName || "—"} · {g.roomName || roomMap[g.room] || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <HiClock className="text-slate-300 dark:text-slate-600" />
                        {g.startTime || "—"}–{g.endTime || "—"}
                      </span>
                      <span className={`text-[11px] font-semibold ${state.text}`}>
                        {state.key ? t(`dashboard.lessonStatus.${state.key}`) : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("receptionHome.debtors")}</p>
            {!debtorsLoading && debtorsTotal > 0 && (
              <Chip value={debtorsTotal} color="red" variant="ghost" />
            )}
          </div>

          {!canViewStudents ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">{t("receptionHome.noPermission")}</p>
          ) : debtorsLoading ? (
            <Loading height="15vh" />
          ) : debtorsFailed ? (
            <SectionError message={t("receptionHome.loadError")} onRetry={fetchStudents} />
          ) : debtors.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">{t("receptionHome.noDebtors")}</p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-night-700 border-t border-slate-100 dark:border-night-700 -mx-5 -mb-5 max-h-80 overflow-y-auto">
                {debtors.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => navigate(`/students/${s._id}`)}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-red-50/60 dark:hover:bg-red-500/15 cursor-pointer transition-colors"
                  >
                    <Avatar user={{ _id: s._id, name: s.fullName, avatar: s.photo }} size={34} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.fullName}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{s.phone}</span>
                    </div>
                    <span className="font-semibold text-red-600 dark:text-red-400 shrink-0 text-sm">
                      {maskMoney(totalDebtOf(s), hideFinance)} {hideFinance ? "" : t("student.somSuffix")}
                    </span>
                  </div>
                ))}
              </div>
              {debtorsTotal > debtors.length && (
                <button
                  type="button"
                  onClick={() => navigate("/students?debtStatus=debtor")}
                  className="-mx-5 -mb-5 px-5 py-2.5 border-t border-slate-100 dark:border-night-700 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer transition-colors"
                >
                  {t("receptionHome.viewAllDebtors", { count: debtorsTotal })}
                </button>
              )}
            </>
          )}
        </ChartCard>
      </div>

      {/* Moliyaviy analitika — to'lov holati (1) va tushum dinamikasi (2) */}
      {statsFailed && !stats && (
        <ChartCard>
          <SectionError message={t("receptionHome.loadError")} onRetry={fetchStats} />
        </ChartCard>
      )}

      {/* `stats` bo'lsa yetarli — socket bilan qayta yuklanganda grafiklar
          yo'qolib-qaytib "miltillamasin". */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch lg:h-88">
          <div className="lg:col-span-1 min-h-0">
            {hideFinance ? (
              <HiddenFinancePanel />
            ) : (
              <PaymentDonut paid={stats.currentCyclePaid || 0} debt={stats.currentCycleDebt || 0} />
            )}
          </div>
          <div className="lg:col-span-2 min-h-0">
            {hideFinance ? <HiddenFinancePanel /> : <RevenueChart payments={stats.chartPayments} />}
          </div>
        </div>
      )}

      {/* Tezkor amallar — eng past prioritet, shuning uchun eng pastda */}
      <ChartCard className="h-auto">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t("receptionHome.quickActions")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {canViewStudents && (
            <button
              type="button"
              onClick={() => navigate("/students")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-night-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 active:bg-emerald-100 dark:active:bg-emerald-500/20 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                <HiUsers />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1">
                {t("receptionHome.goToStudents")}
              </span>
              <HiChevronRight className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors" />
            </button>
          )}
          {canViewGroups && (
            <button
              type="button"
              onClick={() => navigate("/groups")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-night-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 active:bg-blue-100 dark:active:bg-blue-500/20 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
                <HiUserGroup />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1">{t("receptionHome.goToGroups")}</span>
              <HiChevronRight className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
            </button>
          )}
          {can("attendance:view") && (
            <button
              type="button"
              onClick={() => navigate("/groups")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-night-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/15 active:bg-violet-100 dark:active:bg-violet-500/20 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-lg">
                <HiClipboardDocumentCheck />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1">
                {t("receptionHome.goToAttendance")}
              </span>
              <HiChevronRight className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors" />
            </button>
          )}
        </div>
      </ChartCard>
    </div>
  );
}

export default ReceptionHome;
