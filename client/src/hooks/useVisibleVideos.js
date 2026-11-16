import { useSelector } from "react-redux";
import useNavItems from "./useNavItems";
import { useFinanceTabs, useScheduleTabs, useSettingsTabs } from "./useSectionTabs";
import { filterVisibleVideos } from "../utils/visibleVideos";

/** Joriy foydalanuvchi ko'ra oladigan video qo'llanmalar (utils/visibleVideos.js). */
export default function useVisibleVideos() {
  const authType = useSelector((e) => e.user.authType);
  const videos = useSelector((s) => s.tutorialVideos);
  const items = useNavItems();
  const tabs = [...useSettingsTabs(), ...useScheduleTabs(), ...useFinanceTabs()];
  return filterVisibleVideos(videos, authType, items, tabs);
}
