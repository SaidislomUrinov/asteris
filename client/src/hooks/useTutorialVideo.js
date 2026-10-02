import { useSelector } from "react-redux";

export default function useTutorialVideo(sectionKey) {
  return useSelector((s) => s.tutorialVideos[sectionKey]);
}
