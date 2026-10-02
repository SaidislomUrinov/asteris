import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowDownTray } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Select from "../../ui/Select";

/**
 * Mavzu (dars) qo'shish/tahrirlash modali — kurs dasturi ichida.
 * Sana maydoni YO'Q: mavzu sanaga avtomatik biriktiriladi (davomat asosida).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.lesson - tahrirlanayotgan dars
 * @param {string} props.moduleId - dastlabki modul
 * @param {Array} props.modules - modul tanlovi uchun
 * @param {boolean} props.saving
 * @param {boolean} [props.canImport] - "Boshqa guruhlardan import" tugmasi
 * @param {() => void} [props.onImport]
 * @param {boolean} [props.showHomework] - `homework.manage` tarif ruxsati
 * @param {(form) => void} props.onSave
 */
function SyllabusDialog({
  open,
  onClose,
  lesson = null,
  moduleId = "",
  modules = [],
  saving = false,
  canImport = false,
  onImport,
  showHomework = true,
  onSave,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: lesson?.title || "",
    description: lesson?.description || "",
    homework: lesson?.homework || "",
    moduleId: moduleId || modules[0]?._id || "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lesson ? t("syllabus.editLesson") : t("syllabus.addLesson")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={() => onSave(form)}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        <Select
          label={t("syllabus.moduleLabel")}
          variant="white"
          required
          value={form.moduleId}
          onChange={(value) => setForm((f) => ({ ...f, moduleId: value }))}
          options={modules.map((m) => ({ value: m._id, label: m.title }))}
        />
        <Input
          label={t("syllabus.lessonTitleLabel")}
          placeholder={t("syllabus.lessonTitlePlaceholder")}
          variant="white"
          required
          value={form.title}
          onChange={set("title")}
        />
        <Textarea
          label={t("syllabus.descriptionLabel")}
          variant="white"
          rows={3}
          value={form.description}
          onChange={set("description")}
        />
        {showHomework && (
          <Input
            label={t("syllabus.homeworkLabel")}
            variant="white"
            value={form.homework}
            onChange={set("homework")}
          />
        )}

        {/* Sana avtomatik, davomatdan aniqlanadi — o'qituvchi buni oldindan
            bilishi kerak, aks holda "nega o'tgan kunga biriktirilmadi"
            degan savol tug'iladi (useLessonSchedule.js). */}
        <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
          {t("syllabus.calendarHint")}
        </p>

        {/* Dasturni noldan yozish o'rniga tayyor guruhdan olish yo'li. */}
        {canImport && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">{t("syllabus.importHint")}</p>
            <Button variant="text" color="black" className="gap-1.5 shrink-0" onClick={onImport}>
              <HiArrowDownTray className="text-base" />
              {t("syllabus.importShort")}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default SyllabusDialog;
