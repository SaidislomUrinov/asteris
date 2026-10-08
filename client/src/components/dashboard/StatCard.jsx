import NumberText from "../../ui/NumberText";

// Ikkilamchi hisoblagichlar — ixcham oq kartalar, moliyaviy bloklardan
// aniq past darajada turadi. `hint` ixtiyoriy (qo'shimcha kontekst qatori).
// Mobilda (2 ustunli grid) yozuv kesilmasin — `truncate` emas, 2 qatorgacha
// o'raladi ("Bugungi dar…" muammosi); `h-full` qo'shni kartalarni tenglaydi.
function StatCard({ icon, label, value, color, hint }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 h-full p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none transition-colors hover:border-slate-300 dark:hover:border-night-600 min-w-0">
      <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg text-lg sm:text-xl ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <NumberText className="text-lg leading-none">{value}</NumberText>
        <span className="mt-0.5 text-xs leading-snug text-slate-400 dark:text-slate-500 line-clamp-2">{label}</span>
        {hint && <span className="text-[11px] leading-snug text-slate-400/80 dark:text-slate-500/80 line-clamp-2">{hint}</span>}
      </div>
    </div>
  );
}

export default StatCard;
