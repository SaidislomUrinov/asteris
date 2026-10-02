import { shiftDay, todayStr } from "./format";

// Vazifa sanasining nisbiy holati: "today" | "tomorrow" | "future" | "past"
export const homeworkWhen = (date, today = todayStr()) => {
  if (date === today) return "today";
  if (date === shiftDay(today, 1)) return "tomorrow";
  return date > today ? "future" : "past";
};

// Eng yaqin vazifa: bugundan keyingi eng yaqini, bo'lmasa eng oxirgisi.
export const nearestHomework = (items = [], today = todayStr()) => {
  const upcoming = items.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length) return upcoming[0];
  return [...items].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
};
