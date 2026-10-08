const Attendance = require("../models/Attendance");
const AttendanceSetting = require("../models/AttendanceSetting");
const Group = require("../models/Group");
const Center = require("../models/Center");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const {
  todayString,
  todayDayCode,
  currentMonthString,
  dateStringToUnix,
  addDays,
  addMonths,
  getNow,
} = require("../utils/date.util");
const crypto = require("crypto");
const moment = require("moment-timezone");

const TZ = "Asia/Tashkent";
const { countLessonDays, listLessonDates, JS_DAY_TO_CODE } = require("../utils/lessonDays.util");
const studentService = require("./student.service");
const parentNotification = require("./parentNotification.service");
const groupHolidayService = require("./groupHoliday.service");
const calendarService = require("./calendar.service");
const emit = require("../utils/emitter.util");
const { sourceWindowsOf, transferredAttendance } = require("../utils/transferOverlay.util");
const { planRollovers } = require("../utils/rollover.util");
const billingSettingService = require("./billingSetting.service");
const redisUtil = require("../utils/redis.util");
const redis = require("../configs/redis.config");
const keyConfig = require("../configs/key.config");

// Baho saralash (Bayes gradeScore) — utils/gradeScore.util.js.
const { groupStudentsSummary } = require("../utils/gradeScore.util");
const botNotify = require("../bot/notify");
const { escapeHtml } = require("../bot/escapeHtml");
const { t: botT } = require("../bot/i18n");
const audit = require("../utils/audit.util");
const { isValidObjectId } = require("mongoose");
const { photoFor } = require("../utils/studentPhoto.util");

// Sozlama yozuvlar kam o'zgaradi, lekin har davomat belgilashda (applyCredit)
// o'qiladi — cache-aside: avval Redis, topilmasa DB'dan olib Redis'ga
// joylanadi, `updateSettings`da kalit o'chiriladi (billingSetting.service.js
// bilan bir xil naqsh). TTL — faqat xavfsizlik chizig'i.
const CACHE_TTL = 3600;

// Berilgan oyda (bugungi kungacha, agar joriy oy bo'lsa — kelajakdagi
// kunlar hisobga olinmaydi) shu guruh uchun nechta dars kuni o'tganini
// hisoblaydi — "Belgilanmagan" (hali davomat belgilanmagan) ulushini
// topish uchun kerak (lessonDays * faol o'quvchilar soni = kutilgan yozuv,
// undan kam bo'lsa qolgani "belgilanmagan"). Asia/Tashkent kalendar kunlari
// bo'yicha (utils/lessonDays.util.js) — server qaysi timezone'da ishlashidan
// qat'iy nazar to'g'ri hisoblaydi.
function countLessonDaysInMonth(group, monthStr, holidayDates) {
  if (!group.activatedAt || !group.days?.length) return 0;

  const monthStartUnix = dateStringToUnix(`${monthStr}-01`);
  const nextMonthStartUnix = addMonths(monthStartUnix, 1);
  const isCurrentMonth = monthStr === currentMonthString();
  const boundaryUnix = isCurrentMonth ? addDays(dateStringToUnix(todayString()), 1) : nextMonthStartUnix;

  const fromUnix = Math.max(monthStartUnix, group.activatedAt);
  const toUnix = Math.min(boundaryUnix, nextMonthStartUnix);
  if (fromUnix >= toUnix) return 0;

  return countLessonDays(group.days, fromUnix, toUnix, holidayDates);
}

const SETTING_FIELDS = [
  "excusedRollsOverStudentFee",
  "unexcusedRollsOverStudentFee",
  "excusedTeacherSalaryWithheld",
  "unexcusedTeacherSalaryWithheld",
  "rolloverOnConsecutiveAbsence",
];

const settingDTO = (s) => ({
  excusedRollsOverStudentFee: s.excusedRollsOverStudentFee,
  unexcusedRollsOverStudentFee: s.unexcusedRollsOverStudentFee,
  excusedTeacherSalaryWithheld: s.excusedTeacherSalaryWithheld,
  unexcusedTeacherSalaryWithheld: s.unexcusedTeacherSalaryWithheld,
  rolloverOnConsecutiveAbsence: !!s.rolloverOnConsecutiveAbsence,
  lateAfterMinutes: s.lateAfterMinutes ?? 0,
});

// "HH:mm" dan bugungi kunning shu vaqtidagi unix — kechikishni aniqlash uchun.
const timeToUnixToday = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dateStringToUnix(todayString()) + h * 3600 + m * 60;
};

// Center darajasida — har filial o'z qoidasini tanlaydi.
const getOrCreateSettings = async (centerId) => {
  const cacheKey = keyConfig.attendanceSetting(centerId);
  const cached = await redisUtil.get(cacheKey);
  if (cached) return cached;

  let setting = await AttendanceSetting.findOne({ center: centerId });
  if (!setting) {
    const center = await Center.findById(centerId).select("client");
    try {
      setting = await AttendanceSetting.create({ client: center?.client, center: centerId });
    } catch (error) {
      // Parallel so'rov shu orada yaratib qo'ydi (center unique) — o'shani olamiz.
      if (error?.code !== 11000) throw error;
      setting = await AttendanceSetting.findOne({ center: centerId });
    }
  }

  const dto = settingDTO(setting);
  await redisUtil.set(cacheKey, dto, CACHE_TTL);
  return dto;
};

