/**
 * Guruh detalidagi grafik/kalendar kartalari uchun umumiy qobiq (tushum
 * grafigi, to'lov va davomat donutlari, dars kalendari) — padding, chegara va
 * balandlik bir joyda, to'rttasi hech qachon bir-biridan farq qilib qolmaydi.
 */
function ChartCard({ children, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full ${className}`}
    >
      {children}
    </div>
  );
}

export default ChartCard;
