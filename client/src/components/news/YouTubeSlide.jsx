import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlay } from "react-icons/hi2";
import LazyImage from "../../ui/LazyImage";
import { youtubeEmbed, youtubeThumb } from "./newsUtils";

/**
 * YouTube slayd: avval faqat thumbnail + Play (iframe oldindan yuklanmaydi —
 * tez ochiladi va YouTube kuzatuvi foydalanuvchi bosmaguncha yo'q). Bosilgach
 * shu joyning o'zida `youtube-nocookie` iframe autoplay bilan o'ynaydi.
 * Slayd almashganda komponent unmount bo'ladi — video to'xtaydi.
 */
function YouTubeSlide({ id, title }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={youtubeEmbed(id)}
        title={title || "YouTube"}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={t("news.playVideo")}
      className="group absolute inset-0 w-full h-full cursor-pointer"
    >
      <LazyImage src={youtubeThumb(id)} alt={title || ""} className="w-full h-full object-cover" />
      <span className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center justify-center size-16 rounded-full bg-white/95 dark:bg-night-900/95 text-red-600 dark:text-red-400 shadow-lg dark:shadow-none group-hover:scale-105 transition-transform">
          <HiPlay className="text-3xl translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

export default YouTubeSlide;
