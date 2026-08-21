const Attendance = require("../models/Attendance");
const AttendanceSetting = require("../models/AttendanceSetting");
const Group = require("../models/Group");
const Center = require("../models/Center");
const Student = require("../models/Student");
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
const groupHolidayService = require("./groupHoliday.service");
const emit = require("../utils/emitter.util");
const redisUtil = require("../utils/redis.util");
const keyConfig = require("../configs/key.config");

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
];

const settingDTO = (s) => ({
  excusedRollsOverStudentFee: s.excusedRollsOverStudentFee,
  unexcusedRollsOverStudentFee: s.unexcusedRollsOverStudentFee,
  excusedTeacherSalaryWithheld: s.excusedTeacherSalaryWithheld,
  unexcusedTeacherSalaryWithheld: s.unexcusedTeacherSalaryWithheld,
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
    setting = await AttendanceSetting.create({ client: center?.client, center: centerId });
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

  // Summasi yo'q — faqat "shu kun uchun pul olinmaydi" belgisi. Haqiqiy
  // qiymati computeBilling'da jonli, JORIY narx/dars-kunlari asosida
  // hisoblanadi (student.service.js).
  if (eligible) entry.credits.push({ date });

  await student.save();
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
  let session = await Attendance.findOne({ group: group._id, date });
  if (!session) {
    session = new Attendance({ client: clientId, center: group.center, group: group._id, date, records: [] });
  }

  const existing = session.records.find((r) => String(r.student) === String(student._id));
  // Oldingi holat — mijoz statistikani QAYTA YUKLAMASDAN, faqat farqni
  // qo'llab yangilashi uchun kerak (donut: eski statusdan ayirib, yangisiga
  // qo'shadi). Yozuv birinchi marta qo'yilayotgan bo'lsa `null`.
  const previousStatus = existing?.status || null;
  if (existing) {
    existing.status = status;
    existing.reason = reason;
    existing.late = late;
    existing.source = source;
  } else {
    session.records.push({ student: student._id, status, reason, late, source });
  }
  await session.save();

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

    const student = await Student.findOne({ _id: studentId, isDeleted: false });
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
    const student = await Student.findOne({ _id: studentId, isDeleted: false });
    if (!student) throw new Error("student.notFound");

    // Tenant isolation — faqat shu client'ning o'quvchisi. Hodim bo'lsa
    // qo'shimcha ravishda faqat O'Z FILIALI o'quvchisi.
    const belongs = student.groups.some(
      (g) =>
        String(g.client) === String(clientId) &&
        (!staffCenterId || String(g.center) === String(staffCenterId)),
    );
    if (!belongs) throw new Error("student.notFound");

    if (!student.qrToken || reset) {
      student.qrToken = crypto.randomBytes(16).toString("hex");
      await student.save();
    }

    return { studentId: String(student._id), fullName: student.fullName, qrToken: student.qrToken };
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
  scanQr: async (clientId, { token, groupId }, staffCenterId = null) => {
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
    }).populate({ path: "subject", select: "name" });

    // Aniq guruh berilgan — o'quvchi aynan shu guruhda bo'lishi shart
    // ("noto'g'ri guruh — rad etish").
    let target;
    if (groupId) {
      target = groups.find((g) => String(g._id) === String(groupId));
      if (!target) throw new Error("attendance.studentNotInGroup");
    } else {
      const todayGroups = groups.filter((g) => g.status === "active" && g.days?.includes(dayCode));
      if (!todayGroups.length) throw new Error("attendance.notLessonDay");

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
          student: { _id: String(student._id), fullName: student.fullName, photo: student.photo },
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
    // frontend ogohlantirish toast'ini ko'rsatadi.
    const date = todayString();
    const session = await Attendance.findOne({ group: target._id, date });
    const already = session?.records.find((r) => String(r.student) === String(student._id));
    if (already) {
      return {
        duplicate: true,
        student: { _id: String(student._id), fullName: student.fullName, photo: student.photo },
        groupId: String(target._id),
        status: already.status,
        late: already.late || false,
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
      student: { _id: String(student._id), fullName: student.fullName, photo: student.photo },
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

    const [activeStudentsCount, holidayDates] = await Promise.all([
      Student.countDocuments({ groups: { $elemMatch: { group: groupId, status: "active" } } }),
      groupHolidayService.getNonChargeableDates(groupId),
    ]);
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

    const holidays = await groupHolidayService.listForMonth(clientId, groupId, targetMonth);
    const holidayMap = new Map(holidays.map((h) => [h.date, h]));

    const [sessions, students] = await Promise.all([
      Attendance.find({
        group: groupId,
        date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` },
      }).select("date records"),
      Student.find(
        { isDeleted: false, groups: { $elemMatch: { group: groupId, status: "active" } } },
        { _id: 1 },
      ),
    ]);

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

    return {
      month: targetMonth,
      today,
      days: dates.map((date) => {
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

    const sessions = await Attendance.find({ group: groupId, "records.student": studentId }).sort({
      date: -1,
    });

    return sessions.map((session) => {
      const record = session.records.find((r) => String(r.student) === String(studentId));
      return {
        date: session.date,
        status: record?.status,
        reason: record?.reason || "",
        late: record?.late || false,
      };
    });
  },
};
