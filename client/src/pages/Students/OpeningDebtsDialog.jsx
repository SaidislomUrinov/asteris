import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import OpeningDebtsEditor from "./OpeningDebtsEditor";
import { buildOpeningPayload, openingValueFromEntry } from "./openingDebts.util";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// A'zolik (Student.groups[] elementi) darajasidagi boshlang'ich qarzni
// tahrirlash — to'liq almashtirish (API_CONTRACT_opening_debts.md §3.2).
// `entry` — StudentDetail guruh kartasidagi a'zolik (openingDebts/openingBalance bilan).
function OpeningDebtsDialog({ open, onClose, studentId, entry, title, onSaved }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() => openingValueFromEntry(entry));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    try {
      const body = buildOpeningPayload(value);
      setSaving(true);
      const res = await api.put(`/students/${studentId}/groups/${entry._id}/opening`, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "student.openingDebtsSaved");
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
      title={title || t("student.openingDebtAction")}
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
      <OpeningDebtsEditor value={value} onChange={setValue} />
    </Dialog>
  );
}

export default OpeningDebtsDialog;
