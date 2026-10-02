import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const TITLE_MAX = 120;

/**
 * Reja yaratish (POST) yoki nomi/fanini tahrirlash (PUT) modali.
 * Ota komponent har ochilishda `key` bilan remount qiladi — forma
 * boshlang'ich qiymati lazy init orqali propsdan olinadi.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.plan - tahrirlanayotgan reja (null = yangi)
 * @param {Array<{_id, name}>} props.subjects - o'qituvchining fanlari
 * @param {string} [props.defaultSubject] - yangi reja uchun oldindan tanlangan fan
 * @param {(plan) => void} props.onSaved - PlanFull
 */
function PlanFormDialog({ open, onClose, plan = null, subjects = [], defaultSubject = "", onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!plan?._id;
  const [title, setTitle] = useState(() => plan?.title || "");
  const [subject, setSubject] = useState(
    () => plan?.subject?._id || defaultSubject || (subjects.length === 1 ? subjects[0]._id : ""),
  );
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Reja fani o'qituvchining joriy fanlari ichida bo'lmasa ham tanlovda turadi.
  const options = subjects.map((s) => ({ value: s._id, label: s.name }));
  if (plan?.subject?._id && !options.some((o) => o.value === plan.subject._id)) {
    options.unshift({ value: plan.subject._id, label: plan.subject.name });
  }

  const titleError = touched && !title.trim();
  const subjectError = touched && !subject;

  const submit = async () => {
    setTouched(true);
    if (!title.trim()) return errorMsg("teachingPlan.titleRequired");
    if (!subject) return errorMsg("teachingPlan.subjectRequired");
    try {
      setSaving(true);
      const body = { title: title.trim(), subject };
      const res = isEdit
        ? await api.put(`/teaching-plans/${plan._id}`, body)
        : await api.post("/teaching-plans", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || (isEdit ? "teachingPlan.saved" : "teachingPlan.created"));
      onSaved?.(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("teachingPlan.editTitle") : t("teachingPlan.newTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {isEdit ? t("common.save") : t("teachingPlan.create")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        <Input
          label={t("teachingPlan.titleLabel")}
          placeholder={t("teachingPlan.titlePlaceholder")}
          variant="white"
          required
          error={titleError}
          hint={titleError ? t("teachingPlan.titleRequired") : ""}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
        />
        <Select
          label={t("teachingPlan.subjectLabel")}
          placeholder={t("teachingPlan.subjectPlaceholder")}
          variant="white"
          required
          value={subject}
          onChange={setSubject}
          options={options}
        />
        {subjectError && <p className="text-xs text-red-500">{t("teachingPlan.subjectRequired")}</p>}
        {subjects.length === 0 && (
          <p className="text-xs text-slate-400">{t("teachingPlan.noSubjects")}</p>
        )}
      </div>
    </Dialog>
  );
}

export default PlanFormDialog;
