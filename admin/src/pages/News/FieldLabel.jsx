export default function FieldLabel({ children, required = false, hint, counter }) {
  return (
    <div className="flex items-end justify-between gap-2 px-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-800">
          {children}
          {required && <span className="text-red-500">*</span>}
        </span>
        {hint && <span className="text-[12px] text-slate-400">{hint}</span>}
      </div>
      {counter && <span className="text-[12px] text-slate-400 tabular-nums shrink-0">{counter}</span>}
    </div>
  );
}
