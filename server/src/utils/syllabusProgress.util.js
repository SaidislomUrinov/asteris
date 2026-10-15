const { Types } = require("mongoose");
const Attendance = require("../models/Attendance");
const { todayString } = require("./date.util");

// Aggregate pipeline'da (find'dan farqli) satr ObjectId'ga AVTOMATIK
// keltirilmaydi — `req.client._id` esa zanjirga qarab satr ham, ObjectId
// ham bo'lishi mumkin.
const oid = (value) => (value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value)));

// Kurs dasturi progressi HECH QAYERDA SAQLANMAYDI — har safar hisoblanadi.
// Sabab: yagona haqiqat manbai davomat. "Bajarildi" tugmasi bo'lganda ikki
// manba bir-biriga mos kelmay qolardi (dars o'tilgan, lekin belgilanmagan).

// Modul daraxtini ketma-ket darslar ro'yxatiga yoyadi (flatten). Raqamlash
// 1 dan boshlanadi va butun dastur bo'ylab uzluksiz — modul chegarasida
// qaytadan boshlanmaydi.
const flattenLessons = (modules = []) => {
  const lessons = [];
  modules.forEach((mod, moduleIndex) => {
    (mod.lessons || []).forEach((lesson) => {
      lessons.push({
        _id: String(lesson._id),
        no: lessons.length + 1,
        moduleIndex,
        moduleTitle: mod.title || "",
        title: lesson.title || "",
        description: lesson.description || "",
        homework: lesson.homework || "",
      });
    });
  });
  return lessons;
};

// O'tilgan darslar soni = shu guruh bo'yicha BUGUNDAN OLDIN davomat
// belgilangan UNIKAL sanalar soni + guruhning boshlanish nuqtasi (lessonOffset).
// Bugungi dars (davomati belgilangan bo'lsa ham) — "joriy" dars, o'tilgan
// emas: aks holda davomat belgilangach "Joriy dars" bittaga sakrab, yuqoridagi
// "Bugungi dars" kartochkasi bilan mos kelmay qolardi (11 vs 12). Bu
// `offsetForCurrentLesson` formulasi bilan bir xil qoida.
//
// Dam olish kunida davomat belgilanmaydi → o'sha kun o'zi tashlab ketiladi,
// alohida holiday logikasi shart emas. O'tgan kun keyinroq belgilansa ham
// son to'g'ri qoladi, chunki (guruh, sana) juftligi Attendance'da unikal.
//
// `lessonOffset` MANFIY ham bo'lishi mumkin (reja guruh boshlanganidan keyin
// biriktirilgan) — shu sabab natija 0 bilan qisiladi (API_CONTRACT_teaching_plans.md §3).
const countDoneLessons = async (clientId, groupId, lessonOffset = 0) => {
  const marked = await Attendance.countDocuments({
    client: clientId,
    group: groupId,
    date: { $lt: todayString() },
  });
  return clampDone(marked + (Number(lessonOffset) || 0));
};

// `doneCount` ning yagona qisqichi — manfiy offset bilan o'tilgan darslar
// soni hech qachon 0 dan kichik bo'lmaydi.
const clampDone = (value) => Math.max(0, Number(value) || 0);

// "Hozir qaysi darsdamiz" (K, yoyilgan ro'yxatda 1-dan) → `lessonOffset`.
// YAGONA formula (API_CONTRACT_teaching_plans.md §3): K-dars = bugungi dars
// (bugun dars kuni bo'lsa) yoki eng yaqin keyingi dars kuni. Bugungi
// davomat belgilangan-belgilanmaganidan qat'i nazar `lessons[K-1]` ga tushadi,
// chunki faqat BUGUNDAN OLDINGI sanalar sanaladi.
const offsetForCurrentLesson = async (clientId, groupId, currentLessonNo) => {
  const before = await Attendance.countDocuments({
    client: clientId,
    group: groupId,
    date: { $lt: todayString() },
  });
  return currentLessonNo - 1 - before;
};

// Haqiqiy davomat sanalari (xronologik, "YYYY-MM-DD"). Kalendarda har bir
// darsni AYNAN qaysi kunda o'tilganini ko'rsatish uchun — shunchaki sana
// bo'yicha sanab chiqish (activatedAt'dan boshlab) darslar kuni bilan
// davomat belgilangan kun mos kelmasa (o'tkazib yuborilgan/kech belgilangan
// kun) chalkashtirib yuborardi. `lessonOffset`dan oldingi darslarning haqiqiy
// sanasi noma'lum (ilova ishlatilishidan oldin o'tilgan) — shu sabab bu
// ro'yxat FAQAT `lessonOffset`dan keyingi darslarga mos keladi.
const getDoneDates = async (clientId, groupId) => {
  const rows = await Attendance.find({ client: clientId, group: groupId }, { date: 1, _id: 0 })
    .sort({ date: 1 })
    .lean();
  return rows.map((r) => r.date);
};

// Bir nechta guruh uchun bitta so'rovda davomat kunlari xaritasi — guruhlar
// ro'yxatida N+1 so'rov bo'lmasligi uchun (GroupCard chipi).
const countDoneMap = async (clientId, groupIds = []) => {
  if (!groupIds.length) return {};
  const rows = await Attendance.aggregate([
    // Bugungi dars o'tilgan hisoblanmaydi (countDoneLessons izohiga qarang).
    { $match: { client: oid(clientId), group: { $in: groupIds.map(oid) }, date: { $lt: todayString() } } },
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
};

// `doneCount` va yoyilgan darslar ro'yxatidan progress obyektini yasaydi.
// `nextNo` — KEYINGI o'tiladigan dars ("joriy dars"), tugagan bo'lsa null.
const buildProgress = (lessons, rawDoneCount, moduleCount) => {
  const doneCount = clampDone(rawDoneCount);
  const totalLessons = lessons.length;
  const finished = totalLessons > 0 && doneCount >= totalLessons;
  const nextNo = finished || totalLessons === 0 ? null : doneCount + 1;
  const currentModuleIndex = nextNo ? lessons[nextNo - 1].moduleIndex : moduleCount - 1;

  return {
    doneCount,
    totalLessons,
    moduleCount,
    currentModuleIndex,
    nextNo,
    finished,
  };
};

module.exports = {
  flattenLessons,
  countDoneLessons,
  countDoneMap,
  getDoneDates,
  buildProgress,
  clampDone,
  offsetForCurrentLesson,
};
