import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiExclamationTriangle, HiSparkles, HiTrophy } from "react-icons/hi2";
import Button from "../../ui/Button";
import BadgeIcon from "../../ui/BadgeIcon";
import AchievementGroupCard from "./AchievementGroupCard";
import { STATE_META } from "./achievementStates";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { ACHIEVEMENT_STATES, BADGE_FEATURE, monthNameOf } from "../../utils/badges";

/**
 * O'quvchi detali — "Yutuqlar" bo'limi (API_CONTRACT_badges_monthly_rank.md §D.2).
 * Guruh bo'yicha: olingan nishonlar (soni + oylar), oylik reyting medallari
 * va joriy oy progressi. Tarif flagi `gamification.badges` bo'lmasa umuman
 * chizilmaydi va API chaqirilmaydi. Ko'rish: `student:view` YOKI
 * o'qituvchi/yordamchi (server faqat o'z guruhlarini qaytaradi —
 * API_CONTRACT_student_achievements.md).
 * `onLoaded(data|null)` — javob kelganda (o'qituvchi sahifasi sarlavhasi uchun).
 * `showTitle` — "Yutuqlar" sarlavhasi (sahifaning o'zi yutuqlar bo'lsa — false).
 * Kartalar holat bo'limlariga ajratiladi (Faol / Yakunlangan / Chiqqan /
 * Arxivlangan) — nofaol guruhdagi nishon va medallar ham doimiy ko'rinadi
 * (API_CONTRACT_student_achievements.md, 2026-10-03).
 */
function StudentBadges({ studentId, onLoaded, showTitle = true }) {
  const { t } = useTranslation();
  const hasFeature = useFeature();
  const can = useCan();
  const { authType, role } = useSelector((e) => e?.user);
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  const enabled = !!studentId && hasFeature(BADGE_FEATURE) && (can("student:view") || isTeacher);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef(null);
  const monthNames = t("common.monthNames", { returnObjects: true });

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        setError(false);
        const res = await api.get(`/badges/student/${studentId}`);
        const { ok, data: body, msg } = res.data;
        // Faol/chiqib ketgan a'zoligi qolmagan o'quvchi — xato emas, bo'sh holat.
        if (!ok && msg === "student.notFound") {
          setData({ month: null, groups: [] });
          onLoadedRef.current?.(null);
          return;
        }
        if (!ok) throw new Error(msg);
        setData(body);
        onLoadedRef.current?.(body);
      } catch {
        if (!silent) setError(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [studentId],
  );

  // Boshqa o'quvchiga o'tilganda oldingisining nishonlari bir lahza ko'rinmasin.
  const [loadedFor, setLoadedFor] = useState(studentId);
  if (loadedFor !== studentId) {
    setLoadedFor(studentId);
    setData(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [enabled, load]);

  // Yangi nishon berilsa yoki shu o'quvchining davomati/bahosi o'zgarsa —
  // progress jimgina qayta hisoblanadi (ketma-ket hodisalar bitta so'rovga).
  const refetch = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load({ silent: true }), 500);
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);
  useSocketEvent(
    "badge:awarded",
    (p) => {
      if (p?.groupId && data?.groups && !data.groups.some((g) => g.groupId === p.groupId)) return;
      refetch();
    },
    enabled,
  );
  useSocketEvent("attendance:marked", (p) => p?.studentId === studentId && refetch(), enabled);
  // Baho — o'quvchining guruhlaridan istalgan o'quvchiniki ham: "Guruh chempioni"
  // o'rni boshqalarning bahosiga ham bog'liq.
  const inMyGroups = (p) =>
    p?.studentId === studentId || (!!p?.groupId && !!data?.groups?.some((g) => g.groupId === p.groupId));
  useSocketEvent("grade:set", (p) => inMyGroups(p) && refetch(), enabled);
  useSocketEvent("grade:removed", (p) => inMyGroups(p) && refetch(), enabled);

  if (!enabled) return null;

  const currentMonthName = monthNameOf(data?.month, monthNames);
  const groups = data?.groups || [];
  const sections = ACHIEVEMENT_STATES.map((state) => ({
    state,
    items: groups.filter((g) => (g.state || "active") === state),
  })).filter((sec) => sec.items.length);
  const badgeTotal = groups.reduce((sum, g) => sum + (g.earned || []).reduce((s2, e) => s2 + (e.count || 0), 0), 0);
  const medalTotal = groups.reduce((sum, g) => sum + (g.medals?.length || 0), 0);

  return (
    <section className="flex flex-col gap-3">
      {showTitle && (
        <div className="flex items-center gap-2">
          <HiTrophy className="text-amber-500" />
          <p className="font-semibold text-slate-800 dark:text-slate-100">{t("badge.title")}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-5">
          <div className="h-16 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 animate-pulse" />
          <div className="flex flex-col gap-3">
            <div className="h-5 w-32 border-b border-slate-200 dark:border-night-700 pb-2">
              <div className="h-3 w-24 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-4 p-4 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
                  <div className="flex justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-40 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
                      <div className="h-3 w-28 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-night-800 animate-pulse" />
                  </div>
                  <div className="flex gap-3">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-night-800 animate-pulse" />
                    ))}
                  </div>
                  <div className="h-8 w-48 rounded-xl bg-slate-100 dark:bg-night-800 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-slate-400 dark:text-slate-500">
          <HiExclamationTriangle className="text-2xl text-red-400" />
          <p className="text-sm">{t("badge.loadError")}</p>
          <Button variant="outlined" color="slate" onClick={() => load()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-slate-400 dark:text-slate-500">
          <BadgeIcon type="champion" size={40} earned={false} animated={false} />
          <p className="text-sm">{t("badge.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 min-w-0 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-blue-50 dark:bg-blue-500/15 text-blue-500">
                <HiSparkles className="text-xl" />
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xl font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{badgeTotal}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("badge.totalBadges")}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0 px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-amber-50 dark:bg-amber-500/15 text-amber-500">
                <HiTrophy className="text-xl" />
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xl font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{medalTotal}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("badge.totalMedals")}</span>
              </div>
            </div>
          </div>

          {sections.map((sec) => (
            <div key={sec.state} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-night-700">
                <span className={`w-2 h-2 rounded-full ${STATE_META[sec.state]?.dot || "bg-slate-400"}`} />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`badge.sections.${sec.state}`)}</h2>
                <span className="px-1.5 rounded-md bg-slate-100 dark:bg-night-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {sec.items.length}
                </span>
              </div>
              {/* Bitta karta bo'lsa to'liq kenglikda — nishonlar bir qatorga sig'adi. */}
              <div className={`grid grid-cols-1 gap-3 ${sec.items.length > 1 ? "lg:grid-cols-2" : ""}`}>
                {sec.items.map((g) => (
                  <AchievementGroupCard
                    key={g.entryId || g.groupId}
                    group={g}
                    monthNames={monthNames}
                    currentMonthName={currentMonthName}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default StudentBadges;
