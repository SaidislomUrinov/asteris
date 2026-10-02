// Server `StudentLead` modeli bilan bir xil ro'yxatlar (API_CONTRACT_student_leads.md §1).
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const TIMES = ["any", "morning", "afternoon", "evening"];
export const SOURCES = ["walkIn", "phone", "instagram", "telegram", "friend", "banner", "website", "other"];
export const STATUSES = ["new", "contacted", "rejected", "enrolled"];
export const PHONE_PREFIX = "+998";

export const STATUS_COLOR = {
  new: "blue",
  contacted: "orange",
  rejected: "slate",
  enrolled: "emerald",
};

// Tanlangan lidlar orasida eng ko'p uchragan kunlar — yangi guruh formasi
// shu bilan oldindan to'ldiriladi (hammasi xohlagan kunlar birinchi).
export const suggestDays = (leads) => {
  const count = {};
  leads.forEach((l) => (l.preferredDays || []).forEach((d) => (count[d] = (count[d] || 0) + 1)));
  const max = Math.max(0, ...Object.values(count));
  if (!max) return [];
  return DAYS.filter((d) => count[d] === max);
};
