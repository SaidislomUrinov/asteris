import { useTranslation } from "react-i18next";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno
// (Heroicons'da Telegram brend ikonkasi yo'q).
import { FaTelegram } from "react-icons/fa";

/**
 * O'quvchining IKKI Telegram holati yonma-yon: o'quvchining o'zi va ota-onasi
 * (docs/API_CONTRACT_student_telegram_pair.md). Har pill'da rol nomi yoziladi —
 * qaysi biri ulangani bir qarashda ko'rinadi: ulangan — Telegram ko'ki,
 * ulanmagan — kulrang, ikonka xira.
 *
 * @param {Object} props
 * @param {"linked"|"none"} [props.student="none"]
 * @param {"linked"|"none"} [props.parent="none"]
 * @param {string} [props.className]
 */
function TelegramStatusBadges({ student = "none", parent = "none", className = "" }) {
  const { t } = useTranslation();
  const items = [
    { key: "student", status: student, who: t("student.telegramWhoStudent"), label: t("student.studentTelegram") },
    { key: "parent", status: parent, who: t("student.telegramWhoParent"), label: t("student.parentTelegram") },
  ];

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      {items.map(({ key, status, who, label }) => {
        const linked = status === "linked";
        const text = `${label}: ${linked ? t("student.telegramLinked") : t("student.telegramNotLinked")}`;
        return (
          <span
            key={key}
            title={text}
            aria-label={text}
            role="img"
            className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ring-1 ring-inset ${
              linked
                ? "bg-[#229ED9]/10 text-[#229ED9] ring-[#229ED9]/20"
                : "bg-slate-50 text-slate-400 ring-slate-200"
            }`}
          >
            <FaTelegram className={`text-xs ${linked ? "" : "opacity-60"}`} aria-hidden="true" />
            <span>{who}</span>
          </span>
        );
      })}
    </span>
  );
}

export default TelegramStatusBadges;
