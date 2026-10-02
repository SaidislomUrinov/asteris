import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { HiChevronRight, HiRectangleStack } from "react-icons/hi2";
import { formatPlanDate } from "./planUtils";

/**
 * Reja kartasi (PlanSummary) — bosilganda muharrir ochiladi.
 *
 * @param {Object} props
 * @param {{_id, title, subject: {_id, name}, moduleCount, lessonCount, updatedAt}} props.plan
 */
function PlanCard({ plan }) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/my-plans/${plan._id}`}
      className="group flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] hover:border-blue-300 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] transition-[border-color,box-shadow]"
    >
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-lg text-blue-500">
          <HiRectangleStack />
        </span>
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span className="text-[15px] font-semibold text-slate-800 leading-snug line-clamp-2 break-words">
            {plan.title}
          </span>
          {plan.subject?.name && (
            <span className="self-start max-w-full truncate px-2 py-0.5 rounded-md bg-violet-50 text-[11px] font-semibold text-violet-600">
              {plan.subject.name}
            </span>
          )}
        </div>
        <HiChevronRight className="shrink-0 mt-1 text-slate-300 group-hover:text-blue-400" />
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 mt-auto border-t border-slate-100 text-xs">
        <span className="font-medium text-slate-700 tabular-nums">
          {t("syllabus.importMeta", {
            modules: plan.moduleCount || 0,
            lessons: plan.lessonCount || 0,
          })}
        </span>
        <span className="text-slate-400 tabular-nums">
          {t("teachingPlan.updated", { date: formatPlanDate(plan.updatedAt) })}
        </span>
      </div>
    </Link>
  );
}

export default PlanCard;
