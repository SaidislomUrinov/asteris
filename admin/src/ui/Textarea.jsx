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
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="slate"] - Focus ring rangi
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
  color = "slate",
  variant = "slate",
  ...props
}) {
  const colors = {
    emerald: "focus:border-emerald-500 ring-emerald-500",
    blue:    "focus:border-blue-500 ring-blue-500",
    black:   "focus:border-black ring-black",
    red:     "focus:border-red-500 ring-red-500",
    orange:  "focus:border-orange-500 ring-orange-500",
    yellow:  "focus:border-yellow-500 ring-yellow-500",
    slate:   "focus:border-slate-500 ring-slate-500",
  };

  const variants = {
    slate: "bg-slate-100 border-slate-200",
    white: "bg-white border-slate-200",
  };

  return (
    <label className="flex flex-col gap-1 w-full">
      {label && (
        <span className="pl-2 text-sm text-slate-800">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}

      <div className="relative flex items-center w-full">
        <textarea
          className={`${className} duration-300 min-w-full max-w-full max-h-50 min-h-50 outline-none rounded-xl px-2 focus:ring-2 border ${variants[variant]} ${colors[color]} disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 placeholder:text-slate-400`}
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
