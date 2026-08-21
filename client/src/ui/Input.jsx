/**
 * Input component
 *
 * @param {Object} props
 * @param {string} [props.value] - Input qiymati
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange] - Change handler
 * @param {string} [props.label] - Input label
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required=false] - Majburiy maydon
 * @param {boolean} [props.disabled=false] - Input o'chiq holati
 * @param {'text'|'tel'|'number'|'password'|'color'} [props.type='text'] - Input type
 * @param {React.ReactNode} [props.icon] - Input icon (masalan: <HiUser />)
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Focus ring rangi
 * @param {"slate"|"white"} [props.variant="slate"] - Input orqa foni
 * @param {string} [props.className] - Qo'shimcha className
 *
 * @returns {JSX.Element}
 */
function Input({
  value = "",
  onChange = () => {},
  label = "",
  placeholder = "",
  required = false,
  disabled = false,
  icon = null,
  className = "",
  type = "text",
  color = "blue",
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
        {icon && (
          <span className="absolute right-2 text-slate-500">{icon}</span>
        )}

        <input
          type={type}
          className={`${className} duration-300 w-full h-10 outline-none rounded-xl pl-2 ${
            icon ? "pr-6" : "pr-2"
          } focus:ring-2 border ${variants[variant]} ${colors[color]} disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 placeholder:text-slate-400`}
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

export default Input;
