import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiUser } from "react-icons/hi";
import { HiReceiptPercent } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * "O'qituvchi ulushi" — o'quvchi to'lovidan o'qituvchiga alohida %
 * (docs/API_CONTRACT_teacher_share_ui.md §3). Ikki rejim:
 * - `entry` — guruhdagi a'zolik: PATCH /students/:id/groups/:entryId/teacher-percent,
 *   "Guruh foizi" → `null`;
 * - `individual` — individual guruh: PATCH /groups/:id/individual.
 * Ichki state ochilishda olinadi — har ochishda `key` almashtiriladi.
 *
 * @param {Object} props
 * @param {"entry"|"individual"} props.mode
 * @param {boolean} props.open
 * @param {string} [props.studentName]
 * @param {string} [props.caption] - ism ostida kichik matn (masalan guruh nomi)
 * @param {number} [props.price] - jonli misol uchun oylik narx
 * @param {string} [props.studentId] - entry
 * @param {{_id: string, price?: number, teacherPercent?: number|null}} [props.entry] - entry
 * @param {{_id: string, teacherPercent?: number|null}} [props.group] - individual
 * @param {() => void} props.onClose
 * @param {Function} [props.onSaved] - entry: (groupEntryId, teacherPercent); individual: (groupDTO)
 */
function TeacherShareDialog({ mode, open, studentName, caption, price, studentId, entry, group, onClose, onSaved }) {
  const { t } = useTranslation();
  const isEntry = mode === "entry";
  const initial = isEntry ? entry?.teacherPercent : group?.teacherPercent;
  const [custom, setCustom] = useState(!isEntry || initial != null);
  const [value, setValue] = useState(initial != null ? String(initial) : "50");
  const [saving, setSaving] = useState(false);

  const pick = (next) => {
    setCustom(next);
    if (next && value === "") setValue("50");
  };

  const submit = async () => {
    try {
      let teacherPercent = null;
      if (custom) {
        const percent = Number(value);
        if (value === "" || !Number.isFinite(percent) || percent < 0 || percent > 100)
          throw new Error("individual.invalidPercent");
        teacherPercent = percent;
      }
      setSaving(true);
      if (isEntry) {
        const res = await api.patch(`/students/${studentId}/groups/${entry._id}/teacher-percent`, {
          teacherPercent,
        });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        successMsg(msg || (teacherPercent == null ? "entryPercent.removed" : "entryPercent.updated"));
        onSaved?.(data?.groupEntryId || entry._id, data?.teacherPercent ?? teacherPercent);
      } else {
        const res = await api.patch(`/groups/${group._id}/individual`, { teacherPercent });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        successMsg(msg || "individual.updated");
        onSaved?.(data);
      }
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const fee = Number(price ?? entry?.price);
  const pct = Number(value === "" ? 0 : value);
  const example =
    Number.isFinite(fee) && fee > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100
      ? Math.round((fee * pct) / 100)
      : null;

  const segment = (active) =>
    `h-9 min-w-0 truncate px-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:focus-visible:ring-violet-500 ${
      active
        ? "bg-white dark:bg-night-700 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-200 dark:ring-violet-400/30"
        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
    }`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("teacherShare.title")}
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
            <span className="grid place-items-center size-6 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <HiUser className="text-sm" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{studentName}</span>
            {caption && (
              <span className="ml-auto shrink-0 max-w-[45%] truncate text-xs text-slate-400 dark:text-slate-500">
                {caption}
              </span>
            )}
          </div>
        )}
        {isEntry && (
          <div role="group" aria-label={t("teacherShare.title")} className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800">
            <button type="button" aria-pressed={!custom} className={segment(!custom)} onClick={() => pick(false)}>
              {t("teacherShare.groupPercent")}
            </button>
            <button type="button" aria-pressed={custom} className={segment(custom)} onClick={() => pick(true)}>
              {t("teacherShare.custom")}
            </button>
          </div>
        )}
        {custom && (
          <Input
            type="number"
            label={t("teacherShare.percent")}
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
                ? t("teacherShare.example", {
                    price: fee.toLocaleString("ru-RU"),
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

export default TeacherShareDialog;
