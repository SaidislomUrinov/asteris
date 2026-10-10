import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiVideoCamera } from "react-icons/hi2";
import VideoLessonsModal from "../../components/VideoLessonsModal";
import VideoLessonCard from "./VideoLessonCard";
import { videoSectionLabelKey } from "../../utils/navSections";

/**
 * Video qo'llanmalar (`/video-lessons`) — admin belgilagan tartibda barcha
 * videolar grid ko'rinishida, "#N Sarlavha". "Ko'rish" → modal + autoplay
 * (docs/API_CONTRACT_tutorial_videos_v2.md § 4). Ro'yxat ilova ochilishida
 * bir marta yuklanadi (App.jsx), bu yerda qayta so'rov yo'q.
 */
function VideoLessons() {
  const { t } = useTranslation();
  const videos = useSelector((s) => s.tutorialVideos);
  const [active, setActive] = useState(null); // { video, index }

  const titleOf = (video) => video.title || t(videoSectionLabelKey(video.sectionKey));

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* Sahifa nomi Top panelda — bu yerda takrorlanmaydi. */}
        <p className="text-sm text-slate-500 dark:text-slate-400 min-w-0">{t("videoLessons.subtitle")}</p>
        {videos.length > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-night-800 text-[13px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            {t("videoLessons.count", { count: videos.length })}
          </span>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-night-800 text-2xl text-slate-400 dark:text-slate-500">
            <HiVideoCamera aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{t("videoLessons.empty")}</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("videoLessons.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {videos.map((video, index) => (
            <VideoLessonCard
              key={video.sectionKey}
              number={index + 1}
              title={titleOf(video)}
              sectionLabel={t(videoSectionLabelKey(video.sectionKey))}
              youtubeUrl={video.youtubeUrl}
              onWatch={() => setActive({ video, index })}
            />
          ))}
        </div>
      )}

      <VideoLessonsModal
        open={!!active}
        onClose={() => setActive(null)}
        video={active?.video}
        title={active ? `#${active.index + 1} ${titleOf(active.video)}` : ""}
        eyebrow={active ? t(videoSectionLabelKey(active.video.sectionKey)) : undefined}
      />
    </div>
  );
}

export default VideoLessons;
