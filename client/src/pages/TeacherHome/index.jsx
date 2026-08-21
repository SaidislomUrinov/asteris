import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  HiBanknotes,
  HiCalendarDays,
  HiClipboardDocumentList,
  HiClock,
  HiHome,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import Loading from "../../ui/Loading";
import NumberText from "../../ui/NumberText";
import SalaryDonut from "../../ui/SalaryDonut";
import LedgerRow from "../../ui/LedgerRow";
import MonthNav from "../../ui/MonthNav";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Dars holati — vaqt bo'yicha (Reception bosh sahifasidagi bilan bir xil
// mantiq, lekin o'qituvchi ko'rinishida).
const lessonState = (g) => {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (hhmm) => {
    if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMin(g.startTime);
  const end = toMin(g.endTime);
  if (start === null || end === null) return "upcoming";
  if (mins >= start && mins <= end) return "ongoing";
  if (mins > end) return "finished";
  return "upcoming";
};

// ── Yuqori statistika paneli ────────────────────────────────────────────
// Beshtasi BITTA konteynerda — alohida-alohida "karta karta karta" emas,
// bitta tizimga tegishli hisoblagichlar. Birinchi ikkitasi (oylik, bugungi
// darslar) muloyim rangli fon bilan urg'ulanadi, qolgan uchtasi neytral.
function StatSegment({ icon, label, value, suffix, tone, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-xl transition-colors ${TONE_BG[tone]} ${className}`}>
      <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-base ${TONE_ICON[tone]}`}>
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="flex items-baseline gap-1 min-w-0">
          <NumberText className={`!text-xl sm:!text-2xl leading-none truncate ${TONE_TEXT[tone]}`}>
            {value}
          </NumberText>
          {suffix && <span className="text-[11px] text-slate-400 shrink-0">{suffix}</span>}
        </span>
        <span className="text-[11px] font-medium text-slate-400 truncate">{label}</span>
      </div>
    </div>
  );
}

const TONE_BG = {
  emerald: "bg-emerald-50/70",
  orange: "bg-orange-50/70",
  pink: "bg-pink-50/70",
  cyan: "bg-cyan-50/70",
  violet: "bg-violet-50/70",
};
const TONE_ICON = {
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  pink: "bg-pink-100 text-pink-600",
  cyan: "bg-cyan-100 text-cyan-600",
  violet: "bg-violet-100 text-violet-600",
};
const TONE_TEXT = {
  emerald: "text-emerald-700",
  orange: "text-orange-700",
  pink: "text-pink-700",
  cyan: "text-cyan-700",
  violet: "text-violet-700",
};

/**
 * O'qituvchi paneli bosh sahifasi.
 *
 * Barcha ma'lumot BITTA so'rovda keladi (`GET /teacher/dashboard`) —
 * guruhlar, xonalar, o'quvchilar soni, bugungi darslar va shu oygi oylik.
 *
 * Dizayn (2026-08-08 qayta qurildi): mavjud rang palitrasi (ko'k/indigo,
 * emerald, orange, cyan, pink, violet), rounded-corner tili va donut grafik
 * KONSEPSIYASI saqlanadi, lekin joylashuv "karta-karta-karta" emas — bitta
 * statistika paneli, bitta moliyaviy panel (donut + ledger), timeline
 * uslubidagi bugungi darslar ro'yxati orqali vizual ierarxiya quriladi.
 */
function TeacherHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((e) => e.user);
  // Yordamchi o'qituvchi ham shu panelni ko'radi — matnlar rolga moslanadi.
  const isAssistant = user.role === "assistant";

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/teacher/dashboard", { params: { month } });
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const id = setTimeout(fetchDashboard, 0);
    return () => clearTimeout(id);
  }, [fetchDashboard]);

  // ─── Realtime sinxronlar ────────────────────────────────────────────
  useSocketEvent("payment:created", fetchDashboard);
  useSocketEvent("payment:cancelled", fetchDashboard);
  useSocketEvent("salary:updated", fetchDashboard);

  const mine = useCallback(
    (payload) =>
      String(payload?.teacher || "") === String(user._id) ||
      String(payload?.assistant || "") === String(user._id),
    [user._id],
  );

  useSocketEvent("group:changed", (payload) => {
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

  return (
    <div className="flex flex-col w-full h-full gap-6">
      {/* ── Ixcham sarlavha — katta banner o'rniga ──────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar user={user} size={44} />
          <div className="flex flex-col min-w-0">
            <span className="block h-[3px] w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 mb-1.5" />
            <p className="font-space font-bold text-xl text-slate-900 truncate">
              {t("teacherHome.greeting", { name: user.name })}
            </p>
            <p className="text-sm text-slate-400 truncate">
              {t(isAssistant ? "teacherHome.greetingDescAssistant" : "teacherHome.greetingDesc")}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-xs font-medium text-indigo-600 shrink-0 capitalize">
          <HiCalendarDays />
          {todayLabel}
        </div>
      </div>

      {/* ── Statistika paneli — bitta konteyner, ikkita urg'ulangan ─────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1.5 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <StatSegment
          icon={<HiBanknotes />}
          tone="emerald"
          label={t("teacherHome.salaryRemaining")}
          value={loading ? "…" : money(salary?.final)}
          suffix={t("student.somSuffix")}
        />
        <StatSegment
          icon={<HiCalendarDays />}
          tone="orange"
          label={t("teacherHome.todayLessons")}
          value={loading ? "…" : stats?.todayLessons ?? 0}
        />
        <StatSegment
          icon={<HiUserGroup />}
          tone="pink"
          label={t("teacherHome.myGroups")}
          value={loading ? "…" : stats?.groups ?? 0}
        />
        <StatSegment
          icon={<HiUsers />}
          tone="cyan"
          label={t("teacherHome.myStudents")}
          value={loading ? "…" : stats?.students ?? 0}
        />
        <StatSegment
          icon={<HiHome />}
          tone="violet"
          label={t("teacherHome.myRooms")}
          value={loading ? "…" : stats?.rooms ?? 0}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* ── Ish haqi — donut + ledger, bitta moliyaviy panel ────────────── */}
      <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
              <HiBanknotes className="text-base" />
            </span>
            <p className="font-semibold text-slate-800">{t("salary.title")}</p>
          </div>

          <MonthNav month={month} label={monthLabel} onChange={setMonth} max={currentMonth()} />
        </div>

        {loading ? (
          <Loading height="10vh" />
        ) : !salary ? (
          <p className="text-sm text-slate-400 py-4 text-center">{t("salary.empty")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1px_1fr] gap-6 items-start">
              <div className="flex justify-center lg:justify-start pt-2">
                <SalaryDonut
                  base={salary.base}
                  bonus={salary.bonus}
                  advance={salary.advance}
                  withdrawal={salary.withdrawal}
                  penalty={salary.penalty}
                  final={salary.final}
                />
              </div>

              <div className="hidden lg:block w-px bg-slate-100 self-stretch" />

              <div className="flex flex-col divide-y divide-slate-100 pt-1">
                <LedgerRow label={t("salary.base")} value={salary.base} />
                <LedgerRow label={t("salary.bonus")} value={salary.bonus} tone="positive" />
                <LedgerRow label={t("salary.advance")} value={salary.advance} tone="negative" />
                <LedgerRow label={t("salary.withdrawal")} value={salary.withdrawal} tone="negative" />
                <LedgerRow label={t("salary.penalty")} value={salary.penalty} tone="negative" />
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-slate-100">
                  <span className="font-semibold text-slate-800">{t("salary.final")}</span>
                  <NumberText className="!text-lg text-emerald-600">{money(salary.final)}</NumberText>
                </div>
              </div>
            </div>

            {/* Tranzaksiyalar — avans/bonus/jarima tarixi */}
            <div className="flex flex-col gap-1.5 pt-5 mt-5 border-t border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("salary.transactions")}
              </p>
              {salary.transactions?.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-lg text-slate-300">
                    <HiClipboardDocumentList />
                  </span>
                  <p className="text-xs text-slate-400">{t("salary.noTransactions")}</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {salary.transactions?.map((tx) => (
                    <div key={tx._id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-slate-700">
                          {t(`salary.txType.${tx.type}`)}
                        </span>
                        {tx.note && <span className="text-[11px] text-slate-400 truncate">{tx.note}</span>}
                      </div>
                      <NumberText className={tx.type === "bonus" ? "text-emerald-600" : "text-slate-700"}>
                        {money(tx.amount)}
                      </NumberText>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Bugungi darslar — timeline uslubi ────────────────────────────── */}
      <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="font-semibold text-slate-800 pb-3">{t("teacherHome.todayLessons")}</p>

        {loading ? (
          <Loading height="15vh" />
        ) : (data?.todayLessons?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 px-4 text-center">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 text-xl text-slate-300">
              <HiCalendarDays />
            </span>
            <p className="text-sm font-medium text-slate-600">{t("teacherHome.noLessonsToday")}</p>
            <p className="text-xs text-slate-400 max-w-xs">{t("teacherHome.todayEmptyHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {data.todayLessons.map((g, idx) => {
              const state = lessonState(g);
              const ongoing = state === "ongoing";
              const finished = state === "finished";
              return (
                <div
                  key={g._id}
                  onClick={() => navigate(`/groups/${g._id}`)}
                  className={`group flex items-center gap-4 py-3 px-3 -mx-3 rounded-xl cursor-pointer transition-colors ${
                    idx > 0 ? "border-t border-slate-100" : ""
                  } ${ongoing ? "bg-blue-50/60" : "hover:bg-slate-50"}`}
                >
                  <div
                    className={`flex flex-col items-end shrink-0 w-14 pr-3 border-r-2 ${
                      ongoing ? "border-blue-500" : "border-slate-200"
                    }`}
                  >
                    <span
                      className={`font-jet font-bold text-sm leading-none ${
                        ongoing ? "text-blue-600" : finished ? "text-slate-400" : "text-slate-700"
                      }`}
                    >
                      {g.startTime}
                    </span>
                    <span className="font-jet text-[11px] text-slate-400 leading-none mt-1">
                      {g.endTime}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-semibold truncate ${finished ? "text-slate-400" : "text-slate-800"}`}
                      >
                        {g.label}
                      </span>
                      {ongoing && (
                        <span className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-blue-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          {t("dashboard.lessonStatus.ongoing")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <HiUsers className="text-slate-300" />
                        {t("group.studentsShort", { count: g.studentsCount })}
                      </span>
                      {g.room?.name && (
                        <span className="flex items-center gap-1">
                          <HiHome className="text-slate-300" />
                          {g.room.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <HiClock
                    className={`shrink-0 text-base ${ongoing ? "text-blue-400" : "text-slate-200"}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherHome;
