// Oy dars kunlaridan boshlang'ich sana: bugun dars kuni bo'lsa — bugun,
// aks holda oxirgi o'tgan (yoki bugungi) kun, u ham bo'lmasa birinchi kun.
// `selected` ro'yxatda bo'lsa — o'sha (client MonthlyAttendance bilan bir xil).
export const pickDate = (days = [], today = "", selected = "") => {
  if (!days.length) return "";
  if (selected && days.some((d) => d.date === selected)) return selected;
  if (days.some((d) => d.date === today)) return today;
  const past = days.filter((d) => d.date <= today);
  return (past[past.length - 1] || days[0]).date;
};

// Belgilab/baho qo'yib bo'lmaydigan kun: kelajak, dam olish, boshqa guruhdan
// o'tgan (faqat o'qish) yoki o'qituvchi chegarasidan oldingi kun.
export const lockReason = (day, minDate = "") => {
  if (!day) return "noDay";
  if (day.holiday) return "holiday";
  if (day.future) return "future";
  if (day.transferred) return "transferred";
  if (minDate && day.date < minDate) return "teacherLimit";
  return null;
};
