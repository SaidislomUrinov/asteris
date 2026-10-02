import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiExclamationTriangle, HiTrophy } from "react-icons/hi2";
import Button from "../../ui/Button";
import BadgeIcon from "../../ui/BadgeIcon";
import RankMedal from "../../ui/RankMedal";
import BadgeProgressRow from "./BadgeProgressRow";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { BADGE_FEATURE, BADGE_TYPES, badgeNameKey, formatBadgeMonth, monthNameOf } from "../../utils/badges";

/**
 * O'quvchi detali — "Yutuqlar" bo'limi (API_CONTRACT_badges_monthly_rank.md §D.2).
 * Guruh bo'yicha: olingan nishonlar (soni + oylar), oylik reyting medallari
 * va joriy oy progressi. Tarif flagi `gamification.badges` bo'lmasa umuman
 * chizilmaydi va API chaqirilmaydi. Ko'rish: `student:view` YOKI
 * o'qituvchi/yordamchi (server faqat o'z guruhlarini qaytaradi —
 * API_CONTRACT_student_achievements.md).
 * `onLoaded(data|null)` — javob kelganda (o'qituvchi sahifasi sarlavhasi uchun).
 * `showTitle` — "Yutuqlar" sarlavhasi (sahifaning o'zi yutuqlar bo'lsa — false).
 */
// Medal kartochkasi foni — oltin / kumush / bronza.
const MEDAL_TONE = {
  1: "bg-amber-50 border-amber-200",
  2: "bg-slate-50 border-slate-200",
  3: "bg-orange-50 border-orange-200",
};

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

  return (
    <section className="flex flex-col gap-3">
      {showTitle && (
        <div className="flex items-center gap-2">
          <HiTrophy className="text-amber-500" />
          <p className="font-semibold text-slate-800">{t("badge.title")}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-4 p-4 rounded-xl border border-slate-200 bg-white">
              <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
              <div className="flex gap-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="w-11 h-11 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-7 rounded bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-slate-200 bg-white text-slate-400">
          <HiExclamationTriangle className="text-2xl text-red-400" />
          <p className="text-sm">{t("badge.loadError")}</p>
          <Button variant="outlined" color="slate" onClick={() => load()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-slate-200 bg-white text-slate-400">
          <BadgeIcon type="champion" size={40} earned={false} animated={false} />
          <p className="text-sm">{t("badge.empty")}</p>
        </div>
      ) : (
        // Bitta guruh bo'lsa karta to'liq kenglikda — 7 nishon bir qatorga sig'adi.
        <div className={`grid grid-cols-1 gap-3 ${groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {groups.map((g) => (
            <div key={g.entryId || g.groupId} className="flex flex-col gap-4 p-4 rounded-xl border border-slate-200 bg-white min-w-0">
              <p className="font-semibold text-slate-800 truncate">
                {[g.subjectName, g.groupName].filter(Boolean).join(" · ")}
              </p>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t("badge.earned")}
                </span>
                {g.earned?.length ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-3">
                    {BADGE_TYPES.map((type) => g.earned.find((e) => e.type === type))
                      .filter(Boolean)
                      .map((e) => {
                        const months = (e.months || []).map((m) => formatBadgeMonth(m, monthNames));
                        return (
                          <div key={e.type} className="flex flex-col items-center gap-1 w-[72px]">
                            <BadgeIcon
                              type={e.type}
                              size={44}
                              count={e.count}
                              label={`${t(badgeNameKey(e.type))}${months.length ? ` — ${months.join(", ")}` : ""}`}
                            />
                            <span className="text-[11px] font-medium text-slate-600 text-center leading-tight line-clamp-2">
                              {t(badgeNameKey(e.type))}
                            </span>
                            {months[0] && (
                              <span className="text-[10px] text-slate-400 text-center leading-tight">{months[0]}</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("badge.noneEarned")}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t("badge.medals")}
                </span>
                {g.medals?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {g.medals.map((m) => (
                      <div
                        key={m.month}
                        className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border ${MEDAL_TONE[m.position]}`}
                      >
                        <RankMedal position={m.position} size={18} animated={false} />
                        <div className="flex flex-col min-w-0 leading-tight">
                          <span className="text-xs font-semibold text-slate-800">
                            {formatBadgeMonth(m.month, monthNames)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {t(`badge.medalTier${m.position}`)}
                            {m.total > 0 && ` · ${t("badge.medalPlace", { position: m.position, total: m.total })}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("badge.noMedals")}</p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t("badge.progressTitle", { month: currentMonthName })}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {BADGE_TYPES.map((type) => (
                    <BadgeProgressRow key={type} type={type} progress={g.progress?.[type]} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default StudentBadges;
