// Bo'lim sarlavhasi — kichik, uppercase, keng harf oralig'i (parent WebApp
// uslubi). Dashboard kabi ko'p bo'limli sahifalarda har blok nima ekanini
// darhol aytib beradi, ko'zni charchatmaydi.
function SectionLabel({ children, right, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-2 px-0.5 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {children}
      </span>
      {right}
    </div>
  );
}

export default SectionLabel;
