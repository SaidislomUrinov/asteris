import { useTranslation } from "react-i18next";

// 1–3 o'rin medal ranglarida, qolganlari neytral.
const RANK_CHIP = {
  1: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400",
  2: "bg-slate-200 dark:bg-night-700 text-slate-700 dark:text-slate-300",
  3: "bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400",
};

/**
 * Telefondagi o'quvchi kartasida reytingdagi o'rin ("1-o'rin") belgisi —
 * RankMedal + MiniBadges o'rniga, ism qisqarmasligi uchun telefon raqami
 * oldida turadi. Faqat < sm da ko'rinadi. Guruh detali va /lesson umumiy.
 *
 * @param {Object} props
 * @param {number|null|undefined} props.position
 */
function RankChip({ position }) {
  const { t } = useTranslation();
  if (!position) return null;
  return (
    <span
      className={`sm:hidden shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums leading-none whitespace-nowrap ${
        RANK_CHIP[position] || "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300"
      }`}
    >
      {t("rank.medal", { position })}
    </span>
  );
}

export default RankChip;
