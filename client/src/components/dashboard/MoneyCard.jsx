import NumberText from "../../ui/NumberText";

// Moliyaviy ko'rsatkichlar — sahifadagi ENG muhim raqamlar, shuning uchun
// katta, rangli (gradient) kartalarda. `NumberText`da `text-black dark:text-slate-100` qat'iy
// yozilgani uchun oq rang `!` bilan bekor qilinadi.
// `loading` — ma'lumot kelguncha raqam o'rnida skelet chiziq (karta o'zi
// darhol ko'rinadi, keyin "0" dan haqiqiy songa sakramaydi).
function MoneyCard({ icon, label, value, suffix, hint, gradient, shadow, loading = false }) {
  return (
    <div
      className={`relative overflow-hidden flex flex-col justify-between gap-4 p-5 rounded-2xl text-white bg-gradient-to-br ${gradient} shadow-lg ${shadow}`}
    >
      {/* Fon dekoratsiyasi — ikonka suvbelgi sifatida. Yuqori o'ng burchakda:
          pastda turganda summa va "so'm" ustiga tushib, o'qishni xiralashtirardi. */}
      <span className="absolute -right-4 -top-5 text-[5.5rem] leading-none text-white/[0.07] pointer-events-none">
        {icon}
      </span>

      <div className="relative flex items-center gap-2">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-white/20 dark:bg-night-900/20 text-lg">
          {icon}
        </span>
        <span className="text-sm font-medium text-white/90">{label}</span>
      </div>

      <div className="relative flex flex-col gap-0.5 min-w-0">
        {loading ? (
          <div className="flex flex-col gap-2 animate-pulse" aria-busy="true">
            <div className="h-7 sm:h-8 w-2/3 rounded-md bg-white/25" />
            {hint && <div className="h-3 w-1/2 rounded bg-white/20" />}
          </div>
        ) : (
          <>
            <span className="flex items-baseline gap-1.5 min-w-0">
              <NumberText className="!text-white !text-2xl sm:!text-3xl 2xl:!text-[2rem] font-bold leading-none truncate">
                {value}
              </NumberText>
              {suffix && <span className="text-sm text-white/70 shrink-0">{suffix}</span>}
            </span>
            {hint && <span className="text-xs text-white/70 truncate">{hint}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default MoneyCard;
