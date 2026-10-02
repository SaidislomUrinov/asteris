import { HiCheck, HiExclamationCircle, HiQuestionMarkCircle, HiXMark } from "react-icons/hi2";

// Davomat uchun ALOHIDA katak — umumiy `ui/Checkbox` dan ataylab farqli:
// bu yerda uch xil holat (keldi / kelmadi / sababli) + dam olish va hali
// o'tmagan kun bor, ya'ni oddiy "belgilangan/belgilanmagan" yetmaydi.
//
// Ko'rinish `AttendanceStatusCell` (o'quvchilar ro'yxatidagi pill) bilan bir
// xil tilda: to'q to'ldirilgan kvadrat emas, yumshoq `color/10` fon + to'q
// ikonka + ichki `ring`. Matritsa shu tufayli "svetofor devori" bo'lib
// ko'rinmaydi, lekin holat baribir bir qarashda o'qiladi.
const TONE = {
  present: { icon: HiCheck, cls: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/30" },
  absent: { icon: HiXMark, cls: "bg-red-500/12 text-red-500 ring-red-500/30" },
  excused: { icon: HiExclamationCircle, cls: "bg-amber-500/15 text-amber-600 ring-amber-500/30" },
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
    ? "bg-violet-500/10 text-violet-500 ring-violet-500/25"
    : tone
      ? tone.cls
      : future
        ? // Hali o'tmagan kun — deyarli ko'rinmas, faqat "joy band" belgisi.
          "bg-slate-50 text-transparent ring-slate-200/70"
        : // Belgilanmagan o'tgan kun — bosiladigan bo'sh katak.
          "bg-slate-100 text-transparent ring-slate-200";

  return (
    <button
      type="button"
      title={title}
      disabled={locked}
      onClick={onClick}
      className={`flex items-center justify-center shrink-0 w-8 h-8 rounded-xl ring-1 ring-inset text-base transition-all duration-150 ${className} ${look} ${
        locked ? "cursor-default" : "cursor-pointer hover:brightness-95 active:scale-90"
      }`}
    >
      {Icon ? <Icon className="shrink-0" /> : null}
    </button>
  );
}

export default AttendanceCheckbox;
