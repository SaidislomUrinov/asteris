import { useTranslation } from "react-i18next";
import { HiClipboardDocumentList } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";

/**
 * Kalendarda bitta kunni bosganda ochiladi — FAQAT o'qituvchi va yordamchi
 * o'qituvchi uchun (docs/teacher-scope-updates.md §2). Ular dam olish kuni
 * belgilamaydi, shuning uchun HolidayDialog o'rniga shu kunga TO'G'RI KELGAN
 * kurs dasturi darsi ko'rsatiladi. Faqat o'qish uchun — tahrirlash "Reja"
 * tabida (SyllabusTab).
 *
 * @param {Object|null} lesson - sana bo'yicha avtomatik topilgan dars
 */
function LessonDayDialog({ open, onClose, date, lesson = null }) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("group.lessonDayTitle", { date })}
      actions={<Button onClick={onClose}>{t("common.close")}</Button>}
    >
      <div className="flex flex-col gap-3 w-full">
        {!lesson ? (
          // Bu kunga kurs dasturidan mavzu tushmadi. Bu yerda "Reja tabidan
          // qo'shing" kabi ko'rsatma BERILMAYDI — kunni bosgan odam mavzuni
          // ko'rmoqchi, tahrir taklifi emas (foydalanuvchi talabi).
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-2xl text-slate-300">
              <HiClipboardDocumentList />
            </span>
            <p className="text-sm font-medium text-slate-500">{t("syllabus.unassigned")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-500 tabular-nums">
                {t("syllabus.lessonNo", { no: lesson.no })}
              </span>
              {lesson.moduleTitle && (
                <span className="text-[11px] text-slate-400 truncate">{lesson.moduleTitle}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-slate-800">{lesson.title}</span>
            {lesson.description && (
              <p className="text-xs text-slate-500 whitespace-pre-line">{lesson.description}</p>
            )}
            {lesson.homework && (
              <p className="text-xs text-blue-600">
                <span className="text-slate-400">{t("syllabus.homeworkLabel")}: </span>
                {lesson.homework}
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default LessonDayDialog;
