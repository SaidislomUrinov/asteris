import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiStar } from "react-icons/hi2";

// Baho rangi — GradesTab bilan bir xil oila (5/4 yashil-ko'k, 3 sariq, past qizil).
const toneOf = (avg) =>
  avg >= 4.5
    ? "text-emerald-600"
    : avg >= 3.5
      ? "text-blue-600"
      : avg >= 2.5
        ? "text-amber-600"
        : "text-red-500";

/**
 * O'quvchining BITTA guruh bo'yicha baho xulosasi.
 *
 * "4.5 / 5" ko'rinishida umumiy o'rtacha, ochilganda esa FAQAT baho
 * qo'yilgan oylar kesimida (o'quvchi o'qimagan oylar ro'yxatga tushmaydi).
 *
 * @param {Object} props
 * @param {{average:number,count:number,months:Array}} [props.summary]
 */
function GradeSummary({ summary }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const monthNames = t("common.monthNames", { returnObjects: true });

  if (!summary || !summary.count) {
    return (
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50">
        <span className="text-xs text-slate-400">{t("grade.title")}</span>
        <span className="text-sm text-slate-400">{t("grade.noGrades")}</span>
      </div>
    );
  }

  const label = (month) => {
    const [y, m] = month.split("-").map(Number);
    return `${monthNames[m - 1]} ${y}`;
  };

  return (
    <div className="flex flex-col rounded-lg bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between gap-2 p-2.5 text-left cursor-pointer hover:bg-slate-100/70 transition-colors"
      >
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-slate-400">{t("grade.title")}</span>
          <span className="flex items-baseline gap-1">
            <HiStar className={`self-center ${toneOf(summary.average)}`} />
            <span className={`text-sm font-semibold ${toneOf(summary.average)}`}>
              {summary.average}
            </span>
            <span className="text-xs text-slate-400">/ 5</span>
            <span className="text-[11px] text-slate-400">
              ({t("grade.countShort", { count: summary.count })})
            </span>
          </span>
        </span>
        <HiChevronDown
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col border-t border-slate-200/70">
          {summary.months.map((m) => (
            <div
              key={m.month}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-200/50 last:border-0"
            >
              <span className="text-xs text-slate-500 capitalize truncate">{label(m.month)}</span>
              <span className="flex items-baseline gap-1 shrink-0">
                <span className={`text-[13px] font-semibold ${toneOf(m.average)}`}>
                  {m.average}
                </span>
                <span className="text-[11px] text-slate-400">/ 5</span>
                <span className="text-[11px] text-slate-300 tabular-nums">({m.count})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GradeSummary;
