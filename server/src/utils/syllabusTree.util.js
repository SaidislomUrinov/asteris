const { Types } = require("mongoose");

// Modul/dars daraxti qoidalari — guruh dasturi (Syllabus) ham, o'qituvchining
// shablon rejasi (TeachingPlan) ham AYNAN bir xil shakl va cheklovlardan
// foydalanadi (API_CONTRACT_teaching_plans.md §2). Ikki servisga tarqatib
// yozilsa, ertami-kech biri o'zgarib, import paytida reja va dastur bir-biriga
// mos kelmay qolardi.

// Daraxt hajmi cheklovlari — bitta hujjatga cheksiz modul/dars yozib
// yuborilsa Mongo hujjat limitiga (16MB) yaqinlashardi va frontend
// akkordeoni ishlatib bo'lmas holga kelardi.
const MAX_MODULES = 50;
const MAX_LESSONS_PER_MODULE = 200;

// Frontenddan kelgan daraxtni tozalaydi va tekshiradi. `_id` yuborilsa
// SAQLANADI (frontend qatorlarining key'i va tahrir holati buzilmasligi
// uchun), yo'q bo'lsa yangi generatsiya qilinadi.
const normalizeModules = (raw) => {
  if (!Array.isArray(raw)) throw new Error("syllabus.invalidModules");
  if (raw.length > MAX_MODULES) throw new Error("syllabus.tooManyModules");

  return raw.map((mod) => {
    const title = String(mod?.title || "").trim();
    if (!title) throw new Error("syllabus.titleRequired");

    const rawLessons = Array.isArray(mod?.lessons) ? mod.lessons : [];
    if (rawLessons.length > MAX_LESSONS_PER_MODULE) throw new Error("syllabus.tooManyLessons");

    return {
      _id: Types.ObjectId.isValid(mod?._id) ? new Types.ObjectId(mod._id) : new Types.ObjectId(),
      title,
      lessons: rawLessons.map((lesson) => {
        const lessonTitle = String(lesson?.title || "").trim();
        if (!lessonTitle) throw new Error("syllabus.titleRequired");
        return {
          _id: Types.ObjectId.isValid(lesson?._id)
            ? new Types.ObjectId(lesson._id)
            : new Types.ObjectId(),
          title: lessonTitle,
          description: String(lesson?.description || "").trim(),
          homework: String(lesson?.homework || "").trim(),
        };
      }),
    };
  });
};

// To'liq NUSXA — barcha `_id` lar yangidan generatsiya qilinadi (aks holda
// ikki hujjat bir xil dars id'larini ulashib, frontendda chalkashardi).
const cloneModules = (modules = []) =>
  modules.map((mod) => ({
    _id: new Types.ObjectId(),
    title: mod.title,
    lessons: (mod.lessons || []).map((lesson) => ({
      _id: new Types.ObjectId(),
      title: lesson.title,
      description: lesson.description || "",
      homework: lesson.homework || "",
    })),
  }));

// To'liq daraxt DTO (tahrirlash uchun).
const moduleDTO = (mod) => ({
  _id: String(mod._id),
  title: mod.title,
  lessons: (mod.lessons || []).map((l) => ({
    _id: String(l._id),
    title: l.title,
    description: l.description || "",
    homework: l.homework || "",
  })),
});

// Yengil daraxt — faqat nomlar ("Hozir qaysi darsdamiz?" tanlovchisi uchun).
const lightModules = (modules = []) =>
  modules.map((mod) => ({
    _id: String(mod._id),
    title: mod.title,
    lessons: (mod.lessons || []).map((l) => ({ _id: String(l._id), title: l.title })),
  }));

const countLessons = (modules = []) =>
  modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);

module.exports = {
  MAX_MODULES,
  MAX_LESSONS_PER_MODULE,
  normalizeModules,
  cloneModules,
  moduleDTO,
  lightModules,
  countLessons,
};
