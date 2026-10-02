import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiBuildingOffice2, HiTag } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const CATEGORIES = ["rent", "utilities", "equipment", "marketing", "repair", "other"];

const EMPTY_FORM = { center: "", title: "", category: "other", amount: "", note: "" };

function ExpenseDialog({ open, onClose, expense, centers = [], onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!expense?._id;
  // Hodim (Staff) bitta filialga biriktirilgan — maydon yashiriladi va
  // qiymat avtomatik qo'yiladi (bitta filialli Owner uchun ham shunday).
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() =>
    expense
      ? {
          center: expense.center || "",
          title: expense.title || "",
          category: expense.category || "other",
          amount: expense.amount ?? "",
          note: expense.note || "",
        }
      : { ...EMPTY_FORM, center: onlyCenter },
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      if (!isEdit && !form.center) throw new Error("expense.fillTheRows");
      if (!form.title.trim() || form.amount === "") throw new Error("expense.fillTheRows");
      if (Number.isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
        throw new Error("expense.fillTheRows");
      }
      setDisabled(true);

      const body = {
        centerId: form.center,
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        note: form.note,
      };

      const res = isEdit
        ? await api.patch(`/expenses/${expense._id}`, body)
        : await api.post("/expenses", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg(msg);
      onSaved?.(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(isEdit ? "expense.edit" : "expense.create")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t(isEdit ? "common.update" : "common.create")}
          </Button>
        </>
      }
    >
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-3 w-full">
        {!isEdit && showCenterField && (
          <Select
            label={t("expense.center")}
            placeholder={t("expense.center")}
            required
            icon={<HiBuildingOffice2 />}
            value={form.center}
            onChange={(v) => setForm((prev) => ({ ...prev, center: v }))}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}
        <Input
          label={t("expense.title")}
          placeholder={t("expense.title")}
          required
          icon={<HiTag />}
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />
        <Select
          label={t("expense.category")}
          value={form.category}
          onChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
          options={CATEGORIES.map((c) => ({ value: c, label: t(`expense.categories.${c}`) }))}
        />
        <Input
          type="number"
          label={t("expense.amount")}
          placeholder={t("expense.amount")}
          required
          icon={<HiBanknotes />}
          value={form.amount}
          onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
        />
        <Textarea
          label={t("expense.note")}
          placeholder={t("expense.note")}
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
        />
      </div>
    </Dialog>
  );
}

export default ExpenseDialog;
