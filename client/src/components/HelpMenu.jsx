import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  HiBookOpen,
  HiChatBubbleLeftRight,
  HiPlayCircle,
  HiQuestionMarkCircle,
} from "react-icons/hi2";
import DropMenu from "../ui/DropMenu";
import ChatWidget from "./ChatWidget";
import KnowledgeBaseModal from "./knowledge/KnowledgeBaseModal";
import VideoLessonsModal from "./VideoLessonsModal";
import useChat from "../hooks/useChat";
import useTutorialVideo from "../hooks/useTutorialVideo";
import { resolveKnowledgeKey } from "../knowledge";
import { resolveSectionKey } from "../utils/navSections";

// Top panel "?" — yordamning YAGONA kirish nuqtasi: joriy sahifa qo'llanmasi
// (Bilimlar bazasi), video darslik va qo'llab-quvvatlash chati. Avval bular
// uchta alohida joyda edi (header "?", suriladigan video tugma, o'ng-past
// chat tugmasi). Qo'llanma/video joriy sahifada bo'lmasa band ko'rinmaydi;
// chat doim bor. O'qilmagan chat xabari "?" ustida qizil nuqta bo'ladi.
export default function HelpMenu({ titleKey }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { authType, role } = useSelector((e) => e.user);
  const [modal, setModal] = useState(null); // "guide" | "video" | "chat" | null
  const chat = useChat(true);

  const articleKey = resolveKnowledgeKey(pathname, { authType, role });
  const sectionKey = resolveSectionKey(pathname);
  const videoUrl = useTutorialVideo(sectionKey);
  const label = titleKey ? t(titleKey) : "";
  const unread = chat.unreadCount;

  const items = [
    articleKey && {
      label: t("help.guide"),
      icon: HiBookOpen,
      iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
      onClick: () => setModal("guide"),
    },
    videoUrl && {
      label: t("help.video"),
      icon: HiPlayCircle,
      iconClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
      onClick: () => setModal("video"),
    },
    {
      label: unread > 0 ? `${t("help.chat")} (${unread})` : t("help.chat"),
      icon: HiChatBubbleLeftRight,
      iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      onClick: () => setModal("chat"),
    },
  ].filter(Boolean);

  const close = () => setModal(null);

  return (
    <>
      <DropMenu
        items={items}
        trigger={
          <span
            data-intro="help"
            title={t("help.title")}
            aria-label={t("help.title")}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
          >
            <HiQuestionMarkCircle size={18} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0b2050]" />
            )}
          </span>
        }
      />
      {articleKey && (
        <KnowledgeBaseModal
          open={modal === "guide"}
          onClose={close}
          articleKey={articleKey}
          titleKey={titleKey}
        />
      )}
      <VideoLessonsModal open={modal === "video"} onClose={close} sectionKey={sectionKey} label={label} />
      <ChatWidget open={modal === "chat"} onClose={close} chat={chat} />
    </>
  );
}
