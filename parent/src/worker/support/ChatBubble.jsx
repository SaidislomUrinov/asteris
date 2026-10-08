import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi2";
import { LinkifiedText } from "../../components/LinkifiedText";
import { haptic, openLink, openTelegramLink } from "../../lib/telegram";
import { cn } from "../../utils/cn";
import { isMineSender } from "../constants";
import { chatImageSrc, chatTime } from "./chatUtils";

// Admin yuborgan HTML (server `sanitizeChatHtml` dan o'tgan) ichidagi
// havolalar Telegram'da WebApp'ni yopmasdan ochiladi.
const onHtmlClick = (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a) return;
  e.preventDefault();
  haptic("light");
  if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(a.href)) openTelegramLink(a.href);
  else openLink(a.href);
};

// O'zimniki — yuborildi (bitta belgi) / admin o'qidi (ikkita belgi).
const ReadTicks = ({ read }) => (
  <span className="inline-flex items-center" aria-hidden="true">
    <HiCheck className="w-3.5 h-3.5" />
    {read && <HiCheck className="w-3.5 h-3.5 -ml-2.5" />}
  </span>
);

// Bitta xabar (§B.2): o'zimniki o'ngda accent, admin chapda karta (ism bilan),
// tizim (avto-javob) xabari markazda xira.
export const ChatBubble = ({ message: m, onOpenImage }) => {
  const { t } = useTranslation();
  const time = chatTime(m.createdAt);

  if (m.sender?.kind === "system") {
    return (
      <div className="self-center max-w-[88%] text-center text-[12.5px] leading-snug text-hint/90 bg-ink/6 rounded-2xl px-3 py-1.5 my-1">
        <span className="whitespace-pre-wrap break-words">{m.text}</span>
        <span className="tabular text-[10.5px] opacity-70 ml-1.5">{time}</span>
      </div>
    );
  }

  const mine = isMineSender(m);
  const isImage = m.type === "image";
  const meta = (
    <span className={cn("float-right ml-2.5 mt-[7px] -mb-0.5 inline-flex items-center gap-0.5 tabular text-[10.5px] leading-none select-none", mine ? "text-accent-fg/75" : "text-hint")}>
      {time}
      {mine && <ReadTicks read={m.readByAdmin} />}
    </span>
  );

  return (
    <div className={cn("flex flex-col max-w-[82%] min-w-0", mine ? "self-end items-end" : "self-start items-start")}>
      {!mine && (
        <span className="text-[11px] font-bold text-hint px-1 mb-0.5 truncate max-w-full">{m.sender?.name || t("worker.support.admin")}</span>
      )}
      <div
        className={cn(
          "rounded-[18px] text-[15px] leading-[1.35] min-w-0 max-w-full",
          mine ? "bg-accent text-accent-fg rounded-br-[6px]" : "bg-card text-ink rounded-bl-[6px]",
          isImage ? "p-1 overflow-hidden" : "px-3 py-1.5 overflow-hidden",
        )}
      >
        {isImage ? (
          <button
            type="button"
            onClick={() => onOpenImage(chatImageSrc(m.imageUrl))}
            aria-label={t("worker.support.openImage")}
            className="relative block active:opacity-80"
          >
            <img
              src={chatImageSrc(m.imageUrl)}
              alt=""
              loading="lazy"
              className="block max-w-full max-h-64 min-w-24 min-h-16 rounded-[14px] object-cover bg-ink/6"
            />
            <span className="absolute right-2 bottom-2 px-1.5 py-1 rounded-full bg-black/45 text-white">
              <span className="inline-flex items-center gap-1 tabular text-[10.5px] leading-none">
                {time}
                {mine && <ReadTicks read={m.readByAdmin} />}
              </span>
            </span>
          </button>
        ) : (
          <>
            {m.format === "html" ? (
              <div
                onClick={onHtmlClick}
                className="break-words [&_a]:underline [&_a]:font-semibold [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_a]:text-link"
                dangerouslySetInnerHTML={{ __html: m.text }}
              />
            ) : (
              <LinkifiedText
                text={m.text}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  mine && "[&_a]:text-accent-fg [&_a]:decoration-accent-fg/50",
                )}
              />
            )}
            {meta}
          </>
        )}
      </div>
    </div>
  );
};
