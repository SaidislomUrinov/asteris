import { useTranslation } from "react-i18next";
import { HiBookOpen, HiHome, HiOutlineClock, HiUser } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import IndBadge from "../../ui/IndBadge";
import ProgressBar from "../../ui/ProgressBar";

function Meta({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-300 dark:text-slate-600 shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Individual o'quvchi kartasi (/individual) — GroupCard bilan bir xil
 * vizual til (oq karta + chap chekka chizig'i), sarlavha o'quvchi ismi.
 *
 * @param {Object} props
 * @param {Object} props.group - individual guruh DTO (`individualStudent` bilan)
 * @param {string} [props.subjectName]
 * @param {string} [props.teacherName] - berilsa (owner/resepshin) ko'rinadi
 * @param {string} [props.roomName]
 * @param {boolean} [props.showFinance] - o'qituvchi foizini ko'rsatish
 * @param {() => void} [props.onClick]
 */
function IndividualCard({ group, subjectName, teacherName, roomName, showFinance = false, onClick }) {
  const { t } = useTranslation();
  const student = group.individualStudent || {};
  const days = group.days || [];
  const hasTime = group.startTime && group.endTime;
  const syllabus = group.syllabus;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col h-full w-full overflow-hidden rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] dark:hover:shadow-none hover:border-slate-300 dark:hover:border-night-600"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-fuchsia-400" />

      <div className="flex flex-col gap-3.5 p-5 pl-6 flex-1">
        <div className="flex items-start gap-3">
          <Avatar
            user={{ _id: student._id, name: student.fullName, avatar: student.photo }}
            size={44}
          />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0 leading-none">
              <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-100 truncate">
                {student.fullName || "—"}
              </h3>
              <IndBadge title={t("individual.badgeTitle")} />
            </div>
            <Meta icon={<HiBookOpen />}>{subjectName || "—"}</Meta>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-night-800/60 border border-slate-100 dark:border-night-700 text-xs min-w-0">
          <HiOutlineClock className="shrink-0 text-slate-300 dark:text-slate-600 text-base" />
          {hasTime || days.length ? (
            <span className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400">
              {hasTime && (
                <span className="font-jet tabular-nums text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                  {group.startTime}–{group.endTime}
                </span>
              )}
              {days.length > 0 && (
                <span className="truncate">{days.map((d) => t(`group.dayShort.${d}`)).join(", ")}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{t("group.noScheduleYet")}</span>
          )}
        </div>

        {syllabus && syllabus.totalLessons > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {syllabus.finished
                ? t("syllabus.finished")
                : t("syllabus.progress", {
                    module: syllabus.moduleNo,
                    moduleCount: syllabus.moduleCount,
                    lesson: syllabus.lessonNo,
                  })}
            </span>
            <ProgressBar
              value={syllabus.finished ? syllabus.totalLessons : Math.max(0, (syllabus.lessonNo || 1) - 1)}
              max={syllabus.totalLessons}
              color={syllabus.finished ? "emerald" : "blue"}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-night-700 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {teacherName !== undefined && <Meta icon={<HiUser />}>{teacherName || t("group.noTeacher")}</Meta>}
            {roomName && <Meta icon={<HiHome />}>{roomName}</Meta>}
          </div>
          {showFinance && group.teacherPercent != null && (
            <span
              title={t("individual.percentHint")}
              className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300"
            >
              {group.teacherPercent}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default IndividualCard;
