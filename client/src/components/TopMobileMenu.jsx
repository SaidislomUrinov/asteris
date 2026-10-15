import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  HiBuildingOffice2,
  HiChatBubbleLeftRight,
  HiCheck,
  HiMoon,
  HiPlayCircle,
  HiSquares2X2,
  HiSun,
  HiXMark,
} from "react-icons/hi2";
import ChatWidget from "./ChatWidget";
import VideoLessonsModal from "./VideoLessonsModal";
import useChat from "../hooks/useChat";
import useTheme, { setTheme } from "../hooks/useTheme";
import useTutorialVideo from "../hooks/useTutorialVideo";
import switchCenter from "../utils/switchCenter";
import { resolveSectionKey, videoSectionLabelKey } from "../utils/navSections";

function SectionTitle({ children }) {
  return (
    <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

// Kvadrat plitka (Qanday ishlaydi / Chat) — ikonka + nom.
function Tile({ icon, iconClass, label, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-night-800 border border-slate-100 dark:border-night-700 text-left active:bg-slate-100 dark:active:bg-night-700 transition-colors cursor-pointer"
    >
      <span className={`grid place-items-center size-9 rounded-lg text-lg ${iconClass}`}>{icon}</span>
      <span className="text-[13px] font-semibold leading-snug text-slate-700 dark:text-slate-200">{label}</span>
      {badge > 0 && (
        <span className="absolute top-2.5 right-2.5 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-red-500 text-white text-[11px] font-bold tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Mobil Top paneli o'ng tomonidagi 4 kvadratli menyu: filial, "Qanday
 * ishlaydi?" (joriy sahifa videosi + yordam chati) va Kun/Tun rejimi.
 * Desktopda bular Top'da alohida turadi (CenterSwitcher, HelpMenu,
 * ThemeToggle) — Top faqat bittasini render qiladi (ikki marta chat obunasi
 * bo'lmasin).
 */
export default function TopMobileMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // "video" | "chat" | null
  const { centers = [], activeCenter } = useSelector((e) => e.user);
  const { isDark } = useTheme();
  const chat = useChat(true);
  const sectionKey = resolveSectionKey(pathname);
  const video = useTutorialVideo(sectionKey);
  const unread = chat.unreadCount;

  const centerList = Array.isArray(centers) ? centers : [];
  const active = centerList.find((c) => c._id === activeCenter) || centerList[0];

  // Sahifa almashsa menyu yopiladi.
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const openModal = (name) => {
    setOpen(false);
    setModal(name);
  };

  return (
    <>
      <button
        type="button"
        data-intro="top-menu"
        onClick={() => setOpen((v) => !v)}
        title={t("topMenu.title")}
        aria-label={t("topMenu.title")}
        aria-expanded={open}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors cursor-pointer ${
          open ? "bg-white/14 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        {open ? <HiXMark size={20} /> : <HiSquares2X2 size={19} />}
        {unread > 0 && !open && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0b2050]" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 top-15 z-40 bg-slate-900/30" onClick={() => setOpen(false)} />
          <div className="fixed top-[68px] inset-x-3 z-50 flex flex-col gap-4 p-3 max-h-[calc(100dvh-84px)] overflow-y-auto rounded-2xl bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.35)] dark:shadow-none">
            {active && (
              <div className="flex flex-col gap-1.5">
                <SectionTitle>{t("topMenu.center")}</SectionTitle>
                <div className="flex flex-col gap-1">
                  {centerList.map((c) => {
                    const on = c._id === active._id;
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => !on && switchCenter(c._id)}
                        className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${
                          on
                            ? "bg-blue-50 dark:bg-blue-500/10 cursor-default"
                            : "active:bg-slate-50 dark:active:bg-night-800 cursor-pointer"
                        }`}
                      >
                        <span
                          className={`grid place-items-center size-8 shrink-0 rounded-lg ${
                            on
                              ? "bg-blue-500 text-white"
                              : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {on ? <HiCheck className="text-base" /> : <HiBuildingOffice2 className="text-base" />}
                        </span>
                        <span className="flex flex-col min-w-0">
                          <span
                            className={`truncate text-sm font-semibold ${
                              on ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {c.name}
                          </span>
                          {(on || c.status === "blocked") && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {on ? t("centerSwitch.current") : t("centerSwitch.blocked")}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <SectionTitle>{t("topMenu.howItWorks")}</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {video && (
                  <Tile
                    icon={<HiPlayCircle />}
                    iconClass="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    label={t("help.currentVideo")}
                    onClick={() => openModal("video")}
                  />
                )}
                <Tile
                  icon={<HiChatBubbleLeftRight />}
                  iconClass="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  label={t("help.chat")}
                  badge={unread}
                  onClick={() => openModal("chat")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <SectionTitle>{t("topMenu.theme")}</SectionTitle>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800">
                {[
                  { key: "light", icon: HiSun, label: t("topMenu.day"), on: !isDark },
                  { key: "dark", icon: HiMoon, label: t("topMenu.night"), on: isDark },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setTheme(m.key)}
                    aria-pressed={m.on}
                    className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      m.on
                        ? "bg-white dark:bg-night-900 text-slate-800 dark:text-slate-100 shadow-sm dark:shadow-none"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <m.icon className="text-base" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <VideoLessonsModal
        open={modal === "video"}
        onClose={() => setModal(null)}
        video={video}
        eyebrow={sectionKey ? t(videoSectionLabelKey(sectionKey)) : undefined}
      />
      <ChatWidget open={modal === "chat"} onClose={() => setModal(null)} chat={chat} />
    </>
  );
}