// Skan vaqtiga qarab guruh tanlash — o'quvchi bitta filialda bir nechta
// fanda o'qiganda "qaysi darsga keldi?" savoliga javob (docs/teacher-panel.md
// §1, API_CONTRACT_qr_scan_auto_group.md).
//
// Qoida: avval "hozir davom etayotgan" dars (boshlanishidan {GRACE} daqiqa
// oldin ~ tugashidan {GRACE} daqiqa keyin oralig'i), aks holda skan vaqtiga
// eng yaqin dars — lekin faqat {NEAR_WINDOW} daqiqa ichida bo'lsa. Ikkita
// nomzod bir-biriga juda yaqin bo'lsa (farq {AMBIGUOUS} daqiqadan kam) yoki
// vaqti ko'rsatilmagan guruh bo'lsa — TAXMIN QILINMAYDI, qabulxonachidan
// so'raladi (noto'g'ri guruhga yozib qo'yishdan ko'ra so'ragan yaxshi).
const GRACE_MIN = 15;
const NEAR_WINDOW_MIN = 90;
const AMBIGUOUS_MIN = 10;

const pickGroupByTime = (groups, now) => {
  const scored = groups.map((g) => {
    const start = timeToUnixToday(g.startTime);
    const end = timeToUnixToday(g.endTime);
    if (start === null || end === null) return { group: g, distance: null };
    const grace = GRACE_MIN * 60;
    // Dars davom etyapti (yoki chetiga juda yaqin) — masofa 0.
    if (now >= start - grace && now <= end + grace) return { group: g, distance: 0 };
    const distance = now < start ? start - now : now - end;
    return { group: g, distance };
  });

  // Vaqti kiritilmagan guruh bo'lsa taqqoslab bo'lmaydi.
  if (scored.some((x) => x.distance === null)) return null;

  scored.sort((a, b) => a.distance - b.distance);
  const [best, second] = scored;
  if (best.distance > NEAR_WINDOW_MIN * 60) return null;
  if (second && second.distance - best.distance < AMBIGUOUS_MIN * 60) return null;
  return best.group;
};

// 128 bit tasodifiy token — taxmin qilib bo'lmaydi. To'qnashuv amalda
// imkonsiz, lekin unique index bor ekan baribir tekshiriladi.
const uniqueQrToken = async () => {
  for (;;) {
    const token = crypto.randomBytes(16).toString("hex");
    if (!(await Student.exists({ qrToken: token }))) return token;
  }
};

// `group.name` IXTIYORIY qo'lda qo'yilgan nom — bo'lmasa (default `null`,
// aksariyat guruhda shunday) "Fan - activeId" ko'rinishida hisoblanadi
// (group.service.js DTO'dagi bilan bir xil qoida, API_CONTRACT_group_rename.md).
// Buni e'tiborsiz qoldirib to'g'ridan-to'g'ri `group.name`dan foydalanish
// QR kartada guruh/fan nomini deyarli har doim BO'SH qoldirar edi.
const groupDisplayLabel = (group, subjectName) =>
  group.name || `${subjectName || "?"} - ${group.activeId ?? group.pendingId ?? ""}`;

// O'quvchi + shu tenant (hodim bo'lsa — faqat O'Z FILIALI) a'zoliklari.
// `getQrToken` va `sendQrCard` uchun umumiy tenant/filial izolyatsiyasi.
const scopedStudentEntries = async (clientId, studentId, staffCenterId) => {
  if (!isValidObjectId(studentId)) throw new Error("student.notFound");
  const student = await Student.findOne({ _id: studentId, isDeleted: false });
  if (!student) throw new Error("student.notFound");
  const entries = student.groups.filter(
    (g) =>
      String(g.client) === String(clientId) &&
      (!staffCenterId || String(g.center) === String(staffCenterId)),
  );
  if (!entries.length) throw new Error("student.notFound");
  return { student, entries };
};

// QR karta PNG (API_CONTRACT_qr_card_send_and_worker_chat.md §A.2):
// mimetype + boshidagi PNG signature, hajm ≤ 2 MB.
const QR_CARD_MAX_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const QR_SEND_LOCK_SEC = 15;
const assertPngCard = (file) => {
  const buf = file && !Array.isArray(file) ? file.data : null;
  if (!Buffer.isBuffer(buf) || !buf.length) throw new Error("attendance.qrInvalidImage");
  if (file.mimetype !== "image/png") throw new Error("attendance.qrInvalidImage");
  if (buf.length > QR_CARD_MAX_BYTES || file.truncated) throw new Error("attendance.qrInvalidImage");
  if (buf.length < PNG_SIGNATURE.length || !buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("attendance.qrInvalidImage");
  }
  return buf;
};
const fillCaption = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));

const assertCenterOwnership = async (clientId, centerId) => {
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("center.notFound");
};

// Guruhning shu o'quvchi bo'yicha entry'siga davomat kreditini qo'llaydi —
// avval shu sanaga tegishli eski krediti (agar bo'lsa) olib tashlanadi, so'ng
// sozlamaga ko'ra yangi status kredit uchun mos bo'lsa qo'shiladi. Haqiqiy
// oylik narx (`price / lessonsPerMonth`) — hafta-kunlariga asosan taxminiy
// hisoblanadi (haftasiga necha marta dars bo'lsa, oyiga ~4 hafta deb).
// Sozlama shu guruh tegishli bo'lgan FILIAL (group.center)dan olinadi.
async function applyCredit(clientId, student, group, date, status) {
  const entry = student.groups.find(
    (g) => String(g.group) === String(group._id) && String(g.client) === String(clientId),
  );
  if (!entry) throw new Error("student.groupEntryNotFound");

  entry.credits = (entry.credits || []).filter((c) => c.date !== date);

  const setting = await getOrCreateSettings(group.center);
  const eligible =
    (status === "excused" && setting.excusedRollsOverStudentFee) ||
    (status === "absent" && setting.unexcusedRollsOverStudentFee);

  if (setting.rolloverOnConsecutiveAbsence) {
    // Ketma-ket kelmaslik rejimi: kunlik kredit YO'Q (ikki marta chegirma
    // bo'lmasligi uchun), o'rniga rollover bloklari qayta baholanadi.
    const changed = await applyRollovers(student, entry, group, setting);
    await student.save();
    if (changed) emit(`client:${clientId}`, "salary:updated", { group: String(group._id) });
    return;
  }

  // Summasi yo'q — faqat "shu kun uchun pul olinmaydi" belgisi. Haqiqiy
  // qiymati computeBilling'da jonli, JORIY narx/dars-kunlari asosida
  // hisoblanadi (student.service.js).
  if (eligible) entry.credits.push({ date });

  await student.save();
}

