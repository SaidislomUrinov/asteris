// Bosh sahifadagi dars/guruh kartalari uchun umumiy yordamchilar.

const toMin = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const nowMinutes = (date = new Date()) => date.getHours() * 60 + date.getMinutes();

// Dars holati — vaqt bo'yicha (Reception bosh sahifasidagi bilan bir xil mantiq).
export const lessonState = (g, mins) => {
  const start = toMin(g.startTime);
  const end = toMin(g.endTime);
  if (start === null || end === null) return "upcoming";
  if (mins >= start && mins <= end) return "ongoing";
  if (mins > end) return "finished";
  return "upcoming";
};

// API `label`ni "Fan - ID" ko'rinishida beradi — kartada fan sarlavha,
// ID esa alohida belgi bo'lib chiqishi uchun ajratib olinadi.
export const groupCode = (g) => {
  const prefix = `${g.subject || "?"} - `;
  return g.label?.startsWith(prefix) ? g.label.slice(prefix.length) : "";
};
