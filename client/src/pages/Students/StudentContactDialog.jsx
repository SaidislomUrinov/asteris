import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiDevicePhoneMobile, HiPhone, HiUser } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import TelegramPhoneField from "../../ui/TelegramPhoneField";
import {
  assertTelegramForm,
  buildTelegramPayload,
  telegramFormFromDto,
} from "../../utils/telegramPhone";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const PHONE_PREFIX = "+998";

// StudentEditDialog.jsx dagi bilan bir xil qoida: mamlakat kodi faqat
// uzunlik tasdiqlaganda kesiladi, aks holda oxirgi 9 raqam olinadi.
const phoneSuffix = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(-9);
};

// O'qituvchi/Yordamchi uchun o'quvchi KONTAKTINI tahrirlash — faqat ism,
// raqam va ota-ona raqami (`student:contact` ruxsati,
// docs/API_CONTRACT_student_contact_telegram.md §2). Summa va boshqa
// maydonlar yo'q — ular `student:update` (StudentEditDialog) doirasida.
// Ota komponent har ochilishda `key={student._id}` bilan remount qiladi.
function StudentContactDialog({ open, onClose, student, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    fullName: student?.fullName || "",
    phone: phoneSuffix(student?.phone),
    parentPhone: phoneSuffix(student?.parentPhone),
    ...telegramFormFromDto(student),
  }));
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    if (disabled) return;
    try {
      if (form.fullName.trim().length < 2 || !form.phone.trim())
        throw new Error("student.fillTheRows");
      if (form.phone.length !== 9) throw new Error("student.invalidPhone");
      if (form.parentPhone && form.parentPhone.length !== 9)
        throw new Error("student.invalidPhone");
      assertTelegramForm(form);

      setDisabled(true);

      const body = {
        fullName: form.fullName.trim(),
        phone: PHONE_PREFIX + form.phone,
        ...buildTelegramPayload(form, student),
        parentPhone: form.parentPhone ? PHONE_PREFIX + form.parentPhone : "",
      };

      const res = await api.patch(`/students/${student._id}/contact`, body);
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

  const onDigits = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value.replace(/\D/g, "").slice(0, 9) }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("student.editContact")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t("common.update")}
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(k) => k.key === "Enter" && submit()}
        className="flex flex-col gap-3 w-full"
      >
        <Input
          label={t("student.fullName")}
          placeholder={t("student.fullName")}
          required
          icon={<HiUser />}
          value={form.fullName}
          onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
        />
        <TelegramPhoneField
          same={form.telegramSame}
          onSameChange={(v) => setForm((prev) => ({ ...prev, telegramSame: v }))}
          value={form.telegramPhone}
          onChange={(v) => setForm((prev) => ({ ...prev, telegramPhone: v }))}
          label={t("telegramPhone.studentLabel")}
        >
          <Input
            label={t("student.phone")}
            placeholder="90 123 45 67"
            required
            icon={<HiDevicePhoneMobile />}
            prefix={PHONE_PREFIX}
            variant="white"
            value={form.phone}
            onChange={onDigits("phone")}
          />
        </TelegramPhoneField>
        <TelegramPhoneField
          same={form.parentTelegramSame}
          onSameChange={(v) => setForm((prev) => ({ ...prev, parentTelegramSame: v }))}
          value={form.parentTelegramPhone}
          onChange={(v) => setForm((prev) => ({ ...prev, parentTelegramPhone: v }))}
          label={t("telegramPhone.parentLabel")}
        >
          <Input
            label={t("student.parentPhone")}
            placeholder="90 123 45 67"
            hint={t("student.parentPhoneHint")}
            icon={<HiPhone />}
            prefix={PHONE_PREFIX}
            variant="white"
            value={form.parentPhone}
            onChange={onDigits("parentPhone")}
          />
        </TelegramPhoneField>
      </div>
    </Dialog>
  );
}

export default StudentContactDialog;