// Rollover (utils/rollover.util.js) — shu a'zolikning guruhdagi to'liq
// davomat tarixi bo'yicha bekor qilinadigan/yangi bloklarni topib, entry'ga
// qo'llaydi (saqlash chaqiruvchida). O'zgarish bo'lsa `true`.
async function applyRollovers(student, entry, group, setting) {
  const isEligible = (st) =>
    (st === "excused" && setting.excusedRollsOverStudentFee) ||
    (st === "absent" && setting.unexcusedRollsOverStudentFee);

  const sessions = await Attendance.find(
    { group: group._id, "records.student": student._id },
    { date: 1, records: { $elemMatch: { student: student._id } } },
  ).sort({ date: 1 });
  const history = sessions
    .filter((ses) => ses.records?.[0])
    .map((ses) => ({ date: ses.date, status: ses.records[0].status }));

  entry.rollovers = entry.rollovers || [];
  const { cancel, create } = planRollovers(history, entry.rollovers, isEligible);
  let changed = false;

  const now = getNow();
  for (const r of entry.rollovers) {
    if (cancel.some((id) => String(id) === String(r._id))) {
      r.status = "cancelled";
      r.cancelledAt = now;
      changed = true;
    }
  }

  if (create.length) {
    const { cycleMode } = await billingSettingService.getOrCreate(group.center);
    for (const dates of create) {
      const plan = studentService.rolloverAmountFor(entry, group, cycleMode, dates);
      // To'lanmagan kunlar o'tkazilmaydi — ko'chiradigan pul yo'q.
      if (!plan || plan.amount <= 0) continue;
      entry.rollovers.push({ dates, ...plan, status: "active", createdAt: now });
      changed = true;
    }
  }

  return changed;
}

const isDupKey = (error) => error?.code === 11000;

// (guruh, sana) sessiyasiga bitta o'quvchi yozuvini ATOMAR qo'yadi va oldingi
// statusni (yo'q bo'lsa null) qaytaradi.
//
// Avval findOne → new Attendance → save edi: bir guruhda bir necha o'quvchi
// tez-tez belgilanganda parallel so'rovlar ikkalasi ham "sessiya yo'q" deb
// ko'rib insert qilardi → E11000 (group_1_date_1). Butun hujjatni save()
// qilish esa parallel yozuvlarni bir-birining ustiga yozib yo'qotardi.
// Endi: sessiya upsert bilan yaratiladi (dup-key = boshqa so'rov yaratdi →
// qayta urinish), yozuv esa `$set` (mavjud) yoki `$push` (yangi) bilan.
async function upsertRecord(clientId, group, date, record) {
  const filter = { group: group._id, date };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await Attendance.updateOne(
        filter,
        { $setOnInsert: { client: clientId, center: group.center, group: group._id, date, records: [], createdAt: getNow() } },
        { upsert: true },
      );
      break;
    } catch (error) {
      if (!isDupKey(error) || attempt === 2) throw error;
    }
  }

  const now = getNow();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Mavjud yozuvni yangilash — `before` hujjatdan oldingi statusni olamiz.
    const before = await Attendance.findOneAndUpdate(
      { ...filter, "records.student": record.student },
      {
        $set: {
          "records.$.status": record.status,
          "records.$.reason": record.reason,
          "records.$.late": record.late,
          "records.$.source": record.source,
          updatedAt: now,
        },
      },
      { returnDocument: "before", projection: { records: 1 } },
    );
    if (before) {
      const prev = before.records.find((r) => String(r.student) === String(record.student));
      return prev?.status || null;
    }

    // Yozuv yo'q — faqat hali ham yo'q bo'lsa qo'shamiz (parallel so'rov
    // shu orada qo'shib qo'ygan bo'lsa matched=0 → $set yo'liga qaytamiz).
    const pushed = await Attendance.updateOne(
      { ...filter, "records.student": { $ne: record.student } },
      { $push: { records: record }, $set: { updatedAt: now } },
    );
    if (pushed.matchedCount) return null;
  }
  throw new Error("attendance.conflict");
}

