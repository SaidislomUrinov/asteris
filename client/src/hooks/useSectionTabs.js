import { useSelector } from "react-redux";
import useCan from "./useCan";
import useFeature from "./useFeature";

// Bir nechta sahifani menyuda BITTA band qilib, ustida umumiy tab qatori
// (TabsLayout) bilan ko'rsatadigan bo'limlar. URL'lar o'zgarmagan — faqat
// menyu ixchamlashgan. Shartlar App.jsx marshrutlari bilan bir xil.

const useRoleFlags = () => {
  const { authType, role } = useSelector((e) => e.user);
  return {
    isOwner: authType === "owner",
    isTeacher: authType === "staff" && ["teacher", "assistant"].includes(role),
  };
};

// "Sozlamalar" — kamdan-kam ochiladigan sahifalar. Tariflar bu yerda emas —
// menyuda Sozlamalar ostida alohida band.
export const SETTINGS_PATHS = ["/rooms", "/subjects", "/archive", "/audit-log"];

export function useSettingsTabs() {
  const { isOwner, isTeacher } = useRoleFlags();
  const can = useCan();
  const hasFeature = useFeature();

  return [
    can("room:view") && hasFeature("room.control") && { to: "/rooms", labelKey: "nav.rooms" },
    can("subject:view") && !isTeacher && { to: "/subjects", labelKey: "nav.subjects" },
    can("archive:view") && !isTeacher && { to: "/archive", labelKey: "nav.archive" },
    isOwner && { to: "/audit-log", labelKey: "nav.auditLog" },
  ].filter(Boolean);
}

// "Jadval" — haftalik dars jadvali (drag/drop) va oylik kalendar (dam olish
// kunlari). Haftalik jadval O'qituvchi/Yordamchiga yopiq (`blockTeachingRoles`).
export const SCHEDULE_PATHS = ["/schedule", "/calendar"];

export function useScheduleTabs() {
  const { isTeacher } = useRoleFlags();
  const can = useCan();

  return [
    can("group:update") && !isTeacher && { to: "/schedule", labelKey: "nav.scheduleWeek" },
    can("calendar:view") && { to: "/calendar", labelKey: "nav.calendar" },
  ].filter(Boolean);
}

// "Moliya" — Tushumlar, Xarajatlar, Ish haqi, Hisobotlar bitta band. Hodimda
// birinchi tab — o'z hisobi (`/finance`: oyligim/tranzaksiyalarim).
// Samaradorlik moliyaviy hisobotli tarifda Hisobotlar ichida tab bo'lib
// turadi — bu yerda alohida tab faqat undan tashqarida.
export const FINANCE_PATHS = ["/finance", "/revenue", "/expenses", "/salary", "/reports"];

export function useFinanceTabs() {
  const { isOwner } = useRoleFlags();
  const can = useCan();
  const hasFeature = useFeature();

  return [
    !isOwner && { to: "/finance", labelKey: "nav.myFinance" },
    isOwner && { to: "/revenue", labelKey: "nav.revenue" },
    can("expense:view") && hasFeature("finance.expense") && { to: "/expenses", labelKey: "nav.expenses" },
    can("salary:view") && { to: "/salary", labelKey: "nav.salary" },
    can("report:view") &&
      (hasFeature("finance.report") || hasFeature("attendance.report")) && { to: "/reports", labelKey: "nav.reports" },
    can("report:view") &&
      hasFeature("teacher.performance") &&
      !hasFeature("finance.report") && { to: "/reports/teacher-performance", labelKey: "nav.teacherPerformance" },
  ].filter(Boolean);
}
