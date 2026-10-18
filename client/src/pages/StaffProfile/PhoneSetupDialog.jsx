import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { HiDevicePhoneMobile, HiInformationCircle } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { updateUser } from "../../contexts/user";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { PHONE_PREFIX } from "../Students/studentContact.util";

// Raqami hali yo'q (eski, login bilan yaratilgan) hodim profilga kirganda —
// bir martalik raqam kiritish (docs/API_CONTRACT_staff_phone.md §4).
// "Keyinroq" bilan yopsa bo'ladi: ish to'xtamaydi, profilga har kirganda
// qayta chiqadi. Saqlangach raqamni faqat Owner o'zgartiradi.
function PhoneSetupDialog({ open, onClose }) {
  const { t } = useTranslation();
  const dp = useDispatch();
  const [digits, setDigits] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    try {
      if (digits.length !== 9) throw new Error("staff.invalidPhone");
      setSaving(true);
      const res = await api.patch("/staff-auth/phone", { phone: PHONE_PREFIX + digits });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      dp(updateUser({ phone: data.phone }));
      successMsg(msg);
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
      title={t("staffPhone.title")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("staffPhone.later")}
          </Button>
          <Button loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 w-full" onKeyDown={(e) => e.key === "Enter" && save()}>
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
          <HiInformationCircle className="text-xl text-amber-500 shrink-0 mt-px" />
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{t("staffPhone.desc")}</p>
        </div>
        <Input
          label={t("staff.phone")}
          placeholder="90 123 45 67"
          required
          autoFocus
          inputMode="numeric"
          icon={<HiDevicePhoneMobile />}
          prefix={PHONE_PREFIX}
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      </div>
    </Dialog>
  );
}

export default PhoneSetupDialog;
