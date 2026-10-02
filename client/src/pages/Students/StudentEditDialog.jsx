import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiDevicePhoneMobile, HiPhone, HiUser } from "react-icons/hi2";
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

// Eski (prefiksdan oldingi) yozuvlar uchun ham ishlaydi — "+998" bo'lsa
// kesib tashlanadi, bo'lmasa oxirgi 9 ta raqam suffiks sifatida olinadi.
const phoneSuffix = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  // Mamlakat kodi FAQAT uzunlik uni tasdiqlaganda kesiladi — 9 raqamli
  // mahalliy raqam ham "998..." bo'lishi mumkin (99 operator kodi + 8),
  // masalan 998104230 (ImportStudentsDialog.jsx dagi bilan bir xil qoida).
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(-9);
};

// O'quvchi ma'lumotlarini tahrirlash — fullName/phone/parentPhone
// (API_CONTRACT.md §1/§4) va FAOL guruh-yozuvlaridagi oylik summa
// (docs/API_CONTRACT_student_edit_price.md). `student:update` ruxsati
// bo'lganlarga (Resepshin/Boshliq) StudentDetail.jsx header'idagi qalam
// tugmasi, Students ro'yxati va Guruh Detail'dagi DropMenu orqali ochiladi.
// Ota komponent har ochilishda `key={student._id}` bilan remount qiladi.
//
// `entries` — ixtiyoriy, [{ _id, label, price }] — tahrirlanadigan FAOL
// guruh-yozuvlari. Berilmasa (yoki bo'sh bo'lsa) summa bo'limi ko'rsatilmaydi.
function StudentEditDialog({ open, onClose, student, entries = [], onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    fullName: student?.fullName || "",
    phone: phoneSuffix(student?.phone),
    parentPhone: phoneSuffix(student?.parentPhone),
    ...telegramFormFromDto(student),
  }));
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(entries.map((en) => [en._id, String(en.price ?? "")])),
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      if (form.fullName.trim().length < 2 || !form.phone.trim())
        throw new Error("student.fillTheRows");
      assertTelegramForm(form);

      const changedPrices = entries.filter((en) => {
        const next = prices[en._id];
        if (next === "" || next == null) return false;
        const nextNum = Number(next);
        if (Number.isNaN(nextNum) || nextNum < 0) throw new Error("student.invalidPrice");
        return nextNum !== (en.price ?? 0);
      });

      setDisabled(true);

      const body = {
        fullName: form.fullName.trim(),
        phone: PHONE_PREFIX + form.phone.trim(),
        ...buildTelegramPayload(form, student),
        parentPhone: form.parentPhone.trim() ? PHONE_PREFIX + form.parentPhone.trim() : "",
      };

      const res = await api.patch(`/students/${student._id}`, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      for (const en of changedPrices) {
        const priceRes = await api.patch(`/students/${student._id}/groups/${en._id}`, {
          price: Number(prices[en._id]),
        });
        if (!priceRes.data.ok) throw new Error(priceRes.data.msg);
      }

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
      title={t("student.edit")}
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
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 9) }))
            }
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
            onChange={(e) =>
              setForm((prev) => ({ ...prev, parentPhone: e.target.value.replace(/\D/g, "").slice(0, 9) }))
            }
          />
        </TelegramPhoneField>

        {entries.length > 0 && (
          <div className="flex flex-col gap-3 pt-1 border-t border-slate-100">
            {entries.map((en) => (
              <Input
                key={en._id}
                type="number"
                label={en.label ? `${t("student.price")} — ${en.label}` : t("student.price")}
                placeholder={t("student.price")}
                icon={<HiBanknotes />}
                value={prices[en._id] ?? ""}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [en._id]: e.target.value }))
                }
              />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default StudentEditDialog;
