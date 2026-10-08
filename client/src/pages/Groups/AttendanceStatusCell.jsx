import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiDocumentText,
  HiExclamationCircle,
  HiPlusCircle,
  HiXCircle,
} from "react-icons/hi2";

/**
 * Davomat holati va qarzdorlik "chip"lari — ko'rinish website'dagi
 * `PanelShowcase` bo'limi bilan bir xil tilda: qutili chegara emas, balki
 * ikonka + yumshoq (color/10) fonli to'liq yumaloq pill.
 *
 * GroupDetail (`/groups/:id`) va Lesson (`/lesson`) sahifalari AYNAN shu
 * komponentlarni ishlatadi — ikkalasida bir xil ko'rinishi shart.
 */

const STATUS_STYLE = {
  present: { Icon: HiCheckCircle, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" },
  absent: { Icon: HiXCircle, cls: "bg-red-500/10 text-red-500 hover:bg-red-500/20" },
  excused: { Icon: HiDocumentText, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20" },
};

const LABEL_KEY = {
  present: "group.attendancePresentShort",
  absent: "group.attendanceAbsentShort",
  excused: "group.attendanceExcusedShort",
};

const PILL_BASE =
  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap";

/** Qarzdorlik pill'i — website'dagi "Qarzdor" belgisi bilan bir xil. */
export function DebtPill() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-500 whitespace-nowrap">
      <HiExclamationCircle className="text-sm shrink-0" />
      {t("student.debtChip")}
    </span>
  );
}

/**
 * Bitta o'quvchi qatoridagi davomat katagi.
 * - dars kuni emas → xira matn
 * - tanlov ochiq → uchta holat pill'i (Keldi / Kelmadi / Sababli)
 * - aks holda → joriy holat pill'i (bosilsa tanlov ochiladi)
 */
export default function AttendanceStatusCell({
  status,
  isToday,
  open,
  onOpen,
  onMark,
  onExcuse,
}) {
  const { t } = useTranslation();

  if (!isToday)
    return <span className="text-xs text-slate-300 dark:text-slate-600">{t("group.attendanceNotToday")}</span>;

  if (open)
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {["present", "absent", "excused"].map((key) => {
          const { Icon, cls } = STATUS_STYLE[key];
          return (
            <button
              key={key}
              type="button"
              title={t(LABEL_KEY[key])}
              onClick={() => (key === "excused" ? onExcuse() : onMark(key))}
              className={`inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full transition-colors cursor-pointer shrink-0 ${cls}`}
            >
              <Icon className="text-base shrink-0" />
            </button>
          );
        })}
      </div>
    );

  const style = STATUS_STYLE[status];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${PILL_BASE} ${
        style ? style.cls : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-night-700"
      }`}
    >
      {style ? <style.Icon className="text-base shrink-0" /> : <HiPlusCircle className="text-base shrink-0" />}
      {style ? t(LABEL_KEY[status]) : t("group.attendanceButton")}
    </button>
  );
}