// Qo'lda belgilash (`mark`) va QR skan (`scanQr`) uchun umumiy yadro —
// sessiyaga yozuv qo'yadi, to'lov kreditini qayta hisoblaydi va realtime
// event yuboradi. Ikkalasi bir xil natijaga olib kelishi shart, shuning
// uchun logika bitta joyda.
async function writeRecord(
  clientId,
  group,
  student,
  { status, reason = "", late = false, source = "manual", date = todayString() },
) {
  // Oldingi holat — mijoz statistikani QAYTA YUKLAMASDAN, faqat farqni
  // qo'llab yangilashi uchun kerak (donut: eski statusdan ayirib, yangisiga
  // qo'shadi). Yozuv birinchi marta qo'yilayotgan bo'lsa `null`.
  const previousStatus = await upsertRecord(clientId, group, date, {
    student: student._id,
    status,
    reason,
    late,
    source,
  });

  await applyCredit(clientId, student, group, date, status);
  const studentDTO = await studentService.getOne(clientId, student._id);
  const entry = studentDTO.groups.find((g) => String(g.group) === String(group._id));

  // Shu client'ning barcha ochiq sahifalari (Guruh detail, Student detail/
  // list) realtime yangilanadi — qo'shimcha fetch shart emas
  // (API_CONTRACT_attendance_socket.md).
  emit(`client:${clientId}`, "attendance:marked", {
    groupId: String(group._id),
    studentId: String(student._id),
    date,
    status,
    previousStatus,
    reason,
    late,
    source,
    entry,
  });

  // Ota-onaga Telegram (3 daqiqalik debounce, faqat bugungi dars).
  void parentNotification.onAttendance({
    clientId,
    groupId: group._id,
    studentId: student._id,
    date,
    status,
    late,
    reason,
    today: todayString(),
  });

  // Javob uchun yakuniy holat — parallel so'rovlar qo'shgan yozuvlar bilan.
  const session = await Attendance.findOne({ group: group._id, date }, { date: 1, records: 1 }).lean();
  return { session, entry, date };
}

