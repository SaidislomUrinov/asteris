import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiReceiptPercent } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * O'qituvchi foizini tahrirlash — PATCH /groups/:id/individual
 * (docs/API_CONTRACT_individual_students.md §2). Faqat Boshliq/Resepshin.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object} props.group - `{ _id, teacherPercent }`
 * @param {() => void} props.onClose
 * @param {(group: Object) => void} [props.onSaved] - yangilangan GroupDTO
 */
function IndividualPercentDialog({ open, group, onClose, onSaved }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(group?.teacherPercent != null ? String(group.teacherPercent) : "50");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    try {
      const percent = Number(value);
      if (value === "" || !Number.isFinite(percent) || percent < 0 || percent > 100)
        throw new Error("individual.invalidPercent");
      setSaving(true);
      const res = await api.patch(`/groups/${group._id}/individual`, { teacherPercent: percent });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "common.success");
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
      title={t("individual.editPercent")}
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
        />
      </div>
    </Dialog>
  );
}

export default IndividualPercentDialog;
