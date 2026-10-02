import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import Loading from "../../ui/Loading";
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
        const res = await api.get(`/attendance/${groupId}/stats`, { params: { month } });
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

  return (
    <ChartCard>
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div>
          <p className="font-semibold text-slate-800">{t("group.attendanceTitle")}</p>
          <p className="text-xs text-slate-400">{t("group.attendanceDesc")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <HiChevronLeft />
          </button>
          <span className="text-xs font-medium text-slate-600 min-w-20 text-center">{monthLabel}</span>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <HiChevronRight />
          </button>
        </div>
      </div>

      {loading ? (
        <Loading height="15vh" />
      ) : (
        <>
          {/* max-h — donut `flex-1` bilan cheksiz cho'zilib, yonidagi
              kalendardan ham balandroq bo'lib ketardi. */}
          <div className="relative w-full flex-1 min-h-32 max-h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="70%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={total > 0 && data.length > 1 ? 3 : 0}
                  cornerRadius={6}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={colorOf[entry.key]} opacity={total === 0 ? 0.15 : 1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-space font-bold text-slate-800">
                {stats?.presentPercent ?? 0}%
              </span>
              <span className="text-xs text-slate-400">{t("group.attendancePresent")}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRESENT_COLOR }} />
                <span className="text-slate-600">{t("group.attendancePresent")}</span>
              </div>
              <span className="font-semibold text-slate-800">{stats?.presentPercent ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXCUSED_COLOR }} />
                <span className="text-slate-600">{t("group.attendanceExcused")}</span>
              </div>
              <span className="font-semibold text-slate-800">{stats?.excusedPercent ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ABSENT_COLOR }} />
                <span className="text-slate-600">{t("group.attendanceAbsent")}</span>
              </div>
              <span className="font-semibold text-slate-800">{stats?.absentPercent ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: UNMARKED_COLOR }} />
                <span className="text-slate-600">{t("group.attendanceUnmarked")}</span>
              </div>
              <span className="font-semibold text-slate-800">{stats?.unmarkedPercent ?? 0}%</span>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}

export default AttendanceDonut;
