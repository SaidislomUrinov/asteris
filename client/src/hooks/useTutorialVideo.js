import { useSelector } from "react-redux";

// Bo'lim videosi: { sectionKey, youtubeUrl, title, order } yoki undefined.
export default function useTutorialVideo(sectionKey) {
  return useSelector((s) => s.tutorialVideos.find((v) => v.sectionKey === sectionKey));
}
