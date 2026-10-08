import { useTranslation } from "react-i18next";
import { HiVideoCamera } from "react-icons/hi2";
import Dialog from "../ui/Dialog";
import useTutorialVideo from "../hooks/useTutorialVideo";
import { extractYouTubeId } from "../utils/youtube";

/**
 * Video darslik modali — Top panel Yordam menyusi (`HelpMenu`) ochadi
 * (docs/API_CONTRACT_floating_video_lessons.md § 3.1). Avval
 * `TutorialVideoButton.jsx` ichida yashiringan Dialog+iframe/bo'sh-holat
 * logikasi shu yerga ko'chirildi, mustaqil komponent sifatida.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.sectionKey - qaysi bo'lim uchun video (TutorialVideo.sectionKey)
 * @param {string} [props.label] - bo'lim nomi, berilsa modal sarlavhasida ko'rinadi
 */
function VideoLessonsModal({ open, onClose, sectionKey, label }) {
  const { t } = useTranslation();
  const url = useTutorialVideo(sectionKey);
  const videoId = extractYouTubeId(url);
  const title = label ? `${label} — ${t("common.videoLessons")}` : t("common.videoLessons");

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {videoId ? (
        <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full py-10 gap-2 text-slate-400">
          <HiVideoCamera className="text-4xl" />
          <span className="text-sm">{t("common.videoLessonsComingSoon")}</span>
        </div>
      )}
    </Dialog>
  );
}

export default VideoLessonsModal;
