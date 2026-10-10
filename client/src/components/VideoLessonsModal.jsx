import { useTranslation } from "react-i18next";
import { HiVideoCamera } from "react-icons/hi2";
import Dialog from "../ui/Dialog";
import { extractYouTubeId } from "../utils/youtube";

/**
 * Video darslik modali — Yordam menyusi ("Joriy sahifa videosi") va
 * Video qo'llanmalar sahifasi ochadi. Ochilganda video o'zi ijro etiladi
 * (autoplay); yopilganda Dialog kontentni olib tashlaydi — ovoz to'xtaydi.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{ youtubeUrl: string, title?: string } | undefined} props.video
 * @param {string} [props.title] - modal sarlavhasi
 * @param {string} [props.eyebrow] - sarlavha tepasidagi mayda yorliq (masalan "#3")
 */
function VideoLessonsModal({ open, onClose, video, title, eyebrow }) {
  const { t } = useTranslation();
  const videoId = extractYouTubeId(video?.youtubeUrl);
  const heading = title || video?.title || t("common.videoLessons");

  return (
    <Dialog open={open} onClose={onClose} title={heading} eyebrow={eyebrow} widthClass="md:w-215">
      {videoId ? (
        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={heading}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full py-10 gap-2 text-slate-400 dark:text-slate-500">
          <HiVideoCamera className="text-4xl" />
          <span className="text-sm">{t("common.videoLessonsComingSoon")}</span>
        </div>
      )}
    </Dialog>
  );
}

export default VideoLessonsModal;
