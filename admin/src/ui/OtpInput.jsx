import { useRef, useEffect } from "react";

/**
 * OtpInput component
 *
 * @param {Object} props
 * @param {string} [props.value=""] - OTP qiymati (masalan: "1234")
 * @param {(value: string) => void} [props.onChange] - Qiymat o'zgarganda chaqiriladi
 * @param {number} [props.fields=4] - Inputlar soni
 * @param {string} [props.label] - Label matni
 * @param {boolean} [props.required=false] - Majburiy maydon
 * @param {boolean} [props.disabled=false] - Disabled holati
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="slate"] - Rang
 * @param {"slate"|"white"} [props.variant="slate"] - Orqa fon
 * @param {string} [props.className] - Qo'shimcha className
 * @returns {JSX.Element}
 */
function OtpInput({
  value = "",
  onChange = () => {},
  fields = 4,
  label = "",
  required = false,
  disabled = false,
  color = "slate",
  variant = "slate",
  className = "",
}) {
  const inputRefs = useRef([]);

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

  const digits = Array.from({ length: fields }, (_, i) => value[i] ?? "");

  const update = (index, char) => {
    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next.join(""));
  };

  const handleInput = (e, index) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    update(index, char);
    if (char && index < fields - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        update(index, "");
      } else if (index > 0) {
        update(index - 1, "");
        inputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < fields - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, fields);
    const next = Array.from({ length: fields }, (_, i) => pasted[i] ?? "");
    onChange(next.join(""));
    const focusIndex = Math.min(pasted.length, fields - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleFocus = (e) => e.target.select();

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <span className="pl-2 text-sm text-slate-800">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}

      <div className="flex items-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onFocus={handleFocus}
            onChange={(e) => handleInput(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            className={`
              w-10 h-10 text-center text-slate-800 font-semibold text-base
              outline-none rounded-xl border-2 duration-300
              focus:ring-2 caret-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${variants[variant]} ${colors[color]}
            `}
          />
        ))}
      </div>
    </div>
  );
}

export default OtpInput;
