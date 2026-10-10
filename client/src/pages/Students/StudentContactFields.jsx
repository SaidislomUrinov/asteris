import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiDevicePhoneMobile, HiPhone, HiUser } from "react-icons/hi2";
import Input from "../../ui/Input";
import Avatar from "../../ui/Avatar";
import TelegramPhoneField from "../../ui/TelegramPhoneField";
import { api } from "../../utils/fetching";
import { EMPTY_TELEGRAM_FORM, telegramFormFromDto } from "../../utils/telegramPhone";
import { PHONE_PREFIX, phoneSuffix } from "./studentContact.util";

/**
 * Telefon (lookup → mavjud o'quvchini tanlash), Telegram raqamlari, ism va
 * ota-ona raqami. Forma holati ota komponentda — bu yerda faqat maydonlar.
 *
 * Bir nechta bola bitta telefon raqamda bo'lishi mumkin — lookup massiv
 * qaytaradi (API_CONTRACT.md §2). Ro'yxatdan biri tanlansa "mavjud o'quvchi"
 * oqimi (existingStudentId), tanlanmasa — yangi Student hujjati.
 *
 * @param {Object} props
 * @param {Object} props.form - kamida EMPTY_CONTACT_FORM maydonlari
 * @param {(updater: Function) => void} props.setForm
 * @param {Object|null} props.existingStudent
 * @param {(s: Object|null) => void} props.setExistingStudent
 * @param {boolean} [props.hints=true] - false bo'lsa maydon ostidagi izoh matnlari ko'rsatilmaydi
 */
function StudentContactFields({ form, setForm, existingStudent, setExistingStudent, hints = true }) {
  const { t } = useTranslation();
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const suffix = form.phone.trim();
    if (suffix.length < 9) {
      const clearTimer = setTimeout(() => setMatches([]), 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/students/lookup", { params: { phone: PHONE_PREFIX + suffix } });
        const { ok, data } = res.data;
        setMatches(ok && Array.isArray(data) ? data : []);
      } catch {
        // lookup xatosi jim o'tkaziladi — foydalanuvchi qo'lda kiritishda davom etadi
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.phone]);

  const selectExisting = (student) => {
    setExistingStudent(student);
    setForm((prev) => ({
      ...prev,
      fullName: student.fullName || "",
      parentPhone: phoneSuffix(student.parentPhone) || prev.parentPhone,
      ...telegramFormFromDto(student),
    }));
  };

  const clearExisting = () => {
    setExistingStudent(null);
    setForm((prev) => ({ ...prev, fullName: "", ...EMPTY_TELEGRAM_FORM }));
  };

  return (
    <>
      <Input
        label={t("student.phone")}
        placeholder="90 123 45 67"
        required
        icon={<HiDevicePhoneMobile />}
        prefix={PHONE_PREFIX}
        value={form.phone}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
          if (existingStudent) {
            setExistingStudent(null);
            setForm((prev) => ({ ...prev, phone: digits, fullName: "", ...EMPTY_TELEGRAM_FORM }));
            return;
          }
          setForm((prev) => ({ ...prev, phone: digits, fullName: "" }));
        }}
      />

      {existingStudent ? (
        <div className="flex items-center justify-between gap-2 -mt-2 pl-2 pr-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <p className="flex items-center gap-2 text-xs min-w-0">
            <Avatar user={{ _id: existingStudent._id, name: existingStudent.fullName, avatar: existingStudent.photo }} size={24} />
            <HiCheckCircle className="shrink-0" /> {t("student.existingStudentFound", { name: existingStudent.fullName })}
          </p>
          <button
            type="button"
            className="text-xs font-semibold underline shrink-0 cursor-pointer"
            onClick={clearExisting}
          >
            {t("student.chooseDifferent")}
          </button>
        </div>
      ) : null}
      {existingStudent?.shared && (
        <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">{t("student.sharedContactHint")}</p>
      )}
      {existingStudent ? null : matches.length > 0 ? (
        <div className="flex flex-col gap-1 -mt-1">
          <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("student.existingMatchesHint")}</p>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {matches.map((m) => (
              <button
                type="button"
                key={m._id}
                onClick={() => selectExisting(m)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-night-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/15 text-left transition-colors cursor-pointer"
              >
                <Avatar user={{ _id: m._id, name: m.fullName, avatar: m.photo }} size={32} />
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{m.fullName}</span>
                  {m.parentPhone && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{m.parentPhone}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("student.newStudentHint")}</p>
        </div>
      ) : hints ? (
        <p className="pl-2 -mt-2 text-xs text-slate-400 dark:text-slate-500">{t("student.existingPhoneHint")}</p>
      ) : null}

      <TelegramPhoneField
        same={form.telegramSame}
        onSameChange={(v) => setForm((prev) => ({ ...prev, telegramSame: v }))}
        value={form.telegramPhone}
        onChange={(v) => setForm((prev) => ({ ...prev, telegramPhone: v }))}
        label={t("telegramPhone.studentLabel")}
      />
      <Input
        label={t("student.fullName")}
        placeholder={t("student.fullName")}
        icon={<HiUser />}
        readOnly={!!existingStudent}
        value={form.fullName}
        onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
      />
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
          hint={hints ? t("student.parentPhoneHint") : undefined}
          icon={<HiPhone />}
          prefix={PHONE_PREFIX}
          variant="white"
          value={form.parentPhone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, parentPhone: e.target.value.replace(/\D/g, "").slice(0, 9) }))
          }
        />
      </TelegramPhoneField>
    </>
  );
}

export default StudentContactFields;
