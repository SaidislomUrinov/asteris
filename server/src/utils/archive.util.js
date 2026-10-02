const Student = require("../models/Student");
const emit = require("./emitter.util");
const { getNow } = require("./date.util");

// Arxiv kaskadining YAGONA joyi — API_CONTRACT_archive.md §2.
//
// Guruh arxivlanganda uning o'quvchilari HUJJAT darajasida tegilmaydi (bir
// o'quvchi bir nechta guruhda o'qiydi), faqat SHU guruhga tegishli
// `Student.groups[]` a'zoligi arxivlanadi. Shu bilan arxivlangan guruh
// qarzdorligi butun loyihadan (dashboard, hisobot, qarz chip...) tushib
// qoladi, chunki hamma joyda hisob `status === "active"` bo'yicha yuritiladi.
//
// `updateMany` + `arrayFilters` bilan yozilmadi: `statusBeforeArchive` ga
// AYNAN o'sha yozuvning joriy `status`ini ko'chirish kerak (maydondan
// maydonga), buni oddiy `$set` bajara olmaydi. Bir guruhdagi o'quvchilar
// soni o'nlab bo'lgani uchun hujjatma-hujjat yozish arzon.

const archiveGroupEntries = async (groupId) => {
  const now = getNow();
  const students = await Student.find({ "groups.group": groupId });
  let count = 0;

  for (const student of students) {
    let touched = false;
    for (const entry of student.groups) {
      if (String(entry.group) !== String(groupId)) continue;
      if (entry.status === "archived") continue;
      entry.statusBeforeArchive = entry.status;
      entry.status = "archived";
      entry.archivedAt = now;
      entry.archivedWithGroup = true;
      touched = true;
      count += 1;
    }
    if (touched) await student.save();
  }

  return count;
};

// Faqat KASKAD bilan arxivlangan a'zoliklar tiklanadi — qo'lda arxivlangani
// (`archivedWithGroup === false`) guruh qaytarilganda ham arxivda qoladi.
const restoreGroupEntries = async (groupId) => {
  const students = await Student.find({
    "groups.group": groupId,
    "groups.status": "archived",
  });
  let count = 0;

  for (const student of students) {
    let touched = false;
    for (const entry of student.groups) {
      if (String(entry.group) !== String(groupId)) continue;
      if (entry.status !== "archived" || !entry.archivedWithGroup) continue;
      entry.status = entry.statusBeforeArchive || "active";
      entry.statusBeforeArchive = null;
      entry.archivedAt = null;
      entry.archivedWithGroup = false;
      touched = true;
      count += 1;
    }
    if (touched) await student.save();
  }

  return count;
};

// Arxiv o'zgardi — Arxiv sahifasi va tegishli ro'yxatlar (Guruhlar,
// O'quvchilar, Xonalar, Fanlar, Hodimlar) refetch qilishi uchun. Boshliq
// `client:{id}` xonasida, Hodim `center:{id}` xonasida bo'lgani uchun
// ikkalasiga ham yuboriladi (frontend `type` bo'yicha filtrlaydi).
const emitArchiveChanged = (clientId, centerId, type, id, action) => {
  const payload = {
    type,
    id: String(id),
    action,
    center: centerId ? String(centerId) : null,
  };
  emit(`client:${String(clientId)}`, "archive:changed", payload);
  if (centerId) emit(`center:${String(centerId)}`, "archive:changed", payload);
};

module.exports = { archiveGroupEntries, restoreGroupEntries, emitArchiveChanged };
