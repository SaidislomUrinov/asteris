import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { Card, Divider } from "./Card";
import { fmtMonth, todayStr } from "../utils/format";
import { cn } from "../utils/cn";

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// days: [{date, status, late}], lessonDays: ["YYYY-MM-DD"]
export const AttendanceCalendar = ({ month, days = [], lessonDays = [], onMonthChange, onSelectDay, selected, loading }) => {
  const { t } = useTranslation();
  const today = todayStr();

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = (first.getDay() + 6) % 7; // Du=0
    const total = new Date(y, m, 0).getDate();
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    const lessons = new Set(lessonDays);
    const out = [];
    for (let i = 0; i < startDow; i++) out.push(null);
    for (let d = 1; d <= total; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      out.push({ d, date, rec: byDate[date], lesson: lessons.has(date), isToday: date === today });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [month, days, lessonDays, today]);

  const cls = (c) => {
    if (!c.rec) {
      if (c.isToday) return "ring-2 ring-inset ring-accent text-accent";
      if (c.lesson && c.date < today) return "bg-ink/6 text-hint"; // dars kuni, belgilanmagan
      if (c.lesson) return "text-ink font-bold";
      return "text-hint/60";
    }
    const base =
      c.rec.status === "present" ? "bg-ok-bg text-ok" :
      c.rec.status === "absent" ? "bg-bad-bg text-bad" :
      c.rec.status === "excused" ? "bg-warn-bg text-warn" : "text-hint";
    return cn(base, c.rec.late && "ring-2 ring-inset ring-late", c.isToday && "ring-2 ring-inset ring-accent");
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(-1)} className="p-1.5 -m-1.5 text-hint active:opacity-60" aria-label={t("common.prevMonth")}>
          <HiChevronLeft className="w-5 h-5" />
        </button>
        <div className="font-extrabold">{fmtMonth(month)}</div>
        <button type="button" onClick={() => onMonthChange(1)} className="p-1.5 -m-1.5 text-hint active:opacity-60" aria-label={t("common.nextMonth")}>
          <HiChevronRight className="w-5 h-5" />
        </button>
      </div>
      <Divider />
      <div className={cn("grid grid-cols-7 gap-1 text-center", loading && "opacity-50")}>
        {WEEK.map((w) => (
          <div key={w} className="text-[10px] font-bold text-hint uppercase py-1">{t(`days.${w}`)}</div>
        ))}
        {cells.map((c, i) =>
          c ? (
            <button
              key={c.date}
              type="button"
              onClick={() => (c.rec || c.lesson) && onSelectDay?.(c)}
              className={cn(
                "aspect-square rounded-lg grid place-items-center text-[13px] font-bold tabular",
                cls(c),
                selected === c.date && "outline-2 outline-offset-1 outline-ink/40",
              )}
            >
              {c.d}
            </button>
          ) : (
            <div key={`x${i}`} />
          ),
        )}
      </div>
      <Divider />
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-hint">
        <Legend color="bg-ok" label={t("att.present")} />
        <Legend color="ring-2 ring-inset ring-late" label={t("att.late")} />
        <Legend color="bg-warn" label={t("att.excused")} />
        <Legend color="bg-bad" label={t("att.absent")} />
        <Legend color="ring-2 ring-inset ring-accent" label={t("att.today")} />
        <Legend color="bg-ink/15" label={t("att.notMarked")} />
      </div>
    </Card>
  );
};

const Legend = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={cn("w-2.5 h-2.5 rounded-[3px] inline-block", color)} />
    {label}
  </span>
);
