import { useTranslation } from "react-i18next";
import { HiCalendarDays } from "react-icons/hi2";
import Input from "../../ui/Input";
import { tashkentDay } from "./startDate.util";

/**
 * "O'qishni boshlagan sana" maydoni — qo'shish (StudentDialog) va tahrirlash
 * (StudentEditDialog) oynalarida bir xil. `min` — guruh faollashgan kun,
 * `max` — bugun (kelajak sana tanlanmaydi).
 *
 * @param {Object} props
 * @param {string} props.value - "YYYY-MM-DD"
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.min] - "YYYY-MM-DD"
 * @param {string} [props.label]
 * @param {string} [props.error] - xato matni (bo'lsa yordamchi matn o'rnida qizil)
 */
function StartDateField({ value, onChange, min, label, error }) {
  const { t } = useTranslation();
  const today = tashkentDay();
  return (
    <Input
      type="date"
      label={label || t("student.startDate")}
      icon={<HiCalendarDays />}
      min={min && min <= today ? min : undefined}
      max={today}
      error={!!error}
      hint={error || t("student.startDateHint")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default StartDateField;
