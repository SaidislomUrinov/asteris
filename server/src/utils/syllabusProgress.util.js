const { Types } = require("mongoose");
const Attendance = require("../models/Attendance");

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

// O'tilgan darslar soni = shu guruh bo'yicha davomat belgilangan UNIKAL
// sanalar soni + guruhning boshlanish nuqtasi (lessonOffset).
//
// Dam olish kunida davomat belgilanmaydi → o'sha kun o'zi tashlab ketiladi,
// alohida holiday logikasi shart emas. O'tgan kun keyinroq belgilansa ham
// son to'g'ri qoladi, chunki (guruh, sana) juftligi Attendance'da unikal.
const countDoneLessons = async (clientId, groupId, lessonOffset = 0) => {
  const marked = await Attendance.countDocuments({ client: clientId, group: groupId });
  return marked + (Number(lessonOffset) || 0);
};

// Bir nechta guruh uchun bitta so'rovda davomat kunlari xaritasi — guruhlar
// ro'yxatida N+1 so'rov bo'lmasligi uchun (GroupCard chipi).
const countDoneMap = async (clientId, groupIds = []) => {
  if (!groupIds.length) return {};
  const rows = await Attendance.aggregate([
    { $match: { client: oid(clientId), group: { $in: groupIds.map(oid) } } },
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
};

// `doneCount` va yoyilgan darslar ro'yxatidan progress obyektini yasaydi.
// `nextNo` — KEYINGI o'tiladigan dars ("joriy dars"), tugagan bo'lsa null.
const buildProgress = (lessons, doneCount, moduleCount) => {
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

module.exports = { flattenLessons, countDoneLessons, countDoneMap, buildProgress };
