// Kichik segment tanlagich (Daraja, Kimga, resurs turi) — `ui/` da yo'q,
// shuning uchun News ichida lokal.
export default function SegmentControl({ value, onChange, options, size = "md" }) {
  const pad = size === "sm" ? "h-8 px-3 text-[12px]" : "h-10 px-4 text-[13px]";
  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 max-w-full">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg font-semibold duration-150 cursor-pointer ${pad} ${
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
