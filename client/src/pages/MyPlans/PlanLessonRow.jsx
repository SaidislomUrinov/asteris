import { useTranslation } from "react-i18next";
import { HiArrowDown, HiArrowUp, HiPencilSquare, HiTrash } from "react-icons/hi2";
import IconButton from "../../ui/IconButton";
import DropMenu from "../../ui/DropMenu";

/**
 * Reja muharriridagi bitta dars qatori.
 *
 * @param {Object} props
 * @param {{_id, title, description, homework}} props.lesson
 * @param {number} props.no - butun reja bo'ylab tartib raqami
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {boolean} props.wide - katta ekran: ko'chirish tugmalari ko'rinadi
 * @param {boolean} props.disabled - saqlanayotganda
 * @param {boolean} props.showHomework
 * @param {() => void} props.onEdit
 * @param {() => void} props.onDelete
 * @param {(delta: number) => void} props.onMove
 */
function PlanLessonRow({
  lesson,
  no,
  isFirst,
  isLast,
  wide,
  disabled,
  showHomework,
  onEdit,
  onDelete,
  onMove,
}) {
  const { t } = useTranslation();

  const menuItems = [
    {
      label: t("common.edit"),
      icon: HiPencilSquare,
      iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
      onClick: onEdit,
    },
    ...(wide
      ? []
      : [
          {
            label: t("teachingPlan.moveUp"),
            icon: HiArrowUp,
            iconClass: "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300",
            disabled: isFirst || disabled,
            onClick: () => onMove(-1),
          },
          {
            label: t("teachingPlan.moveDown"),
            icon: HiArrowDown,
            iconClass: "bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300",
            disabled: isLast || disabled,
            onClick: () => onMove(1),
          },
        ]),
    {
      label: t("common.delete"),
      icon: HiTrash,
      iconClass: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
      onClick: onDelete,
    },
  ];

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 border-b border-slate-50 dark:border-night-700 last:border-b-0">
      <span className="flex items-center justify-center w-7 h-7 shrink-0 mt-0.5 rounded-lg bg-slate-100 dark:bg-night-800 text-[13px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
        {no}
      </span>

      <div className="flex flex-col min-w-0 flex-1 gap-0.5 pt-1">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{lesson.title}</span>
        {lesson.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line break-words">
            {lesson.description}
          </p>
        )}
        {showHomework && lesson.homework && (
          <p className="text-xs text-blue-600 dark:text-blue-400 break-words">
            <span className="text-slate-400 dark:text-slate-500">{t("syllabus.homeworkLabel")}: </span>
            {lesson.homework}
          </p>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {wide && (
          <>
            <IconButton
              variant="ghost"
              color="black"
              title={t("teachingPlan.moveUp")}
              disabled={isFirst || disabled}
              onClick={() => onMove(-1)}
            >
              <HiArrowUp />
            </IconButton>
            <IconButton
              variant="ghost"
              color="black"
              title={t("teachingPlan.moveDown")}
              disabled={isLast || disabled}
              onClick={() => onMove(1)}
            >
              <HiArrowDown />
            </IconButton>
          </>
        )}
        <DropMenu items={menuItems} />
      </div>
    </div>
  );
}

export default PlanLessonRow;
