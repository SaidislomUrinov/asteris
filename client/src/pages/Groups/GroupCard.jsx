import { useTranslation } from "react-i18next";
import {
  HiBuildingOffice2,
  HiHome,
  HiOutlineClock,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import ProgressBar from "../../ui/ProgressBar";
import { GROUP_STATE } from "./groupLive";
import { formatRemaining } from "../../utils/schedule";
import GroupTelegramBadge from "./GroupTelegramBadge";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// RoomCard bilan bir xil vizual til: oq karta + chap chekkada rangli chiziq,
// rangli badge va progress bar. Karta to'liq rangga HECH QACHON bo'yalmaydi.
const STATE_STYLE = {
  [GROUP_STATE.LIVE]: {
    edge: "bg-blue-500",
    badge: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-100 dark:ring-blue-500/30",
    dot: "bg-blue-500",
    icon: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
    labelKey: "group.cardStatus.activeNow",
  },
  [GROUP_STATE.UPCOMING]: {
    edge: "bg-amber-500",
    badge: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-100 dark:ring-amber-500/30",
    dot: "bg-amber-500",
    icon: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    labelKey: "group.cardStatus.upcoming",
  },
  [GROUP_STATE.ACTIVE]: {
    edge: "bg-indigo-400",
    badge: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 ring-indigo-100 dark:ring-indigo-500/30",
    dot: "bg-indigo-500",
    icon: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500",
    bar: "bg-indigo-500",
    labelKey: "group.cardStatus.activeIdle",
  },
  [GROUP_STATE.PENDING]: {
    edge: "bg-orange-400",
    badge: "bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-orange-100 dark:ring-orange-500/30",
    dot: "bg-orange-500",
    icon: "bg-orange-50 dark:bg-orange-500/15 text-orange-500",
    bar: "bg-orange-500",
    labelKey: "group.cardStatus.pending",
  },
  [GROUP_STATE.FINISHED]: {
    edge: "bg-emerald-400",
    badge: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
    icon: "bg-slate-100 dark:bg-night-800 text-slate-400 dark:text-slate-500",
    bar: "bg-emerald-500",
    labelKey: "group.cardStatus.finished",
  },
};

function Meta({ icon, value }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-300 dark:text-slate-600 shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

/**
 * Guruh kartasi — jonli dars faoliyatiga urg'u beradi.
 *
 * @param {Object} props
 * @param {Object} props.group
 * @param {string} props.label - "Fan - N" ko'rinishidagi sarlavha
 * @param {string} [props.centerName]
 * @param {string} [props.teacherName]
 * @param {string} [props.roomName]
 * @param {{state: string, current: Object|null, next: Object|null}} props.live - buildGroupLive() natijasi
 * @param {() => void} [props.onClick]
 * @param {boolean} [props.canEditTelegram] - Telegram belgisi bosilganda tahrirlash oynasi
 * @param {() => void} [props.onTelegramEdit]
 */
function GroupCard({
  group,
  label,
  centerName,
  teacherName,
  roomName,
  live,
  onClick,
  canEditTelegram = false,
  onTelegramEdit,
}) {
  const { t } = useTranslation();
  const s = STATE_STYLE[live.state] || STATE_STYLE[GROUP_STATE.ACTIVE];
  const { current, next } = live;
  const isFinished = live.state === GROUP_STATE.FINISHED;
  const isPending = live.state === GROUP_STATE.PENDING;

  const max = group.maxStudents || 0;
  const count = group.studentsCount || 0;
  const fillPercent = max ? Math.min(100, (count / max) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col h-full w-full overflow-hidden rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] dark:hover:shadow-none hover:border-slate-300 dark:hover:border-night-600 ${
        isFinished ? "opacity-75" : ""
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${s.edge}`} />

      <div className="flex flex-col gap-4 p-5 pl-6 flex-1">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg ${s.icon}`}
          >
            <HiUserGroup />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-100 truncate">{label}</h3>
            {/* Holat belgisi — ixcham, filial nomi qatorida (alohida qator
                egallamaydi). Oddiy faol holat ("Start berilgan") belgilanmaydi —
                faqat farqli holatlar: dars ketyapti, yaqin orada, yig'ilmoqda,
                yakunlangan. */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <Meta icon={<HiBuildingOffice2 />} value={centerName || "—"} />
              </div>
              {live.state !== GROUP_STATE.ACTIVE && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold leading-none whitespace-nowrap ${s.badge}`}
                >
                  <span className={`w-1 h-1 rounded-full ${s.dot}`} />
                  {t(s.labelKey)}
                </span>
              )}
            </div>
          </div>
          <GroupTelegramBadge
            link={group.telegramLink}
            canEdit={canEditTelegram}
            onEdit={onTelegramEdit}
          />
        </div>


        {/* Jonli blok — dars ketayotganda progress, aks holda jadval */}
        {current ? (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50/80 dark:bg-night-800/80 border border-slate-100 dark:border-night-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {t("group.lessonNow")}
              </span>
              <span className="shrink-0 text-xs font-jet tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                {formatRemaining(t, current.remainingMin)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-night-700/80 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.bar} transition-[width] duration-500`}
                style={{ width: `${current.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">{teacherName || t("group.noTeacher")}</span>
              <span className="shrink-0 font-jet tabular-nums">
                {group.startTime}–{group.endTime}
              </span>
            </div>
          </div>
        ) : isPending && max ? (
          // Yig'ilayotgan guruhda eng muhim raqam — to'lganlik darajasi.
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50/80 dark:bg-night-800/80 border border-slate-100 dark:border-night-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("group.filling")}</span>
              <span className="shrink-0 text-xs font-jet tabular-nums text-orange-600 dark:text-orange-400 font-semibold">
                {count} / {max}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-night-700/80 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.bar} transition-[width] duration-500`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50/60 dark:bg-night-800/60 border border-slate-100 dark:border-night-700 text-xs">
            <HiOutlineClock className="shrink-0 text-slate-300 dark:text-slate-600 text-base" />
            {group.startTime && group.endTime ? (
              <span className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400">
                <span className="font-jet tabular-nums text-slate-700 dark:text-slate-300 font-semibold">
                  {group.startTime}–{group.endTime}
                </span>
                {next?.day && <span className="truncate">{t(`group.day.${next.day}`)}</span>}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">{t("group.noScheduleYet")}</span>
            )}
          </div>
        )}

        {/* Kurs dasturi — "Modul 2/5 · 7-dars" + progress.
            `group.syllabus` guruh ro'yxati javobida keladi (bitta aggregate);
            dastur tuzilmagan bo'lsa umuman ko'rinmaydi. */}
        {group.syllabus && group.syllabus.totalLessons > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {group.syllabus.finished
                ? t("syllabus.finished")
                : t("syllabus.progress", {
                    module: group.syllabus.moduleNo,
                    moduleCount: group.syllabus.moduleCount,
                    lesson: group.syllabus.lessonNo,
                  })}
            </span>
            <ProgressBar
              value={
                group.syllabus.finished
                  ? group.syllabus.totalLessons
                  : Math.max(0, (group.syllabus.lessonNo || 1) - 1)
              }
              max={group.syllabus.totalLessons}
              color={group.syllabus.finished ? "emerald" : "blue"}
            />
          </div>
        )}

        {/* Hafta kunlari — qaysi kunlar dars borligi bir qarashda */}
        <div className="flex items-center gap-1">
          {DAYS.map((d) => {
            const on = group.days?.includes(d);
            return (
              <span
                key={d}
                title={t(`group.day.${d}`)}
                className={`flex-1 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold ${
                  on ? "bg-slate-800 dark:bg-night-600 text-white" : "bg-slate-50 dark:bg-night-800 text-slate-300 dark:text-slate-600"
                }`}
              >
                {t(`group.dayShort.${d}`)}
              </span>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-night-700">
          <Meta icon={<HiUser />} value={teacherName || t("group.noTeacher")} />
          {roomName && <Meta icon={<HiHome />} value={roomName} />}
          <span className="flex items-center gap-1 shrink-0 text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-none">
            <HiUserGroup className="text-slate-300 dark:text-slate-600 text-sm" />
            {count}
            {max ? <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/{max}</span> : null}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GroupCard;
