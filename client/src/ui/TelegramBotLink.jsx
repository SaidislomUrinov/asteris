import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiOutlineDocumentDuplicate } from "react-icons/hi2";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno.
import { FaTelegram } from "react-icons/fa";
import useBotLink from "../hooks/useBotLink";
import { errorMsg, successMsg } from "../utils/alert";

// `navigator.clipboard` faqat secure context'da (https/localhost) bor —
// LAN IP orqali ochilganda eski usulga tushadi.
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  if (!ok) throw new Error("common.error");
};

/**
 * O'quvchi/ota-ona botining havolasi — bosilganda `https://t.me/{bot}` nusxalanadi,
 * o'qituvchi uni o'quvchilariga yuboradi (docs/API_CONTRACT_student_telegram_pair.md §5).
 * Bot sozlanmagan bo'lsa hech narsa chizilmaydi.
 *
 * @param {Object} props
 * @param {string} [props.className]
 */
function TelegramBotLink({ className = "" }) {
  const { t } = useTranslation();
  const bot = useBotLink();
  const [copied, setCopied] = useState(false);

  if (!bot) return null;

  const onCopy = async () => {
    try {
      await copyText(bot.link);
      setCopied(true);
      successMsg("student.botLinkCopied");
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`${t("student.botLinkHint")} — ${bot.link}`}
      className={`group inline-flex items-center gap-2 shrink-0 min-w-0 rounded-full bg-[#229ED9]/10 pl-2 pr-2.5 py-1.5 text-xs font-medium text-[#229ED9] ring-1 ring-inset ring-[#229ED9]/20 hover:bg-[#229ED9]/15 active:scale-[0.98] transition cursor-pointer ${className}`}
    >
      <FaTelegram className="text-base shrink-0" aria-hidden="true" />
      <span className="truncate">@{bot.username}</span>
      {copied ? (
        <HiCheck className="text-sm shrink-0" aria-hidden="true" />
      ) : (
        <HiOutlineDocumentDuplicate className="text-sm shrink-0 opacity-70 group-hover:opacity-100" aria-hidden="true" />
      )}
    </button>
  );
}

export default TelegramBotLink;
