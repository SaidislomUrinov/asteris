// Davomat/Baholar matritsalari uchun skeleton.
//
// Nega spinner emas: spinner balandligi kontent balandligiga bog'liq emas,
// shuning uchun yuklanish tugagach blok birdan cho'zilib, sahifa "sakrab"
// ketardi. Skeleton esa AYNAN shu jadval shaklida (sarlavha + o'quvchilar
// soniga teng qator) chiziladi — yuklanish tugaganda balandlik deyarli
// o'zgarmaydi.
//
// O'lchamlar haqiqiy jadvaldan olingan: sarlavha 47px, qator 49–52px.
function MatrixSkeleton({ rows = 6, rowHeight = 50 }) {
  return (
    <div className="w-full rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 h-[47px] px-3 bg-slate-50 border-b border-slate-200">
        <span className="w-24 h-2.5 rounded bg-slate-200/70 animate-pulse" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3 border-b border-slate-100 last:border-b-0"
          style={{ height: rowHeight }}
        >
          <span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          <span className="w-28 h-2.5 rounded bg-slate-100 animate-pulse" />
          <span className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((__, j) => (
              <span key={j} className="w-7 h-7 rounded-md bg-slate-100 animate-pulse" />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default MatrixSkeleton;
