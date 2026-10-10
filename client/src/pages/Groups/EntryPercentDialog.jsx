import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiUser } from "react-icons/hi";
import { HiReceiptPercent } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Switch from "../../ui/Switch";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * "Alohida foiz" — guruhdagi bitta o'quvchi to'lovidan o'qituvchiga alohida
 * ulush (docs/API_CONTRACT_entry_teacher_percent.md §2, §4).
 * PATCH /students/:id/groups/:entryId/teacher-percent. Switch off → `null`.
 * Ichki state ochilishda olinadi — har ochishda `key` almashtiriladi.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string} props.studentId
 * @param {{_id: string, teacherPercent?: number|null}} props.entry
 * @param {string} [props.studentName]
 * @param {() => void} props.onClose
 * @param {(groupEntryId: string, teacherPercent: number|null) => void} [props.onSaved]
 */
function EntryPercentDialog({ open, studentId, entry, studentName, onClose, onSaved }) {
  const { t } = useTranslation();
  const initial = entry?.teacherPercent;
  const [enabled, setEnabled] = useState(initial != null);
  const [value, setValue] = useState(initial != null ? String(initial) : "50");
  const [saving, setSaving] = useState(false);

  const toggle = (checked) => {
    setEnabled(checked);
    if (checked && value === "") setValue("50");
  };

  const submit = async () => {
    try {
      let teacherPercent = null;
      if (enabled) {
        const percent = Number(value);
        if (value === "" || !Number.isFinite(percent) || percent < 0 || percent > 100)
          throw new Error("individual.invalidPercent");
        teacherPercent = percent;
      }
      setSaving(true);
      const res = await api.patch(`/students/${studentId}/groups/${entry._id}/teacher-percent`, {
        teacherPercent,
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || (teacherPercent == null ? "entryPercent.removed" : "entryPercent.updated"));
      onSaved?.(data?.groupEntryId || entry._id, data?.teacherPercent ?? teacherPercent);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const shown = value === "" ? 0 : value;
  const price = Number(entry?.price);
  const pct = Number(shown);
  const example =
    Number.isFinite(price) && price > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100
      ? Math.round((price * pct) / 100)
      : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("entryPercent.title")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-3 w-full">
        {studentName && (
          <div className="flex items-center gap-2 min-w-0 rounded-xl bg-slate-50 dark:bg-night-800 border border-slate-200 dark:border-night-700 px-3 py-2">
            <HiUser className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{studentName}</span>
          </div>
        )}
        <div className="rounded-xl border border-violet-200 dark:border-violet-400/30 bg-violet-50/60 dark:bg-violet-500/10 px-3 py-2.5">
          <Switch checked={enabled} onChange={toggle} color="blue" label={t("entryPercent.switch")} />
        </div>
        {enabled && (
          <Input
            type="number"
            label={t("individual.percent")}
            placeholder="50"
            required
            min={0}
            max={100}
            autoFocus
            icon={<HiReceiptPercent />}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            hint={
              example != null
                ? t("entryPercent.example", {
                    price: price.toLocaleString("ru-RU"),
                    amount: example.toLocaleString("ru-RU"),
                  })
                : undefined
            }
          />
        )}
      </div>
    </Dialog>
  );
}

export default EntryPercentDialog;
