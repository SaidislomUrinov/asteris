// Grafik kartalarining umumiy sarlavhasi: rangli ikonka + nom + izoh, o'ngda
// ixtiyoriy boshqaruv (katakcha, oy tanlovi). Ilovadagi panellar (Ish haqi,
// Tranzaksiyalar) bilan bir xil o'lcham va ohang.
const TONES = {
  emerald: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  rose: "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function ChartHeader({ icon, tone = "blue", title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className={`grid place-items-center size-8 shrink-0 rounded-lg ${TONES[tone]}`}>{icon}</span>}
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-slate-800 dark:text-slate-100 truncate">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default ChartHeader;
