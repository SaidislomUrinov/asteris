import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiBanknotes,
  HiCalendarDays,
  HiChevronRight,
  HiClipboardDocumentCheck,
  HiClock,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Chip from "../../ui/Chip";
import MetricCard from "../../ui/MetricCard";
import Avatar from "../../ui/Avatar";
import Loading from "../../ui/Loading";
import PaymentDonut from "../Groups/PaymentDonut";
import RevenueChart from "../Groups/RevenueChart";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { getTashkentNow, toMinutes } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

// Dars holati — chap rangli chegara va kichik yorliq uchun. Reception uchun
// eng muhim savol "hozir nima bo'layapti", shuning uchun bo'layotgan dars
// ko'k, tugagani so'ngan, kutilayotgani neytral ko'rinadi.
const lessonState = (g) => {
  const { time } = getTashkentNow();
  const now = toMinutes(time);
  const start = g.startTime ? toMinutes(g.startTime) : null;
  const end = g.endTime ? toMinutes(g.endTime) : null;
  if (start === null || end === null)
    return { border: "border-slate-200", text: "text-slate-400", key: "" };
  if (now >= start && now < end)
    return { border: "border-blue-500", text: "text-blue-600", key: "ongoing" };
  if (now >= end)
    return { border: "border-slate-200", text: "text-slate-300", key: "finished" };
  return { border: "border-orange-300", text: "text-orange-500", key: "upcoming" };
};

// Student hujjatida qarz saqlanmaydi — har guruh-yozuv jonli hisoblanadi
// (Students/index.jsx'dagi "totalDebtOf" bilan bir xil formula).
const totalDebtOf = (row) =>
  (row.groups || [])
    .filter((g) => g.status === "active")
    .reduce((sum, g) => sum + (g.debt || 0), 0);

