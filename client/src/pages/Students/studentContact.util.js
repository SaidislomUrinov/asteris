import { EMPTY_TELEGRAM_FORM, buildTelegramPayload } from "../../utils/telegramPhone";

export const PHONE_PREFIX = "+998";

// "+998901234567" → "901234567" (prefiksli inputga qo'yish uchun); eski
// formatdagi yozuvlar uchun ham — oxirgi 9 ta raqam.
export const phoneSuffix = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(-9);
};

// O'quvchi kontakt maydonlari (StudentDialog va IndividualDialog uchun umumiy).
export const EMPTY_CONTACT_FORM = {
  fullName: "",
  phone: "",
  parentPhone: "",
  ...EMPTY_TELEGRAM_FORM,
};

// POST /students va POST /groups/individual uchun umumiy o'quvchi qismi.
export const buildContactPayload = (form, existingStudent) => ({
  fullName: form.fullName.trim() || undefined,
  phone: PHONE_PREFIX + form.phone.trim(),
  parentPhone: form.parentPhone.trim() ? PHONE_PREFIX + form.parentPhone.trim() : "",
  existingStudentId: existingStudent?._id || undefined,
  ...buildTelegramPayload(form),
});
