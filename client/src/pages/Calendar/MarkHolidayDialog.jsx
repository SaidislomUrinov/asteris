import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";

// Bir nechta tanlangan kunni Center darajasida dam olish kuni deb belgilash
// uchun modal — HolidayDialog (guruh darajasi) bilan bir xil UI tili,
// lekin bu yerda chargeable/not-chargeable tanlovi YO'Q (contract: center
// darajasida markazlash har doim guruhlarga chargeable:false credit sync
// qiladi, faqat ixtiyoriy izoh so'raladi).
function MarkHolidayDialog({ open, onClose, dates = [], onConfirm, saving }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");

  const sortedDates = [...dates].sort();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("calendar.markDialogTitle", { count: dates.length })}
    >
      <div className="flex flex-col gap-4 w-full">
        <p className="text-base text-slate-600 dark:text-slate-300">{t("calendar.markDialogHint")}</p>

        <div className="flex flex-wrap gap-1.5">
          {sortedDates.map((d) => (
            <span
              key={d}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-night-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              {d}
            </span>
          ))}
        </div>

        <Input
          label={t("calendar.holidayNote")}
          placeholder={t("calendar.holidayNotePlaceholder")}
          variant="white"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button
          color="red"
          loading={saving}
          disabled={!dates.length}
          onClick={() => onConfirm(note.trim())}
        >
          {t("calendar.markAction")}
        </Button>
      </div>
    </Dialog>
  );
}

export default MarkHolidayDialog;
