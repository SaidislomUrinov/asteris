import { useSelector } from "react-redux";
import { HiChartPie } from "react-icons/hi";
import {
  HiAcademicCap,
  HiBriefcase,
  HiCalendarDays,
  HiChatBubbleLeftRight,
  HiCog6Tooth,
  HiCreditCard,
  HiCircleStack,
  HiPlayCircle,
  HiRectangleStack,
  HiUser,
  HiUserCircle,
  HiUserGroup,
  HiUsers,
  HiVideoCamera,
  HiViewfinderCircle,
  HiWallet,
} from "react-icons/hi2";
import useCan from "./useCan";
import useFeature from "./useFeature";
import {
  FINANCE_PATHS,
  SCHEDULE_PATHS,
  SETTINGS_PATHS,
  useFinanceTabs,
  useScheduleTabs,
  useSettingsTabs,
} from "./useSectionTabs";
import ScanFaceIcon from "../ui/ScanFaceIcon";

// Menyu bandlari — YAGONA manba. Chap menyu (Navbar) ro'yxatni to'liq chizadi,
// mobil pastki tab-bar (MobileTabBar) esa shu ro'yxatdan rolga qarab 5 tasini
// oladi. Avval shartlar/ikonka/yozuv ikki joyda alohida yozilgan va bir-biridan
// farqlanib ketgan edi. Shartlar App.jsx marshrutlari bilan bir xil.
// `match` — bir nechta yo'lda aktiv bo'ladigan bo'lim (TabsLayout).
export default function useNavItems() {
  const { authType, role } = useSelector((e) => e.user);
  const can = useCan();
  const hasFeature = useFeature();
  const settingsTabs = useSettingsTabs();
  const scheduleTabs = useScheduleTabs();
  const financeTabs = useFinanceTabs();
  const isOwner = authType === "owner";
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);

  return [
    { key: "dashboard", to: "/dashboard", icon: HiChartPie, labelKey: "nav.dashboard" },
    can("lead:view") && !isTeacher && { key: "leads", to: "/leads", icon: HiViewfinderCircle, labelKey: "nav.leads" },
    isOwner && { key: "staff", to: "/staff", icon: HiBriefcase, labelKey: "nav.staff" },
    can("group:view") && { key: "groups", to: "/groups", icon: HiUserGroup, labelKey: "nav.groups" },
    // Individual o'quvchilar — yordamchi o'qituvchida yo'q (individual guruhda
    // assistant bo'lmaydi), docs/API_CONTRACT_individual_students.md §4.
    can("group:view") &&
      role !== "assistant" && { key: "individual", to: "/individual", icon: HiUserCircle, labelKey: "nav.individual" },
    scheduleTabs.length > 0 && {
      key: "schedule",
      to: scheduleTabs[0].to,
      match: SCHEDULE_PATHS,
      icon: HiCalendarDays,
      labelKey: "nav.schedule",
    },
    isTeacher && { key: "lesson", to: "/lesson", icon: HiPlayCircle, labelKey: "nav.lesson" },
    isTeacher &&
      hasFeature("lesson.planning") && { key: "myPlans", to: "/my-plans", icon: HiRectangleStack, labelKey: "nav.myPlans" },
    can("student:view") && !isTeacher && { key: "students", to: "/students", icon: HiUsers, labelKey: "nav.students" },
    can("attendance:create") &&
      hasFeature("attendance.qr") && { key: "qrAttendance", to: "/qr-attendance", icon: ScanFaceIcon, labelKey: "nav.qrAttendance" },
    financeTabs.length > 0 && {
      key: "finance",
      to: financeTabs[0].to,
      match: FINANCE_PATHS,
      icon: HiWallet,
      labelKey: "nav.financeSection",
    },
    can("sms:view") &&
      !isTeacher &&
      hasFeature("sms.notification") && { key: "sms", to: "/sms", icon: HiChatBubbleLeftRight, labelKey: "nav.sms" },
    can("certificate:view") &&
      hasFeature("certificate.manage") && { key: "certificates", to: "/certificates", icon: HiAcademicCap, labelKey: "nav.certificates" },
    // WECOIN — o'qituvchi/yordamchida yo'q (coin:* ularga berilmaydi).
    can("coin:view") &&
      !isTeacher &&
      hasFeature("gamification.coins") && { key: "coins", to: "/coins", icon: HiCircleStack, labelKey: "nav.coins" },
    { key: "profile", to: "/profile", icon: HiUser, labelKey: "nav.profile" },
    settingsTabs.length > 0 && {
      key: "settings",
      to: settingsTabs[0].to,
      match: SETTINGS_PATHS,
      icon: HiCog6Tooth,
      labelKey: "nav.settings",
    },
    // Video qo'llanmalar — barcha rollar (docs/API_CONTRACT_tutorial_videos_v2.md § 4).
    { key: "videoLessons", to: "/video-lessons", icon: HiVideoCamera, labelKey: "nav.videoLessons" },
    // Tariflar — Sozlamalar ostida alohida band (obuna holati tez-tez
    // tekshiriladi, tab ichida yashirinib qolmasin).
    isOwner && { key: "subscription", to: "/subscription", icon: HiCreditCard, labelKey: "nav.subscription" },
  ].filter(Boolean);
}

// Mobil pastki tab-bar: rolga qarab eng ko'p ishlatiladigan bo'limlar (tartib
// muhim — mavjud bo'lganlarning birinchi 5 tasi olinadi).
const ROLE_TAB_KEYS = {
  owner: ["dashboard", "groups", "students", "staff", "settings"],
  teacher: ["dashboard", "lesson", "groups", "finance", "profile"],
  // Yordamchi o'qituvchi — o'qituvchi bilan bir xil ish oqimi.
  assistant: ["dashboard", "lesson", "groups", "finance", "profile"],
  default: ["dashboard", "students", "groups", "finance", "profile"],
};

export const pickTabBarItems = (items, authType, role) => {
  const keys = authType === "owner" ? ROLE_TAB_KEYS.owner : ROLE_TAB_KEYS[role] || ROLE_TAB_KEYS.default;
  const byKey = Object.fromEntries(items.map((item) => [item.key, item]));
  return keys.map((key) => byKey[key]).filter(Boolean).slice(0, 5);
};
