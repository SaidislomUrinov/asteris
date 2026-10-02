import { useState } from "react";

/**
 * 24-soatlik vaqt kiritish maydoni ("HH:MM", masalan 00:00-23:59).
 *
 * Native `<input type="time">`ning AM/PM yoki 24-soatlik ko'rinishi
 * brauzer/OS locale'iga bog'liq va `lang` atributi orqali ham ishonchli
 * majburlab bo'lmaydi (Chromium'da sinab ko'rilgan — e'tiborsiz qoldiradi).
 * Shu sabab har doim 24-soatlik formatni kafolatlash uchun oddiy matn
 * maydoni sifatida, o'zi raqamlarni "HH:MM"ga formatlab, soat/daqiqani
 * 0-23/0-59 oralig'iga qisqartirib beradi. `onChange` Input.jsx bilan bir
 * xil `{ target: { value } }` shaklida chaqiriladi — drop-in almashtirish.
 */
function TimeInput({
  value = "",
  onChange = () => {},
  label = "",
  placeholder = "--:--",
  required = false,
  disabled = false,
  icon = null,
  className = "",
  color = "blue",
  variant = "slate",
}) {
  const colors = {
    emerald: "focus:border-emerald-500 ring-emerald-500/15",
    blue: "focus:border-blue-500 ring-blue-500/15",
    black: "focus:border-slate-900 ring-slate-900/10",
    red: "focus:border-red-500 ring-red-500/15",
    orange: "focus:border-orange-500 ring-orange-500/15",
    yellow: "focus:border-yellow-500 ring-yellow-500/20",
    slate: "focus:border-slate-500 ring-slate-500/15",
  };

  const variants = {
    slate: "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    white: "bg-white border-slate-200",
  };

  const digitsFromValue = (v) => (v || "").replace(/\D/g, "").slice(0, 4);
  const format = (d) => (d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`);
  const clampSegment = (seg, max) => {
    if (seg.length < 2) return seg;
    return String(Math.min(max, parseInt(seg, 10) || 0)).padStart(2, "0");
  };

  const [digits, setDigits] = useState(digitsFromValue(value));

  // Tashqaridan (masalan dialog reset yoki boshqa manbadan) `value` o'zgarsa
  // ko'rsatilayotgan raqamlar ham moslashadi.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDigits(digitsFromValue(value));
  }

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    const hh = clampSegment(raw.slice(0, 2), 23);
    const mm = clampSegment(raw.slice(2, 4), 59);
    const newDigits = hh + mm;
    setDigits(newDigits);
    onChange({ target: { value: format(newDigits) } });
  };

  // Maydondan chiqishda: bitta digit qolgan bo'lsa old bilan "0" to'ldiriladi
  // (masalan "9" -> "09:00") — native picker'dagi kabi qulay yakunlanish.
  const handleBlur = () => {
    if (!digits) return;
    const hh = digits.slice(0, 2).padStart(2, "0");
    const mm = digits.slice(2, 4).padStart(2, "0");
    const newDigits = hh + mm;
    setDigits(newDigits);
    onChange({ target: { value: `${hh}:${mm}` } });
  };

  return (
    <label className="flex flex-col gap-1 w-full">
      {label && (
        <span className="text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>
      )}

      <div className="relative flex items-center w-full">
        {icon && <span className="absolute right-3.5 text-slate-400 text-[15px]">{icon}</span>}

        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          className={`${className} duration-200 w-full h-11 outline-none rounded-xl pl-3.5 ${
            icon ? "pr-9" : "pr-3.5"
          } focus:ring-3 hover:border-slate-300 border ${variants[variant]} ${colors[color]} disabled:bg-slate-50 disabled:shadow-none disabled:text-slate-400 disabled:cursor-not-allowed text-[13px] text-slate-900 placeholder:text-slate-400`}
          value={format(digits)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </label>
  );
}

export default TimeInput;
