import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  HiChatBubbleLeftRight,
  HiPlayCircle,
  HiQuestionMarkCircle,
} from "react-icons/hi2";
import DropMenu from "../ui/DropMenu";
import ChatWidget from "./ChatWidget";
import VideoLessonsModal from "./VideoLessonsModal";
import useChat from "../hooks/useChat";
import useTutorialVideo from "../hooks/useTutorialVideo";
import { resolveSectionKey, videoSectionLabelKey } from "../utils/navSections";

// Top panel "?" — joriy sahifa videosi va qo'llab-quvvatlash chati. Barcha
// videolar sahifasi (/video-lessons) Sidebar'da, Sozlamalar ostida
// (docs/API_CONTRACT_tutorial_videos_v2.md § 4). Joriy sahifaga video
// bo'lmasa birinchi band ko'rinmaydi. O'qilmagan chat xabari "?" ustida
// qizil nuqta bo'ladi.
export default function HelpMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [modal, setModal] = useState(null); // "video" | "chat" | null
  const chat = useChat(true);

  const sectionKey = resolveSectionKey(pathname);
  const video = useTutorialVideo(sectionKey);
  const unread = chat.unreadCount;

  const items = [
    video && {
      label: t("help.currentVideo"),
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
      <VideoLessonsModal
        open={modal === "video"}
        onClose={close}
        video={video}
        eyebrow={sectionKey ? t(videoSectionLabelKey(sectionKey)) : undefined}
      />
      <ChatWidget open={modal === "chat"} onClose={close} chat={chat} />
    </>
  );
}
