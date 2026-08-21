/**
 * Sozlamalar bo'limi uchun umumiy o'ram — sarlavha, izoh, kontent va pastki amallar.
 */
export default function Section({ title, description, actions, children }) {
  return (
    <div className="flex flex-col w-full bg-white border border-slate-200 rounded-xl">
      {(title || description) && (
        <div className="flex flex-col gap-1 px-4 pt-4 pb-3 border-b border-slate-100">
          {title && (
            <span className="text-[15px] font-semibold text-slate-800">{title}</span>
          )}
          {description && (
            <span className="text-[12px] text-slate-400 leading-relaxed">
              {description}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col w-full p-4 gap-3">{children}</div>

      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2 w-full px-4 py-3 bg-zinc-50 border-t border-slate-100 rounded-b-xl">
          {actions}
        </div>
      )}
    </div>
  );
}
