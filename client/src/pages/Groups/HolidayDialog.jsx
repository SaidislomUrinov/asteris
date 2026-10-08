import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiNoSymbol, HiTrash } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";

// Kalendarda bitta dars kunini bosganda ochiladi — mijoz shu kunni dam olish
// kuni deb e'lon qiladi va AYNAN SHU YERDA (belgilash vaqtida) shu kun uchun
// to'lov davom etsinmi yoki yo'qmi hal qilinadi. "Yo'q" — kun hisob-kitobdan
// butunlay chiqariladi, narx qolgan dars kunlariga qayta taqsimlanadi
// (adolatli — na filial, na o'quvchi yutqazmaydi). "Ha" — faqat vizual belgi,
// to'lovga ta'sir qilmaydi (masalan bayram sababli dars ko'chirilgan bo'lsa).
function HolidayDialog({ open, onClose, date, existing, onMark, onUnmark, saving }) {
  const { t } = useTranslation();
  // Sabab davomat matritsasida shu kun ustiga borilganda izoh bo'lib chiqadi.
  // Boshlang'ich qiymat mount paytida olinadi — LessonCalendar komponentga
  // `key={sana}` beradi, ya'ni har sana uchun yangi nusxa yaratiladi.
  const [note, setNote] = useState(existing?.note || "");

  return (
    <Dialog open={open} onClose={onClose} title={t("group.holidayDialogTitle", { date })}>
      <div className="flex flex-col gap-4 w-full">
        <p className="text-base text-slate-600 dark:text-slate-300">{t("group.holidayDialogHint")}</p>

        <Input
          label={t("group.holidayNote")}
          placeholder={t("group.holidayNotePlaceholder")}
          variant="white"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(false, note.trim())}
          className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-night-700 hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-500/15 text-left cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-11 h-11 shrink-0 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-xl">
            <HiNoSymbol />
          </div>
          <div>
            <p className="font-bold text-base text-slate-800 dark:text-slate-100">{t("group.holidayNotChargeable")}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("group.holidayNotChargeableDesc")}</p>
          </div>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => onMark(true, note.trim())}
          className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 dark:border-night-700 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/15 text-left cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-11 h-11 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
            <HiBanknotes />
          </div>
          <div>
            <p className="font-bold text-base text-slate-800 dark:text-slate-100">{t("group.holidayChargeable")}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("group.holidayChargeableDesc")}</p>
          </div>
        </button>

        {existing && (
          <Button color="black" variant="outlined" loading={saving} className="gap-1.5 text-base" onClick={onUnmark}>
            <HiTrash className="text-lg" />
            {t("group.holidayUnmark")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

export default HolidayDialog;
