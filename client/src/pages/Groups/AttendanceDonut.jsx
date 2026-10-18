import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { HiChevronLeft, HiChevronRight, HiUserGroup } from "react-icons/hi2";
import ChartHeader from "../../components/charts/ChartHeader";
import ChartTip from "../../components/charts/ChartTip";
import { api } from "../../utils/fetching";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import ChartCard from "../../ui/ChartCard";

const PRESENT_COLOR = "#10b981"; // emerald-500
const EXCUSED_COLOR = "#f59e0b"; // amber-500
const ABSENT_COLOR = "#ef4444"; // red-500
const UNMARKED_COLOR = "#cbd5e1"; // slate-300

const MONTH_NAMES_KEY = "common.monthNames";

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "Umumiy davomat" — bir guruhning BARCHA o'quvchilari bo'yicha, tanlangan
// oydagi Kelgan/Sababli/Sababsiz ulushi (%). Faqat guruh faollashtirilgan
// oydan (courseStartMonth) to joriy oygacha ko'rish mumkin — KELAJAK oyga
// o'tib bo'lmaydi (hali bo'lmagan darslar uchun statistika bo'lishi mumkin
// emas, bu mantiqan to'g'ri).
function AttendanceDonut({ groupId, courseStartMonth }) {
  const { t } = useTranslation();
  const monthNames = t(MONTH_NAMES_KEY, { returnObjects: true });

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [month, setMonth] = useState(currentMonth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/attendance/${groupId}/stats`, {
          params: { month },
        });
        const { ok, data } = res.data;
        if (!cancelled && ok) setStats(data);
      } catch {
        // jim o'tkazamiz
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, month]);

  // Kimdir (shu tab yoki boshqa xodim) davomat belgilasa — chart QAYTA
  // YUKLANMAYDI: eventdagi farq (`previousStatus` → `status`) shu yerda
  // qo'llanadi. Jami (`total`) o'zgarmaydi — belgilash "belgilanmagan"ni
  // statusga aylantiradi, yangi kutilgan yozuv qo'shmaydi.
  useSocketEvent(
    "attendance:marked",
    (payload) => {
      if (payload?.groupId !== groupId) return;
      if (payload?.date?.slice(0, 7) !== month) return;

      setStats((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        const from = payload.previousStatus || "unmarked";
        if (next[from] !== undefined) next[from] = Math.max(0, next[from] - 1);
        if (next[payload.status] !== undefined) next[payload.status] += 1;

        const total = next.total || 0;
        const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
        next.presentPercent = pct(next.present);
        next.absentPercent = pct(next.absent);
        next.excusedPercent = pct(next.excused);
        next.unmarkedPercent = pct(next.unmarked);
        return next;
      });
    },
    !!groupId,
  );

  const canGoPrev = !courseStartMonth || month > courseStartMonth;
  const canGoNext = month < currentMonth;

  const [year, mo] = month.split("-").map(Number);
  const monthLabel = `${monthNames[mo - 1]} ${year}`;

  const total = stats?.total || 0;
  const data =
    total > 0
      ? [
          { key: "present", value: stats.present },
          { key: "excused", value: stats.excused },
          { key: "absent", value: stats.absent },
          { key: "unmarked", value: stats.unmarked },
        ].filter((d) => d.value > 0)
      : [{ key: "unmarked", value: 1 }];

  const colorOf = {
    present: PRESENT_COLOR,
    excused: EXCUSED_COLOR,
    absent: ABSENT_COLOR,
    unmarked: UNMARKED_COLOR,
  };

  const rows = [
    {
      key: "present",
      label: t("group.attendancePresent"),
      pct: stats?.presentPercent ?? 0,
      count: stats?.present ?? 0,
    },
    {
      key: "excused",
      label: t("group.attendanceExcused"),
      pct: stats?.excusedPercent ?? 0,
      count: stats?.excused ?? 0,
    },
    {
      key: "absent",
      label: t("group.attendanceAbsent"),
      pct: stats?.absentPercent ?? 0,
      count: stats?.absent ?? 0,
    },
    {
      key: "unmarked",
      label: t("group.attendanceUnmarked"),
      pct: stats?.unmarkedPercent ?? 0,
      count: stats?.unmarked ?? 0,
    },
  ];
  const labelOf = Object.fromEntries(rows.map((r) => [r.key, r.label]));

  const navBtn =
    "size-9 sm:size-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors";

  const monthNav = (
    <div className="flex items-center gap-1 shrink-0 justify-between sm:justify-start max-sm:w-full">
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={() => setMonth((m) => shiftMonth(m, -1))}
        className={navBtn}
      >
        <HiChevronLeft />
      </button>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-20 text-center">
        {monthLabel}
      </span>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={() => setMonth((m) => shiftMonth(m, 1))}
        className={navBtn}
      >
        <HiChevronRight />
      </button>
    </div>
  );

  return (
    <ChartCard>
      <ChartHeader
        icon={<HiUserGroup />}
        tone="emerald"
        title={t("group.attendanceTitle")}
        subtitle={t("group.attendanceDesc")}
        right={<div className="max-sm:hidden">{monthNav}</div>}
      />
      <div className="sm:hidden -mt-1">{monthNav}</div>

      {loading ? (
        <>
          <div className="flex-1 min-h-32 max-h-56 grid place-items-center">
            <div className="aspect-square h-full max-h-40 rounded-full border-[14px] border-slate-100 dark:border-night-800 animate-pulse" />
          </div>
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-night-700 shrink-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="h-3.5 w-28 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
                <div className="h-3.5 w-10 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* max-h — donut `flex-1` bilan cheksiz cho'zilib, yonidagi
              kalendardan ham balandroq bo'lib ketardi. */}
          <div className="relative w-full flex-1 min-h-32 max-h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {total > 0 && (
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <ChartTip
                          rows={[
                            {
                              label: labelOf[payload[0].payload.key],
                              value: payload[0].value,
                              color: colorOf[payload[0].payload.key],
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                )}
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="80%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={total > 0 && data.length > 1 ? 3 : 0}
                  cornerRadius={6}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={colorOf[entry.key]}
                      opacity={total === 0 ? 0.15 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-space font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100">
                {stats?.presentPercent ?? 0}%
              </span>
              <span className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                {t("group.attendancePresent")}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-night-700 shrink-0">
            {rows.map((r) => (
              <div
                key={r.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0 text-slate-600 dark:text-slate-300">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf[r.key] }}
                  />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {r.pct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}

export default AttendanceDonut;
