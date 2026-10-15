import { useTranslation } from "react-i18next";
import { HiBookOpen, HiCalendarDays, HiClipboardDocumentList, HiClock, HiHome } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";

// "2026-09-11" → "11 Sentabr 2026, Juma" — uz Intl oy nomini "M09" deb
// chiqaradi, shuning uchun oy nomi `common.monthNames` dan olinadi.
const longDate = (date, t) => {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y || !m || !d) return date || "";
  const months = t("common.monthNames", { returnObjects: true });
  const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(y, m - 1, d).getDay()];
  return `${d} ${Array.isArray(months) ? months[m - 1] : m} ${y}, ${t(`group.day.${weekday}`)}`;
};

function Row({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="grid place-items-center size-8 shrink-0 rounded-lg bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <div className="text-sm text-slate-800 dark:text-slate-100 break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * Bugungi (yoki keyingi) dars — to'liq ma'lumot. TodayLessonCard'dagi
 * "Batafsil" tugmasidan ochiladi; ma'lumot kurs dasturi va guruh jadvalidan.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ date: string, lesson: Object|null }|null} props.entry
 * @param {boolean} props.isToday
 * @param {Object} props.group - { startTime, endTime, roomName }
 */
function TodayLessonDialog({ open, onClose, entry, isToday, group }) {
  const { t } = useTranslation();
  const lesson = entry?.lesson || null;
  const time = group?.startTime && group?.endTime ? `${group.startTime} – ${group.endTime}` : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isToday ? t("group.todayLesson") : t("group.nextLesson")}
      actions={
        <Button color="black" variant="text" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Row icon={<HiCalendarDays />} label={t("group.lessonDate")}>
            {longDate(entry?.date, t)}
          </Row>
          {time && (
            <Row icon={<HiClock />} label={t("group.lessonTime")}>
              <span className="tabular-nums">{time}</span>
            </Row>
          )}
          {group?.roomName && (
            <Row icon={<HiHome />} label={t("group.room")}>
              {group.roomName}
            </Row>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-night-700" />

        {lesson ? (
          <>
            <Row icon={<HiBookOpen />} label={t("group.lessonTopic")}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-night-800 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {t("syllabus.lessonNo", { no: lesson.no })}
                </span>
                {lesson.moduleTitle && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">{lesson.moduleTitle}</span>
                )}
              </div>
              <p className="font-semibold">{lesson.title}</p>
              {lesson.description && (
                <p className="mt-1.5 whitespace-pre-line text-slate-600 dark:text-slate-300">{lesson.description}</p>
              )}
            </Row>
            {lesson.homework && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3">
                <Row icon={<HiClipboardDocumentList />} label={t("syllabus.homeworkLabel")}>
                  <p className="whitespace-pre-line text-blue-700 dark:text-blue-300">{lesson.homework}</p>
                </Row>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("syllabus.unassigned")}</p>
        )}
      </div>
    </Dialog>
  );
}

export default TodayLessonDialog;
