/**
 * Ro'yxat qatoridagi tartib raqami (1, 2, 3...) — o'quvchilar ro'yxati va
 * davomat/baho matritsalarida bir xil ko'rinishi uchun. Kenglik sobit va
 * raqamlar `tabular-nums` — 9 dan 10 ga o'tganda ism ustuni surilmaydi.
 * Telefonda (< sm) ko'rsatilmaydi — u yerda ro'yxat kartalardan iborat va
 * o'quvchini raqam bilan sanash shart emas.
 *
 * @param {Object} props
 * @param {number} props.value
 */
function RowNumber({ value }) {
  return (
    <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500 max-sm:hidden">
      {value}
    </span>
  );
}

export default RowNumber;
