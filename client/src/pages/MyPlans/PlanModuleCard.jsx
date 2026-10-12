import { useTranslation } from "react-i18next";
import {
  HiArrowDown,
  HiArrowUp,
  HiChevronDown,
  HiPencilSquare,
  HiPlus,
  HiTrash,
  HiArrowUpTray,
} from "react-icons/hi2";
import IconButton from "../../ui/IconButton";
import DropMenu from "../../ui/DropMenu";
import PlanLessonRow from "./PlanLessonRow";

/**
 * Reja muharriridagi modul akkordeoni elementi (SyllabusTab akkordeoni
 * asosida, progress/joriy dars holatlarisiz).
 *
 * @param {Object} props
 * @param {{_id, title, lessons: Array}} props.module
 * @param {number} props.startNo - modul birinchi darsining tartib raqami
 * @param {boolean} props.open
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {boolean} props.wide - katta ekran
 * @param {boolean} props.disabled - saqlanayotganda
 * @param {boolean} props.showHomework
 * @param {() => void} props.onToggle
 * @param {() => void} props.onAddLesson
 * @param {() => void} props.onImportLessons - Excel'dan darslar
 * @param {() => void} props.onEdit
 * @param {() => void} props.onDelete
 * @param {(delta: number) => void} props.onMove
 * @param {(lesson) => void} props.onEditLesson
 * @param {(lesson) => void} props.onDeleteLesson
 * @param {(index: number, delta: number) => void} props.onMoveLesson
 */
function PlanModuleCard({
  module,
  startNo,
  open,
  isFirst,
  isLast,
  wide,
  disabled,
  showHomework,
  onToggle,
  onAddLesson,
  onImportLessons,
  onEdit,
  onDelete,
  onMove,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
}) {
  const { t } = useTranslation();
  const lessons = module.lessons || [];

  const menuItems = [
    {
      label: t("syllabus.addLesson"),
      icon: HiPlus,
      iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      onClick: onAddLesson,
    },
    {
      label: t("teachingPlan.import.lessonsButton"),
      icon: HiArrowUpTray,
      iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      onClick: onImportLessons,
    },
    {
      label: t("syllabus.editModule"),
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
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <div className="flex items-center gap-2 p-2 pl-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 flex-1 py-1.5 text-left cursor-pointer"
        >
          <HiChevronDown
            className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{module.title}</span>
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-night-800 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {t("syllabus.moduleLessons", { count: lessons.length })}
          </span>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          {wide && (
            <>
              <IconButton
                variant="ghost"
                color="black"
                title={t("syllabus.addLesson")}
                onClick={onAddLesson}
              >
                <HiPlus />
              </IconButton>
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
          <DropMenu items={wide ? menuItems.slice(1) : menuItems} />
        </div>
      </div>

      {open && (
        <div className="flex flex-col border-t border-slate-100 dark:border-night-700 bg-slate-50/40 dark:bg-night-800/40">
          {lessons.length === 0 ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("syllabus.noLessons")}</p>
              <button
                type="button"
                onClick={onAddLesson}
                className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer"
              >
                + {t("syllabus.addLesson")}
              </button>
            </div>
          ) : (
            lessons.map((lesson, li) => (
              <PlanLessonRow
                key={lesson._id || `l-${li}`}
                lesson={lesson}
                no={startNo + li}
                isFirst={li === 0}
                isLast={li === lessons.length - 1}
                wide={wide}
                disabled={disabled}
                showHomework={showHomework}
                onEdit={() => onEditLesson(lesson)}
                onDelete={() => onDeleteLesson(lesson)}
                onMove={(delta) => onMoveLesson(li, delta)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PlanModuleCard;
