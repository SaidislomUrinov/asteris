import { request } from "./http";

export const authTelegram = (initData) => request("post", "/parent-auth/telegram", { initData });

export const getMe = () => request("get", "/parent/me");
export const getChildren = () => request("get", "/parent/children");
export const getAttendance = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/attendance`, null, { month });
export const getGrades = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/grades`, null, { month });
export const getEntryPayments = (entryId) => request("get", `/parent/entries/${entryId}/payments`);
export const getPayments = () => request("get", "/parent/payments");
export const getNotifications = (page = 1, type) =>
  request("get", "/parent/notifications", null, { page, type: type || undefined });
export const readAllNotifications = () => request("patch", "/parent/notifications/read-all");
export const patchSettings = (body) => request("patch", "/parent/settings", body);
export const unlink = () => request("post", "/parent/unlink");
// O'quvchi roli (docs/API_CONTRACT_student_role_homework.md §3)
export const setRole = (role) => request("patch", "/parent/role", { role });
export const getRank = (entryId) => request("get", `/parent/entries/${entryId}/rank`);
export const getHomework = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/homework`, null, { month });
// Yutuq nishonlari (docs/API_CONTRACT_badges_monthly_rank.md §C)
export const getBadges = (entryId) => request("get", `/parent/entries/${entryId}/badges`);
// Dars rejasi — o'tilgan/bugungi/keyingi mavzular (docs/API_CONTRACT_parent_lesson_plan.md)
export const getLessonPlan = (entryId) => request("get", `/parent/entries/${entryId}/lesson-plan`);
