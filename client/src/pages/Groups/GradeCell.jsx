import { useTranslation } from "react-i18next";
import { HiPlusCircle, HiTrash, HiXMark } from "react-icons/hi2";
import { toneOf, VALUE_ROWS } from "./gradeTone";

/**
 * Ro'yxat qatoridagi BUGUNGI baho katagi (O'qituvchi/Yordamchi) —
 * docs/API_CONTRACT_group_simple_view.md §2. Ochilish naqshi davomat katagi
 * (`AttendanceStatusCell`) bilan bir xil: yopiq — pill, ochiq — joyida tanlov.
 *
 * @param {Object} props
 * @param {number|undefined} props.value - bugungi baho
 * @param {boolean} props.canWrite - bugun dars kuni va yozish huquqi bor
 * @param {boolean} props.blocked - bugun kelmagan/sababli (baho qo'yilmaydi)
 * @param {boolean} props.open
 * @param {boolean} props.saving
 * @param {() => void} props.onOpen
 * @param {() => void} props.onClose
 * @param {(value: number) => void} props.onPick
 * @param {() => void} props.onRemove
 */
export default function GradeCell({ value, canWrite, blocked, open, saving, onOpen, onClose, onPick, onRemove }) {
  const { t } = useTranslation();
  const has = value != null;

  if (!canWrite || blocked) {
    return has ? (
      <span className={`inline-flex items-center justify-center w-9 h-8 rounded-full ring-1 ring-inset text-sm font-bold tabular-nums ${toneOf(value)}`}>
        {value}
      </span>
    ) : (
      <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
    );
  }

  if (open) {
    const pick = (v) => (
      <button
        key={v}
        type="button"
        disabled={saving}
        onClick={() => onPick(v)}
        className={`flex items-center justify-center h-7 rounded-lg ring-1 ring-inset text-sm font-bold tabular-nums cursor-pointer disabled:opacity-50 hover:brightness-95 active:scale-90 transition-all ${toneOf(v)} ${
          value === v ? "ring-2" : ""
        }`}
      >
        {v}
      </button>
    );
    const [top, bottom] = VALUE_ROWS;
    // Ixcham tanlov: 6x2 to'r — yuqori qator 10..6 + yopish (x), pastki qator
    // 5..1 + "Bahoni olib tashlash" (urna, faqat baho bor bo'lsa). Qo'shimcha
    // qator yo'q: qator balandligi 2 katak (60px). Kenglik 216px bilan
    // cheklangan — desktop ustuniga (176px) va 320px telefonga ham sig'adi.
    return (
      <div className="grid grid-cols-6 gap-1 w-full max-w-[216px]">
        {top.map(pick)}
        <button
          type="button"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
          className="flex items-center justify-center h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 cursor-pointer transition-colors"
        >
          <HiXMark className="text-base" />
        </button>
        {bottom.map(pick)}
        {has ? (
          <button
            type="button"
            disabled={saving}
            title={t("grade.remove")}
            aria-label={t("grade.remove")}
            onClick={onRemove}
            className="flex items-center justify-center h-7 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <HiTrash className="text-base" />
          </button>
        ) : (
          <span />
        )}
      </div>
    );
  }

  return has ? (
    <button
      type="button"
      onClick={onOpen}
      title={t("grade.pickValue")}
      className={`inline-flex items-center justify-center w-9 h-8 rounded-full ring-1 ring-inset text-sm font-bold tabular-nums cursor-pointer hover:brightness-95 transition-all ${toneOf(value)}`}
    >
      {value}
    </button>
  ) : (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-700 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
    >
      <HiPlusCircle className="text-base shrink-0" />
      {t("grade.add")}
    </button>
  );
}
