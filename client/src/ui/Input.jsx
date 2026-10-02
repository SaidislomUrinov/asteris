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
 * @param {string} [props.prefix] - O'zgarmas prefiks (masalan: "+998"), inputning tahrirlanadigan qismidan oldin ko'rsatiladi
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Focus ring rangi
 * @param {"slate"|"white"} [props.variant="slate"] - Maydon qobig'i: `slate` — yengil soyali (standart),
 *   `white` — soyasiz tekis (allaqachon ko'tarilgan yuza ustida ishlatiladi)
 * @param {boolean} [props.error=false] - Xato holati (qizil chegara + halqa)
 * @param {string} [props.hint] - Maydon ostidagi izoh; `error` bo'lsa qizil ko'rinadi
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
  prefix = "",
  className = "",
  type = "text",
  color = "blue",
  variant = "slate",
  error = false,
  hint = "",
  ...props
}) {
  // Fokusda chegara komponent rangiga o'tadi va atrofida shaffof halqa paydo
  // bo'ladi. Halqa `ring-*/15` — to'q emas, yumshoq: maydon "yoritiladi",
  // lekin qatordagi qo'shni maydonlarni bosib ketmaydi.
  const colors = {
    emerald: "focus-within:border-emerald-500 ring-emerald-500/15",
    blue:    "focus-within:border-blue-500 ring-blue-500/15",
    black:   "focus-within:border-slate-900 ring-slate-900/10",
    red:     "focus-within:border-red-500 ring-red-500/15",
    orange:  "focus-within:border-orange-500 ring-orange-500/15",
    yellow:  "focus-within:border-yellow-500 ring-yellow-500/20",
    slate:   "focus-within:border-slate-500 ring-slate-500/15",
  };

  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
    // Faqat FilterBar ichida: Select `variant="filter"` bilan bir xil tekis
    // ko'rinish, qidiruv maydoni toolbar qatoriga vizual mos tursin uchun.
    filter: "bg-white border-slate-200",
  };

  return (
    <label className="flex flex-col gap-1.5 w-full">
      {label && (
        <span className="text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>
      )}

      <div
        className={`input-wrap relative flex items-center w-full h-11 rounded-xl border transition-colors duration-200 focus-within:ring-3 ${
          error
            ? "border-rose-500 ring-rose-500/12 bg-white"
            : `hover:border-slate-300 ${variants[variant]} ${colors[color]}`
        } ${
          disabled
            ? "bg-slate-50 border-slate-200 shadow-none cursor-not-allowed"
            : ""
        }`}
      >
        {icon && (
          <span className="absolute right-3.5 text-slate-400 text-[15px]">
            {icon}
          </span>
        )}

        {/* Prefiks (masalan "+998") — tahrirlanmaydi, inputdan alohida
            statik matn sifatida chiziladi, shu sabab foydalanuvchi uni
            hech qachon backspace bilan o'chira olmaydi. */}
        {prefix && (
          <span className="pl-3.5 text-[13px] text-slate-500 select-none shrink-0">{prefix}</span>
        )}

        <input
          type={type}
          className={`${className} w-full h-full bg-transparent outline-none ${
            prefix ? "pl-1.5" : "pl-3.5"
          } ${
            icon ? "pr-9" : "pr-3.5"
          } disabled:cursor-not-allowed text-[13px] text-slate-900 disabled:text-slate-400 placeholder:text-slate-400`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          {...props}
        />
      </div>

      {hint && (
        <span className={`text-[11px] ${error ? "text-rose-600" : "text-slate-400"}`}>
          {hint}
        </span>
      )}
    </label>
  );
}

export default Input;
