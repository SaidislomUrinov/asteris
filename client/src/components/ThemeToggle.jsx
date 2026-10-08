import { useTranslation } from "react-i18next";
import { HiMoon, HiSun } from "react-icons/hi2";
import useTheme from "../hooks/useTheme";

// Top panel — kunduzgi/tungi rejim almashtirgichi. Ko'rinishi yonidagi "?"
// va qo'ng'iroqcha bilan bir xil (to'q fondagi shaffof ikonka-tugma).
export default function ThemeToggle() {
  const { t } = useTranslation();
  const { isDark, toggle } = useTheme();
  const label = isDark ? t("theme.toLight") : t("theme.toDark");

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
    >
      {isDark ? <HiSun size={18} /> : <HiMoon size={18} />}
    </button>
  );
}
