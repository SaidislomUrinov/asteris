import { useTranslation } from "react-i18next";

// Rolga qarab rang — ro'yxatda kim yozayotganini bir qarashda ajratish uchun.
const TONE = {
  client: "bg-blue-50 text-blue-700",
  teacher: "bg-violet-50 text-violet-700",
  reception: "bg-amber-50 text-amber-700",
  assistant: "bg-cyan-50 text-cyan-700",
};

/**
 * Suhbat ishtirokchisi belgisi: "Mijoz" (Client Owner) yoki
 * "Ishchi · O'qituvchi / Resepshn / Assistent".
 *
 * @param {Object} props
 * @param {{kind: "client"|"staff", role?: string}|null} props.participant
 * @param {boolean} [props.inverted] - faol (ko'k fonli) qator ichida
 */
function ParticipantBadge({ participant, inverted = false }) {
  const { t } = useTranslation();
  if (!participant) return null;

  const isStaff = participant.kind === "staff";
  const label = isStaff
    ? `${t("chat.kindStaff")}${participant.role ? ` · ${t(`chat.role.${participant.role}`)}` : ""}`
    : t("chat.kindClient");
  const tone = inverted ? "bg-white/20 text-white" : TONE[isStaff ? participant.role : "client"] || TONE.client;

  return (
    <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-none ${tone}`}>
      {label}
    </span>
  );
}

export default ParticipantBadge;