// Teacher panelidan (ko'k, oylik-markazli) ATAYLAB farqli — Reception kunlik
// front-desk ish oqimiga mos: bugungi darslar, qarzdor o'quvchilar va
// O'quvchilar/Guruhlar/Davomatga tezkor o'tish. Rang sxemasi emerald/teal —
// CLAUDE.md "har rol o'z panelida boshqacha dizayn" talabiga mos.
function ReceptionHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();

  const canViewGroups = can("group:view");
  const canViewStudents = can("student:view");

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

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get("/dashboard");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setStats(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

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
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setGroupsLoading(false);
    }
  }, [canViewGroups]);

  const fetchLookups = useCallback(async () => {
    try {
      const [subjectsRes, roomsRes] = await Promise.all([
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/rooms", { params: { page: 1 } }),
      ]);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
    } catch {
      // lookup — sahifa asosiy funksiyasiga xalaqit bermasin
    }
  }, []);

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
        setDebtors(all.slice(0, 5));
      }
      if (activeRes.data.ok) setActiveStudents(activeRes.data.meta?.total ?? 0);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDebtorsLoading(false);
    }
  }, [canViewStudents]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useSocketEvent("payment:created", fetchStudents);
  useSocketEvent("payment:cancelled", fetchStudents);
  useSocketEvent("student:leftGroup", fetchStudents);
  useSocketEvent("payment:created", fetchStats);
  useSocketEvent("payment:cancelled", fetchStats);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {/* Statistika — sahifa banner o'rniga to'g'ridan-to'g'ri asosiy
          ko'rsatkichlar bilan boshlanadi. Mobilda 2 ustunli compact grid,
          desktopda 4 ustun. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<HiUsers />}
          title={t("receptionHome.activeStudents")}
          value={debtorsLoading ? "…" : activeStudents}
          accent="cyan"
        />

        <MetricCard
          icon={<HiCalendarDays />}
          title={t("receptionHome.todayLessons")}
          value={groupsLoading ? "…" : groups.length}
          accent="orange"
        />

        <MetricCard
          icon={<HiBanknotes />}
          title={t("receptionHome.debtors")}
          value={debtorsLoading ? "…" : debtorsTotal}
          accent="red"
        />

        <MetricCard
          icon={<HiBanknotes />}
          title={t("receptionHome.monthRevenue")}
          value={statsLoading ? "…" : money(stats?.monthRevenue)}
          suffix={t("student.somSuffix")}
          accent="emerald"
        />
      </div>

      {/* Bugungi darslar (chap) va Qarzdorlar (o'ng) — yonma-yon, statistikadan
          keyingi eng muhim ma'lumot. Ikkalasi ham ichki scroll bilan
          cheklangan, shuning uchun ro'yxat uzun bo'lsa ham sahifa cho'zilib
          ketmaydi. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <HiCalendarDays />
              </div>
              <p className="font-semibold text-slate-800">{t("receptionHome.todayLessons")}</p>
            </div>
            {!groupsLoading && groups.length > 0 && (
              <Chip value={groups.length} color="orange" variant="ghost" />
            )}
          </div>

          {!canViewGroups ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("receptionHome.noPermission")}</p>
          ) : groupsLoading ? (
            <Loading height="15vh" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("receptionHome.noLessonsToday")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {groups.map((g) => {
                const state = lessonState(g);
                return (
                  <div
                    key={g._id}
                    onClick={() => navigate(`/groups/${g._id}`)}
                    className={`flex items-center gap-3 px-4 py-2.5 border-l-3 hover:bg-slate-50 cursor-pointer transition-colors ${state.border}`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-800 truncate">
                        {g.subjectName || subjectMap[g.subject] || "?"}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {g.teacherName || "—"} · {g.roomName || roomMap[g.room] || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="flex items-center gap-1 text-sm font-medium text-slate-600">
                        <HiClock className="text-slate-300" />
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
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <HiBanknotes />
              </div>
              <p className="font-semibold text-slate-800">{t("receptionHome.debtors")}</p>
            </div>
            {!debtorsLoading && debtorsTotal > 0 && (
              <Chip value={debtorsTotal} color="red" variant="ghost" />
            )}
          </div>

          {!canViewStudents ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("receptionHome.noPermission")}</p>
          ) : debtorsLoading ? (
            <Loading height="15vh" />
          ) : debtors.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("receptionHome.noDebtors")}</p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {debtors.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => navigate(`/students/${s._id}`)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/60 cursor-pointer transition-colors"
                  >
                    <Avatar user={{ _id: s._id, name: s.fullName, avatar: s.photo }} size={34} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-800 truncate">{s.fullName}</span>
                      <span className="text-xs text-slate-400 truncate">{s.phone}</span>
                    </div>
                    <span className="font-semibold text-red-600 shrink-0 text-sm">
                      {money(totalDebtOf(s))} {t("student.somSuffix")}
                    </span>
                  </div>
                ))}
              </div>
              {debtorsTotal > debtors.length && (
                <button
                  type="button"
                  onClick={() => navigate("/students?debtStatus=debtor")}
                  className="px-4 py-2.5 border-t border-slate-100 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                >
                  {t("receptionHome.viewAllDebtors", { count: debtorsTotal })}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Moliyaviy analitika — to'lov holati va tushum dinamikasi */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PaymentDonut
            paid={stats.currentCyclePaid || 0}
            debt={stats.currentCycleDebt || 0}
          />
          <RevenueChart payments={stats.chartPayments} />
        </div>
      )}

      {/* Tezkor amallar — eng past prioritet, shuning uchun eng pastda */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <p className="font-semibold text-slate-800">{t("receptionHome.quickActions")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {canViewStudents && (
            <button
              type="button"
              onClick={() => navigate("/students")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                <HiUsers />
              </div>
              <span className="font-semibold text-slate-700 flex-1">
                {t("receptionHome.goToStudents")}
              </span>
              <HiChevronRight className="shrink-0 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </button>
          )}
          {canViewGroups && (
            <button
              type="button"
              onClick={() => navigate("/groups")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                <HiUserGroup />
              </div>
              <span className="font-semibold text-slate-700 flex-1">{t("receptionHome.goToGroups")}</span>
              <HiChevronRight className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </button>
          )}
          {can("attendance:view") && (
            <button
              type="button"
              onClick={() => navigate("/groups")}
              className="group flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 active:bg-violet-100 transition-colors cursor-pointer text-left min-h-[3.25rem]"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center text-lg">
                <HiClipboardDocumentCheck />
              </div>
              <span className="font-semibold text-slate-700 flex-1">
                {t("receptionHome.goToAttendance")}
              </span>
              <HiChevronRight className="shrink-0 text-slate-300 group-hover:text-violet-500 transition-colors" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReceptionHome;
