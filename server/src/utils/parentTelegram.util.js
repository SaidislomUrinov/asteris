const Parent = require("../models/Parent");
const Student = require("../models/Student");
const emit = require("./emitter.util");
const { normalizeTelegramPhone } = require("./phone.util");
const { telegramFieldsOf } = require("./telegramPhone.util");

// O'quvchi kartasidagi IKKI Telegram holati
// (API_CONTRACT_student_contact_telegram.md §3–4, API_CONTRACT_student_telegram_pair.md):
//
//   parentTelegram  — `Student.parentTelegramPhone` ga "parent" roli bilan ulangan chat
//   studentTelegram — `Student.telegramPhone` ga "student" roli bilan ulangan chat
// (API_CONTRACT_telegram_phone.md §3 — Telegram mosligi FAQAT Telegram raqami
// bo'yicha; asosiy telefon bilan emas).
//
// Rol `parent.service.effectiveRole` bilan bir xil hal qilinadi: saqlangan rolda
// o'quvchi bo'lsa — o'sha; aks holda parentTelegramPhone mosligi bo'lsa "parent",
// bo'lmasa "student". Bot bloklangan (`telegram.blockedAt`) chat — ulanmagan.

const LINKED = "linked";
const NONE = "none";

const uniqPhones = (raw = []) =>
  [...new Set((Array.isArray(raw) ? raw : [raw]).map(normalizeTelegramPhone).filter(Boolean))];

// Berilgan raqamlar qaysi rolda ulangan — N+1 siz, 3 ta so'rov.
// Qaytaradi: { parent: Set<phone>, student: Set<phone> }.
const linkedPhoneSets = async (rawPhones = []) => {
  const phones = uniqPhones(rawPhones);
  const sets = { parent: new Set(), student: new Set() };
  if (!phones.length) return sets;

  const parents = await Parent.find(
    { phone: { $in: phones }, "telegram.blockedAt": null },
    { phone: 1, role: 1 },
  ).lean();
  if (!parents.length) return sets;

  const linked = [...new Set(parents.map((p) => p.phone))];
  const [asParent, asStudent] = await Promise.all([
    Student.distinct("parentTelegramPhone", { isDeleted: false, parentTelegramPhone: { $in: linked } }),
    Student.distinct("telegramPhone", { isDeleted: false, telegramPhone: { $in: linked } }),
  ]);
  const has = { parent: new Set(asParent), student: new Set(asStudent) };

  for (const p of parents) {
    const role =
      p.role && has[p.role]?.has(p.phone)
        ? p.role
        : has.parent.has(p.phone)
          ? "parent"
          : has.student.has(p.phone)
            ? "student"
            : "parent";
    sets[role].add(p.phone);
  }
  return sets;
};

const statusOf = (set, rawPhone) => {
  const phone = normalizeTelegramPhone(rawPhone);
  return phone && set.has(phone) ? LINKED : NONE;
};

// DTO'da ham, lean hujjatda ham ishlaydi — Telegram maydonlari bo'lmasa
// (migratsiyadan oldingi hujjat) telefondan hisoblanadi.
const tgPhonesOf = (s) => {
  const t = telegramFieldsOf(s);
  return [t.parentTelegramPhone, t.telegramPhone];
};

const statusesOf = (sets, s) => {
  const [parentTg, studentTg] = tgPhonesOf(s);
  return {
    parentTelegram: statusOf(sets.parent, parentTg),
    studentTelegram: statusOf(sets.student, studentTg),
  };
};

// DTO(lar)ga `parentTelegram` va `studentTelegram` maydonlarini qo'shadi.
// Massiv yoki bitta obyekt qabul qiladi, xuddi shu shaklda qaytaradi.
const attachTelegramStatus = async (dtos) => {
  const list = Array.isArray(dtos) ? dtos : [dtos];
  const items = list.filter(Boolean);
  if (!items.length) return dtos;
  const sets = await linkedPhoneSets(items.flatMap(tgPhonesOf));
  for (const s of items) Object.assign(s, statusesOf(sets, s));
  return dtos;
};

// Raqam(lar)ning Telegram holati o'zgardi — shu raqam `parentTelegramPhone` YOKI
// `telegramPhone` bo'lgan o'quvchilar a'zo bo'lgan `center:*`/`client:*` xonalariga
// `student:telegram` yuboriladi. Holat QAYTA hisoblanadi (bir raqamga bir
// nechta chat ulangan bo'lishi mumkin). Xato yutiladi: realtime xabar asosiy
// amalni buzmasligi kerak.
const emitParentTelegramChanged = async (rawPhones = []) => {
  try {
    const phones = uniqPhones(rawPhones);
    if (!phones.length) return;

    const students = await Student.find(
      {
        isDeleted: false,
        $or: [{ parentTelegramPhone: { $in: phones } }, { telegramPhone: { $in: phones } }],
      },
      {
        _id: 1,
        phone: 1,
        parentPhone: 1,
        telegramSame: 1,
        telegramPhone: 1,
        parentTelegramSame: 1,
        parentTelegramPhone: 1,
        "groups.center": 1,
        "groups.client": 1,
      },
    ).lean();
    if (!students.length) return;

    const sets = await linkedPhoneSets(students.flatMap(tgPhonesOf));

    // Har xonaga faqat SHU xonaga tegishli o'quvchilar ketadi — boshqa
    // tenant'ning o'quvchi ID'lari sizib chiqmasin.
    const rooms = new Map();
    for (const s of students) {
      const item = { studentId: String(s._id), ...statusesOf(sets, s) };
      for (const g of s.groups || []) {
        for (const room of [`center:${g.center}`, `client:${g.client}`]) {
          if (!rooms.has(room)) rooms.set(room, new Map());
          rooms.get(room).set(item.studentId, item);
        }
      }
    }
    for (const [room, items] of rooms) {
      emit(room, "student:telegram", { items: [...items.values()] });
    }
  } catch (error) {
    console.error("[parentTelegram] emit failed:", error?.message || error);
  }
};

module.exports = {
  LINKED,
  NONE,
  attachTelegramStatus,
  emitParentTelegramChanged,
};
