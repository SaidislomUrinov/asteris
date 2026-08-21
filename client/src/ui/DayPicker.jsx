import { useTranslation } from "react-i18next";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Hafta kunlari uchun multi-select chip qatori — filtr sifatida ishlatiladi.
 *
 * Oddiy `Select` o'rniga chip qatori tanlandi: 7 ta qiymat oz va bir vaqtda
 * bir nechtasini tanlash tabiiy (`FilterBar` gridining bitta katagiga sig'adi,
 * mobil filtr modalida ham xuddi shunday ishlaydi).
 *
 * @param {Object} props
 * @param {string[]} props.value - tanlangan kun kodlari
 * @param {(days: string[]) => void} props.onChange
 * @param {string} [props.placeholder] - tepadagi yorliq
 */
function DayPicker({ value = [], onChange, placeholder }) {
  const { t } = useTranslation();

  const toggle = (day) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);

  return (
    <div className="flex flex-col justify-center gap-1.5 w-full h-full min-w-0">
      {placeholder && <span className="text-xs text-slate-400 px-0.5">{placeholder}</span>}
      <div className="flex items-center gap-1 w-full">
        {DAYS.map((day) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              className={`flex-1 min-w-0 h-9 rounded-lg border text-xs font-semibold duration-150 ${
                on
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {t(`group.dayShort.${day}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DayPicker;
