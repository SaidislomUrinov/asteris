// "Dars rejalarim" sahifalari uchun umumiy yordamchilar (React'siz).

// Sana — `DD.MM.YYYY` (Intl uz "M09" tuzog'idan qochish uchun qo'lda).
// Backend vaqtlari unix SONIYA (getNow).
export const formatPlanDate = (seconds) => {
  if (!seconds) return "—";
  const d = new Date(seconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// PUT /teaching-plans/:id uchun daraxt — faqat kontraktdagi maydonlar.
export const serializeModules = (modules) =>
  modules.map((m) => ({
    _id: m._id,
    title: m.title,
    lessons: (m.lessons || []).map((l) => ({
      _id: l._id,
      title: l.title,
      description: l.description || "",
      homework: l.homework || "",
    })),
  }));

// Massiv elementini bir pog'ona yuqoriga/pastga surish (yangi massiv).
export const moveItem = (list, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const countLessons = (modules) =>
  modules.reduce((sum, m) => sum + (m.lessons || []).length, 0);