module.exports = {
  getSettings: async (clientId, centerId) => {
    await assertCenterOwnership(clientId, centerId);
    return await getOrCreateSettings(centerId);
  },

  updateSettings: async (clientId, centerId, body) => {
    await assertCenterOwnership(clientId, centerId);
    const patch = {};
    for (const key of SETTING_FIELDS) {
      if (typeof body[key] === "boolean") patch[key] = body[key];
    }
    if (Number.isFinite(Number(body.lateAfterMinutes)) && Number(body.lateAfterMinutes) >= 0) {
      patch.lateAfterMinutes = Number(body.lateAfterMinutes);
    }
    const setting = await AttendanceSetting.findOneAndUpdate(
      { center: centerId },
      { $set: { client: clientId, ...patch } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await redisUtil.del(keyConfig.attendanceSetting(centerId));
    return settingDTO(setting);
  },

  // Bugungi kun uchun guruhning davomat sessiyasini qaytaradi (mavjud
  // bo'lmasa bo'sh records bilan, hujjat yaratilmaydi — faqat mark
  // qilinganda yaratiladi).
  getToday: async (clientId, groupId) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const date = todayString();
    const session = await Attendance.findOne({ group: groupId, date });
    return { date, records: session?.records || [] };
  },

  // Bugungi kun uchun bitta o'quvchining davomatini belgilaydi/yangilaydi
  // va shu bilan bog'liq to'lov kreditini qayta hisoblaydi.
  mark: async (clientId, groupId, body, staff = null) => {
    const { studentId, status, reason } = body;
    if (!["present", "absent", "excused"].includes(status)) {
      throw new Error("attendance.invalidStatus");
    }

    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    if (group.status !== "active") throw new Error("attendance.notLessonDay");

    // `date` berilmasa — bugun (avvalgi xulq). Berilsa: belgilanmay qolib
    // ketgan O'TGAN dars kunini ham to'g'rilash mumkin
    // (API_CONTRACT_attendance_month.md §2).
    const date = body.date || todayString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("attendance.notLessonDay");
    if (date > todayString()) throw new Error("attendance.notLessonDay");

    if (await calendarService.isCenterHoliday(group.center, date)) {
      throw new Error("calendar.centerHoliday");
    }

    // O'QITUVCHI va YORDAMCHI faqat BUGUN va KECHA uchun belgilaydi — undan eskisini
    // to'g'rilash Menejer/Resepshin zimmasida (docs/teacher-panel.md §3).
    // Aks holda oy oxirida davomatni "to'g'rilab" oylikni oshirish mumkin
    // bo'lib qolardi.
    if (["teacher", "assistant"].includes(staff?.role)) {
      const yesterday = moment.tz(TZ).subtract(1, "day").format("YYYY-MM-DD");
      if (date < yesterday) throw new Error("attendance.teacherDateLimit");
    }

    if (date === todayString()) {
      if (!group.days?.includes(todayDayCode())) throw new Error("attendance.notLessonDay");
    } else {
      // O'tgan sana haqiqatan shu guruhning dars kunimi: hafta kuni mos,
      // guruh faollashgan, dam olish deb belgilanmagan.
      const holidayDates = await groupHolidayService.getNonChargeableDates(groupId);
      const dayUnix = dateStringToUnix(date);
      const valid = listLessonDates(
        group.days,
        Math.max(dayUnix, group.activatedAt || 0),
        addDays(dayUnix, 1),
        holidayDates,
      );
      if (!valid.includes(date)) throw new Error("attendance.notLessonDay");
    }

    const student = await Student.findOne({
      _id: studentId,
      isDeleted: false,
      groups: { $elemMatch: { group: group._id, client: clientId } },
    });
    if (!student) throw new Error("student.notFound");

    const { session, entry } = await writeRecord(clientId, group, student, {
      status,
      reason: reason || "",
      date,
    });

    return { session: { date: session.date, records: session.records }, entry };
  },

  // O'quvchining doimiy QR tokenini qaytaradi — bo'lmasa shu yerda
  // yaratiladi (lazy). `reset: true` bo'lsa yangi token beriladi va eski
  // chop etilgan karta ishlamay qoladi (karta yo'qolganda kerak).
  getQrToken: async (clientId, studentId, reset = false, staffCenterId = null) => {
    // Tenant isolation — faqat shu client'ning o'quvchisi. Hodim bo'lsa
    // qo'shimcha ravishda faqat O'Z FILIALI o'quvchisi.
    const { student, entries } = await scopedStudentEntries(clientId, studentId, staffCenterId);

    if (!student.qrToken || reset) {
      student.qrToken = await uniqueQrToken();
      await student.save();
    }

    // Karta uchun: markaz nomi/logosi va o'quvchining FAOL guruhlari.
    const active = entries.filter((g) => g.status === "active");
    const [groups, center] = await Promise.all([
      Group.find({ _id: { $in: active.map((g) => g.group) }, client: clientId, isDeleted: false }).select(
        "name subject activeId pendingId",
      ),
      Center.findOne({ _id: (active[0] || entries[0]).center, client: clientId }).select("name logo"),
    ]);
    const subjects = await Subject.find({ _id: { $in: groups.map((g) => g.subject) } }).select("name");
    const subjectMap = Object.fromEntries(subjects.map((s) => [String(s._id), s.name]));

    return {
      studentId: String(student._id),
      fullName: student.fullName,
      phone: student.phone,
      qrToken: student.qrToken,
      center: { name: center?.name || "", logo: center?.logo || "" },
      groups: groups.map((g) => groupDisplayLabel(g, subjectMap[String(g.subject)])).filter(Boolean),
    };
  },

  // QR kartani (mijozda chizilgan PNG) o'quvchi va ota-onaning Telegramiga
  // rasm qilib yuboradi (API_CONTRACT_qr_card_send_and_worker_chat.md §A.2).
  // Fayl diskka yozilmaydi — `file.data` Buffer to'g'ridan-to'g'ri botga.
  // Filial/teacher doirasi `getQrToken` bilan bir xil (+ requireStudentScope).
  // Qaytaradi: `{ student, parent }` — har biri "sent" | "failed" | "none".
  sendQrCard: async (clientId, studentId, file, staffCenterId = null, actor = null) => {
    const { student, entries } = await scopedStudentEntries(clientId, studentId, staffCenterId);
    const buffer = assertPngCard(file);

    const recipients = await parentNotification.findParents(student, ["student", "parent"]);
    const targets = recipients.filter(({ parent }) => parent.telegram?.chatId);
    if (!targets.length) throw new Error("attendance.qrNoTelegram");

    // Spam himoyasi — 15 soniyada bir marta (ikki marta bosish / ikki qurilma).
    const lockKey = keyConfig.qrCardSend(student._id);
    const locked = await redis.set(lockKey, "1", "EX", QR_SEND_LOCK_SEC, "NX");
    if (!locked) throw new Error("attendance.qrSendTooSoon");

    // Karta qaysi markaznikiligi — `getQrToken` bilan bir xil tanlov.
    const active = entries.filter((g) => g.status === "active");
    const centerId = (active[0] || entries[0]).center;
    const center = await Center.findOne({ _id: centerId, client: clientId }).select("name");
    const vars = { name: escapeHtml(student.fullName || ""), center: escapeHtml(center?.name || "") };
    const filename = `qr-${String(student._id)}.png`;

    const result = { student: "none", parent: "none" };
    for (const { parent, role } of targets) {
      const lang = parent.telegram?.lang || "uz";
      const key = role === "student" ? "qrCardCaptionStudent" : "qrCardCaptionParent";
      const caption = fillCaption(botT(lang, key), vars);
      const res = await botNotify.sendPhotoToChat(parent.telegram.chatId, buffer, filename, { caption });
      await parentNotification.markBlockedIfNeeded(parent, res);
      if (!res.ok) console.error("attendance sendQrCard:", res.error);
      // Bir rolda bir nechta oluvchi bo'lsa — kamida bittasiga ketgani "sent".
      if (res.ok) result[role] = "sent";
      else if (result[role] === "none") result[role] = "failed";
    }

    void audit.log({
      actor,
      client: clientId,
      center: centerId,
      action: "attendance:qrCardSend",
      entity: { type: "student", id: student._id, label: student.fullName },
      meta: { ...result },
    });

    if (result.student !== "sent" && result.parent !== "sent") {
      // Hech kimga ketmadi — qayta urinish 15 soniya kutmasin.
      await redis.del(lockKey);
      throw new Error("attendance.qrSendFailed");
    }
    return result;
  },

  // Guruhning barcha FAOL o'quvchilari uchun QR kartalar (bitta PDF uchun).
  // Tokeni yo'q o'quvchilarga shu yerda bir martada (bulkWrite) yaratiladi —
  // mavjud o'quvchilar uchun alohida migratsiya shart emas.
  getGroupQrCards: async (clientId, groupId, staffCenterId = null) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false }).select(
      "name center subject activeId pendingId",
    );
    if (!group) throw new Error("group.notFound");
    if (staffCenterId && String(group.center) !== String(staffCenterId)) throw new Error("group.notFound");

    const [students, center, subject] = await Promise.all([
      Student.find({
        isDeleted: false,
        groups: { $elemMatch: { group: group._id, client: clientId, status: "active" } },
      })
        .select("fullName qrToken")
        .sort({ fullName: 1 }),
      Center.findOne({ _id: group.center, client: clientId }).select("name logo"),
      Subject.findById(group.subject).select("name"),
    ]);

    const ops = [];
    for (const s of students) {
      if (!s.qrToken) {
        s.qrToken = await uniqueQrToken();
        ops.push({
          updateOne: { filter: { _id: s._id, qrToken: { $not: { $type: "string" } } }, update: { $set: { qrToken: s.qrToken } } },
        });
      }
    }
    if (ops.length) await Student.bulkWrite(ops);

    return {
      center: { name: center?.name || "", logo: center?.logo || "" },
      group: { _id: String(group._id), name: groupDisplayLabel(group, subject?.name) },
      students: students.map((s) => ({ _id: String(s._id), fullName: s.fullName, qrToken: s.qrToken })),
    };
  },

  // QR skan — o'quvchi o'z doimiy QR'ini ko'rsatadi, Reception/Teacher
  // skanerlaydi. `groupId` ixtiyoriy: berilsa aynan shu guruhga yoziladi
  // (guruh sahifasidan skanerlanganda), berilmasa bugun darsi bor yagona
  // guruh avtomatik topiladi; bir nechta bo'lsa tanlash uchun ro'yxat
  // qaytariladi (xato emas, `needsGroup`).
  // `staffCenterId` — hodim (Staff) skanerlayotgan bo'lsa uning FILIALI.
  // Hodim faqat o'z filialining o'quvchisini belgilay oladi; Owner uchun
  // `null` keladi va cheklov qo'llanmaydi (u barcha filiallarni ko'radi) —
  // docs/API_CONTRACT_qr_attendance_staff.md.
  // `teachScope` — o'qituvchi/yordamchi skanerlasa `{ field, staffId }`:
  // faqat O'ZIGA biriktirilgan guruhlarga yozadi (davomat percent oylikka
  // ta'sir qiladi — avval boshqa o'qituvchi guruhiga ham yozilardi).
  scanQr: async (clientId, { token, groupId } = {}, staffCenterId = null, teachScope = null) => {
    if (typeof token !== "string") throw new Error("attendance.invalidQr");
    if (!token) throw new Error("attendance.invalidQr");

    const student = await Student.findOne({ qrToken: token, isDeleted: false });
    if (!student) throw new Error("attendance.invalidQr");

    const dayCode = todayDayCode();
    const clientEntries = student.groups.filter(
      (g) =>
        String(g.client) === String(clientId) &&
        g.status === "active" &&
        (!staffCenterId || String(g.center) === String(staffCenterId)),
    );
    if (!clientEntries.length) throw new Error("attendance.studentNotInCenter");

    const groups = await Group.find({
      _id: { $in: clientEntries.map((g) => g.group) },
      client: clientId,
      isDeleted: false,
      ...(teachScope && { [teachScope.field]: teachScope.staffId }),
    }).populate({ path: "subject", select: "name" });
    if (teachScope && !groups.length) throw new Error("attendance.studentNotInGroup");

    // Aniq guruh berilgan — o'quvchi aynan shu guruhda bo'lishi shart
    // ("noto'g'ri guruh — rad etish").
    let target;
    if (groupId) {
      target = groups.find((g) => String(g._id) === String(groupId));
      if (!target) throw new Error("attendance.studentNotInGroup");
    } else {
      const todayGroups = groups.filter((g) => g.status === "active" && g.days?.includes(dayCode));
      if (!todayGroups.length) throw new Error("attendance.noLessonToday");

      // Bugun allaqachon belgilangan darslar chiqarib tashlanadi — o'quvchi
      // ikkinchi fanga kelib kartani qayta o'tkazsa, tizim uni "takroriy
      // skan" deb emas, KEYINGI dars deb tushunadi.
      const todaySessions = await Attendance.find({
        group: { $in: todayGroups.map((g) => g._id) },
        date: todayString(),
      }).select("group records");
      const markedGroupIds = new Set(
        todaySessions
          .filter((x) => x.records.some((r) => String(r.student) === String(student._id)))
          .map((x) => String(x.group)),
      );
      const pending = todayGroups.filter((g) => !markedGroupIds.has(String(g._id)));

      // Hammasi belgilangan bo'lsa — pastdagi takroriy skan tarmog'iga tushadi.
      const candidates = pending.length ? pending : todayGroups;

      // Bittasi qolgan bo'lsa savol ham, taxmin ham kerak emas.
      target = candidates.length === 1 ? candidates[0] : pickGroupByTime(candidates, getNow());

      if (!target) {
        return {
          needsGroup: true,
          student: { _id: String(student._id), fullName: student.fullName, photo: photoFor(student, clientId) },
          groups: candidates.map((g) => ({
            _id: String(g._id),
            subject: g.subject?.name || "",
            activeId: g.activeId,
            startTime: g.startTime,
            endTime: g.endTime,
          })),
        };
      }
    }

    if (target.status !== "active" || !target.days?.includes(dayCode)) {
      throw new Error("attendance.notLessonDay");
    }

    // Takroriy skan — qayta yozilmaydi, mavjud yozuv qaytariladi va
    // frontend ogohlantirish toast'ini ko'rsatadi. Avval mavjud yozuv
    // o'qiladi (qulfsiz, faqat o'qish) — odatiy "operator bir necha soniya
    // ichida kartani ikkinchi marta o'tkazdi" holatida haqiqiy status/late
    // ko'rsatiladi, aks holda ("kech qoldi" yozuvi ham "keldi" deb
    // ko'rsatilardi — qulf yo'lida doim `late:false` qattiq yozilgan edi).
    const date = todayString();
    const session = await Attendance.findOne({ group: target._id, date });
    const already = session?.records.find((r) => String(r.student) === String(student._id));
    if (already) {
      return {
        duplicate: true,
        student: { _id: String(student._id), fullName: student.fullName, photo: photoFor(student, clientId) },
        groupId: String(target._id),
        subject: target.subject?.name || "",
        status: already.status,
        late: already.late || false,
      };
    }

    // Yozuv hali yo'q — lekin bir kartani skaner va kamera deyarli bir
    // vaqtda o'qisa ikkita parallel so'rov ikkalasi ham "yozuv yo'q" deb
    // ko'rib dublikat qo'shishi mumkin — shu o'quvchi+guruh+kun uchun qisqa
    // Redis qulfi (SET NX) buni oldini oladi. Bu holatda haqiqiy late
    // qiymatini hali bilib bo'lmaydi (yozuv hali yo'q) — "present" taxmin
    // qilinadi, chunki qulfni ilgari olgan so'rov aynan shuni yozadi.
    const lockKey = `qrscan:${target._id}:${student._id}:${date}`;
    const locked = await redis.set(lockKey, "1", "EX", 5, "NX");
    if (!locked) {
      return {
        duplicate: true,
        student: { _id: String(student._id), fullName: student.fullName, photo: photoFor(student, clientId) },
        groupId: String(target._id),
        subject: target.subject?.name || "",
        status: "present",
        late: false,
      };
    }

    const setting = await getOrCreateSettings(target.center);
    const startUnix = timeToUnixToday(target.startTime);
    const late =
      setting.lateAfterMinutes > 0 && startUnix !== null && getNow() > startUnix + setting.lateAfterMinutes * 60;

    const { entry } = await writeRecord(clientId, target, student, {
      status: "present",
      late,
      source: "qr",
    });

    return {
      student: { _id: String(student._id), fullName: student.fullName, photo: photoFor(student, clientId) },
      groupId: String(target._id),
      subject: target.subject?.name || "",
      status: "present",
      late,
      date,
      entry,
    };
  },

  // "Umumiy davomat" donut charti uchun — shu guruhning BARCHA o'quvchilari
  // bo'yicha, berilgan oydagi barcha sessiyalarni yig'ib, Kelgan/Sababli/
  // Sababsiz ulushini foizda qaytaradi. Kelajak oyga o'tib bo'lmaydi — bu
  // mantiqan to'g'ri (hali bo'lmagan darslar uchun statistika yo'q).
  getStats: async (clientId, groupId, month) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const targetMonth = month || currentMonthString();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("attendance.invalidMonth");
    if (targetMonth > currentMonthString()) throw new Error("attendance.futureMonthNotAllowed");

    const sessions = await Attendance.find({
      group: groupId,
      date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
    });

    const counts = { present: 0, absent: 0, excused: 0 };
    sessions.forEach((session) => {
      session.records.forEach((r) => {
        if (counts[r.status] !== undefined) counts[r.status] += 1;
      });
    });

    const [activeStudentsCount, groupHolidayDates, centerHolidays] = await Promise.all([
      Student.countDocuments({ groups: { $elemMatch: { group: groupId, status: "active" } } }),
      groupHolidayService.getNonChargeableDates(groupId),
      calendarService.getCenterHolidayDates(group.center),
    ]);
    const holidayDates = new Set([...groupHolidayDates, ...centerHolidays.map((h) => h.date)]);
    const lessonDays = countLessonDaysInMonth(group, targetMonth, holidayDates);
    const expected = lessonDays * activeStudentsCount;
    const recorded = counts.present + counts.absent + counts.excused;
    const unmarked = Math.max(0, expected - recorded);

    const total = recorded + unmarked;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return {
      month: targetMonth,
      ...counts,
      unmarked,
      total,
      presentPercent: pct(counts.present),
      absentPercent: pct(counts.absent),
      excusedPercent: pct(counts.excused),
      unmarkedPercent: pct(unmarked),
    };
  },

  // "O'quvchilar" ro'yxatini baho/davomat bo'yicha tartiblash uchun —
  // har bir FAOL o'quvchi bo'yicha BITTA OY (default joriy) davomat foizi va
  // baho o'rtachasi (API_CONTRACT_group_students_sort.md,
  // API_CONTRACT_badges_monthly_rank.md §A). `month` controller'da tekshirilgan.
  getStudentsSummary: async (clientId, groupId, month) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");
    // Hisob umumiy util'da — ota-ona/o'quvchi WebApp'idagi "guruhdagi o'rin"
    // ham aynan shu formuladan foydalanadi (API_CONTRACT_student_role_homework.md §3.5).
    return await groupStudentsSummary(group, { month });
  },

  // Oylik davomat matritsasi — o'quvchi × dars-kuni (Guruh detail
  // "Oylik davomat" tabi, API_CONTRACT_attendance_month.md).
  //
  // Ustunlar SOF dars kunlari: guruhning hafta kunlari, faollashgan sanadan
  // boshlab, bugungi kungacha (kelajak kunlar qo'yilmaydi) va dam olish deb
  // belgilangan kunlarsiz — ortiqcha bo'sh ustun chiqmaydi.
  getMonth: async (clientId, groupId, month) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const targetMonth = month || currentMonthString();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("attendance.invalidMonth");
    if (targetMonth > currentMonthString()) throw new Error("attendance.futureMonthNotAllowed");

    const today = todayString();
    const monthStart = dateStringToUnix(`${targetMonth}-01`);
    const nextMonthStart = addMonths(monthStart, 1);

    // Oyning BARCHA dars kunlari ko'rsatiladi — hali o'tmaganlari ham
    // (chegara oy oxiri, bugun emas) va dam olish deb belgilanganlari ham
    // (ular chetlab o'tilmaydi, alohida belgi bilan chiqadi).
    const from = Math.max(monthStart, group.activatedAt || monthStart);
    const dates = group.activatedAt ? listLessonDates(group.days, from, nextMonthStart) : [];

    const [holidays, centerHolidays] = await Promise.all([
      groupHolidayService.listForMonth(clientId, groupId, targetMonth),
      calendarService.getCenterHolidayDates(group.center, targetMonth),
    ]);
    const holidayMap = new Map(holidays.map((h) => [h.date, h]));
    // CenterHoliday ham xuddi shu vizual belgi sifatida ko'rsatiladi (group
    // darajasida qo'lda belgilanmagan bo'lsa ham) — har doim chargeable:false.
    for (const h of centerHolidays) {
      if (!holidayMap.has(h.date)) holidayMap.set(h.date, { chargeable: false, note: h.note || "" });
    }

    const [sessions, students] = await Promise.all([
      Attendance.find({
        group: groupId,
        date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
      }).select("date records"),
      Student.find(
        { isDeleted: false, groups: { $elemMatch: { group: groupId, status: "active" } } },
        { _id: 1, "groups.group": 1, "groups.transferredFrom": 1 },
      ),
    ]);

    // Boshqa guruhdan O'TKAZILGAN o'quvchilarning oldingi davomati — o'z
    // sanasi bilan, faqat o'qish uchun (API_CONTRACT_student_transfer.md §4).
    const carried = await transferredAttendance(sourceWindowsOf(students, groupId), {
      $gte: `${targetMonth}-01`,
      $lte: `${targetMonth}-31`,
    });
    // Yangi guruhda dars kuni BO'LMAGAN manba sanalari — alohida (qulflangan)
    // ustun sifatida qo'shiladi, aks holda o'sha yozuvlar ko'rinmay qolardi.
    const extraDates = new Set();
    for (const map of carried.values()) {
      for (const date of map.keys()) if (!dates.includes(date)) extraDates.add(date);
    }

    // date → (studentId → record)
    const byDate = new Map();
    for (const session of sessions) {
      const map = new Map();
      for (const r of session.records) {
        map.set(String(r.student), { status: r.status, late: !!r.late, reason: r.reason || "" });
      }
      byDate.set(session.date, map);
    }

    const dateSet = new Set(dates);
    const allDates = [...dates, ...extraDates].sort();

    return {
      month: targetMonth,
      today,
      days: allDates.map((date) => {
        if (extraDates.has(date)) {
          return { date, day: JS_DAY_TO_CODE[moment.tz(date, TZ).day()], future: false, holiday: null, transferred: true };
        }
        const holiday = holidayMap.get(date);
        return {
          date,
          day: JS_DAY_TO_CODE[moment.tz(date, TZ).day()],
          // Kelajakdagi dars kuni — belgilab bo'lmaydi, katak bo'sh turadi.
          future: date > today,
          holiday: holiday ? { chargeable: !!holiday.chargeable, note: holiday.note || "" } : null,
        };
      }),
      students: students.map((s) => {
        const id = String(s._id);
        const records = {};
        const counts = { present: 0, absent: 0, excused: 0 };

        for (const [date, map] of byDate) {
          // Dars kuni sifatida ko'rinmaydigan sanalar (masalan keyinchalik
          // dam olish deb belgilangan kun) matritsaga tushmaydi.
          if (!dateSet.has(date)) continue;
          const rec = map.get(id);
          if (!rec) continue;
          records[date] = rec;
          if (counts[rec.status] !== undefined) counts[rec.status] += 1;
        }
        // Oldingi guruh yozuvi — shu guruhda o'sha kunga yozuv bo'lmasa.
        for (const [date, rec] of carried.get(id) || []) {
          if (records[date]) continue;
          records[date] = rec;
          if (counts[rec.status] !== undefined) counts[rec.status] += 1;
        }

        const marked = counts.present + counts.absent + counts.excused;
        return {
          studentId: id,
          records,
          ...counts,
          marked,
          // Belgilanmagan kunlar foizni pasaytirmaydi — maxraj `marked`.
          percent: marked ? Math.round((counts.present / marked) * 100) : 0,
        };
      }),
    };
  },

  // Bitta o'quvchining bitta guruhdagi butun davomat tarixi — Student
  // Detail sahifasida har guruh-yozuvi ostida ko'rsatish uchun (eng yangi
  // sana birinchi).
  getStudentHistory: async (clientId, groupId, studentId) => {
    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const [sessions, student] = await Promise.all([
      Attendance.find({ group: groupId, "records.student": studentId }).sort({ date: -1 }),
      Student.findById(studentId).select("groups.group groups.transferredFrom"),
    ]);

    const own = sessions.map((session) => {
      const record = session.records.find((r) => String(r.student) === String(studentId));
      return {
        date: session.date,
        status: record?.status,
        reason: record?.reason || "",
        late: record?.late || false,
      };
    });

    // Oldingi guruh(lar)dan o'tkazilgan tarix (API_CONTRACT_student_transfer.md §4).
    const carried = student ? await transferredAttendance(sourceWindowsOf([student], groupId)) : new Map();
    const ownDates = new Set(own.map((r) => r.date));
    const extra = [...(carried.get(String(studentId)) || [])]
      .filter(([date]) => !ownDates.has(date))
      .map(([date, rec]) => ({ date, ...rec }));

    return [...own, ...extra].sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  // Ota-ona WebApp QR kartasi (API_CONTRACT_parent_qr_card.md §1.2) uchun
  // umumiy yordamchilar — PNG tekshiruvi va caption to'ldirish bir manbada.
  assertPngCard,
  fillCaption,
  QR_SEND_LOCK_SEC,
};
