// Bosh sahifalarning umumiy sarlavha paneli (Dashboard uslubi).
// `icon` — chapdagi amber ikonka; `leading` berilsa ikonka o'rniga (masalan avatar).
// Matn mobilda kesilmaydi — 2 qatorgacha o'raladi (uzun ism/salomlashuv).
// `toggle` — sarlavha yonidagi tugma (HideFinanceToggle), `children` — o'ngdagi filtrlar.
function DashboardHeader({ icon, leading, title, subtitle, toggle, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
        {leading || (
          <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-amber-50 text-amber-500 text-lg">
            {icon}
          </span>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-space font-bold leading-tight text-slate-900 line-clamp-2 break-words">{title}</span>
          {subtitle && <span className="text-sm leading-snug text-slate-500 line-clamp-2">{subtitle}</span>}
        </div>
        {toggle}
      </div>
      {children}
    </div>
  );
}

export default DashboardHeader;
