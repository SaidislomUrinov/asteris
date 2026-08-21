import { HiCheck, HiExclamationCircle, HiQuestionMarkCircle, HiXMark } from "react-icons/hi2";

// Davomat uchun ALOHIDA katak — umumiy `ui/Checkbox` dan ataylab farqli:
// bu yerda uch xil holat (keldi / kelmadi / sababli) + dam olish va hali
// o'tmagan kun bor, ya'ni oddiy "belgilangan/belgilanmagan" yetmaydi.
//
// Belgilanmagan holatda fon `slate-200` — jadval ichida katak borligi va
// bosilishi mumkinligi darhol ko'rinadi (oq katak qator fonida yo'qolib
// ketardi).
const TONE = {
  present: { icon: HiCheck, cls: "bg-emerald-500 text-white border-emerald-500" },
  absent: { icon: HiXMark, cls: "bg-red-500 text-white border-red-500" },
  excused: { icon: HiExclamationCircle, cls: "bg-amber-500 text-white border-amber-500" },
};

/**
 * @param {Object} props
 * @param {"present"|"absent"|"excused"|null} props.status
 * @param {boolean} [props.holiday] - dam olish kuni (savol belgisi, bosilmaydi)
 * @param {boolean} [props.future] - dars hali o'tmagan (bosilmaydi)
 * @param {boolean} [props.disabled] - ruxsat yo'q
 * @param {string} props.title - hover izohi
 * @param {(e: MouseEvent) => void} props.onClick
 * @param {string} [props.className] - joylashuv uchun (masalan jadvalda `mx-auto`)
 */
function AttendanceCheckbox({ status, holiday, future, disabled, title, onClick, className = "" }) {
  const tone = holiday ? null : status ? TONE[status] : null;
  const Icon = holiday ? HiQuestionMarkCircle : tone?.icon;
  const locked = disabled || holiday || future;

  const look = holiday
    ? "bg-violet-100 border-violet-300 text-violet-500"
    : tone
      ? tone.cls
      : future
        ? "bg-slate-100 border-slate-200 text-transparent"
        : "bg-slate-200 border-slate-300 text-transparent";

  return (
    <button
      type="button"
      title={title}
      disabled={locked}
      onClick={onClick}
      className={`flex items-center justify-center shrink-0 w-7 h-7 rounded-md border text-[15px] transition-all duration-150 ${className} ${look} ${
        locked
          ? "cursor-default"
          : "cursor-pointer hover:border-slate-400 hover:brightness-95 active:scale-95"
      }`}
    >
      {Icon ? <Icon /> : null}
    </button>
  );
}

export default AttendanceCheckbox;
