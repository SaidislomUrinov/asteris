/**
 * Textarea component
 *
 * @param {Object} props
 * @param {string} [props.value] - Textarea qiymati
 * @param {(event: React.ChangeEvent<HTMLTextAreaElement>) => void} [props.onChange] - Change handler
 * @param {string} [props.label] - Textarea label
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required=false] - Majburiy maydon
 * @param {boolean} [props.disabled=false] - Textarea o'chiq holati
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Focus ring rangi
 * @param {"slate"|"white"} [props.variant="slate"] - Textarea orqa foni
 * @param {string} [props.className] - Qo'shimcha className
 *
 * @returns {JSX.Element}
 */
function Textarea({
  value = "",
  onChange = () => {},
  label = "",
  placeholder = "",
  required = false,
  disabled = false,
  className = "",
  color = "blue",
  variant = "slate",
  ...props
}) {
  const colors = {
    emerald: "focus:border-emerald-500 ring-emerald-500/15",
    blue:    "focus:border-blue-500 ring-blue-500/15",
    black:   "focus:border-slate-900 ring-slate-900/10",
    red:     "focus:border-red-500 ring-red-500/15",
    orange:  "focus:border-orange-500 ring-orange-500/15",
    yellow:  "focus:border-yellow-500 ring-yellow-500/20",
    slate:   "focus:border-slate-500 ring-slate-500/15",
  };

  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
  };

  return (
    <label className="flex flex-col gap-1.5 w-full">
      {label && (
        <span className="text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>
      )}

      <div className="relative flex items-center w-full">
        <textarea
          className={`${className} duration-200 min-w-full max-w-full max-h-50 min-h-33 outline-none rounded-xl px-3.5 py-3 focus:ring-3 hover:border-slate-300 border leading-relaxed ${variants[variant]} ${colors[color]} disabled:bg-slate-50 disabled:shadow-none disabled:text-slate-400 disabled:cursor-not-allowed text-[13px] text-slate-900 placeholder:text-slate-400`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          {...props}
        />
      </div>
    </label>
  );
}

export default Textarea;
