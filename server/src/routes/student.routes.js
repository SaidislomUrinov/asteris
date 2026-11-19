const { Router } = require("express");
const studentController = require("../controllers/student.controller");
const {
  tenantAuth,
  requireTenantPermission,
  requireTariffFeature,
  requireActiveSubscription,
  requireOwner,
  blockTeachingRoles,
  requireStudentScope,
  requireTeacherGroup,
} = require("../middlewares/authenticator.middleware");

const Group = require("../models/Group");
const Student = require("../models/Student");
const { isValidObjectId } = require("mongoose");

// Guruhga biriktirilish orqali cheklanadigan rollar → Group'dagi maydon
// nomi (authenticator.middleware.js dagi GROUP_SCOPE_FIELD bilan bir xil).
// Avval bu yerda faqat "teacher" tekshirilardi — yordamchi o'qituvchi
// cheklovlardan butunlay chetda qolardi.
const GROUP_SCOPE_FIELD = { teacher: "teacher", assistant: "assistant" };

// O'qituvchi/yordamchi BARCHA o'quvchilar ro'yxatini ola olmaydi — faqat O'Z
// guruhi bo'yicha (`?group=<id>`). Filial izolyatsiyasi yetarli emas: bitta
// filialda bir nechta o'qituvchi bor.
const teacherStudentScope = async (req, res, next) => {
  const field = GROUP_SCOPE_FIELD[req.staff?.role];
  if (!field) return next();
  try {
    const groupId = req.query.group;
    if (!groupId) throw new Error("auth.forbidden");
    const group = await Group.findOne({
      _id: groupId,
      client: req.client._id,
      [field]: req.staff._id,
      isDeleted: false,
    }).select("_id");
    if (!group) throw new Error("auth.forbidden");
    next();
  } catch (error) {
    next(error);
  }
};

// Hodim uchun "shu o'quvchi menga tegishlimi" tekshiruvi — kontakt va rasm
// marshrutlari uchun umumiy (nusxa ko'chirilmaydi).
//  - Owner — o'tadi (xizmat o'zi `client` bo'yicha tekshiradi).
//  - `permissions` berilsa: Teacher/Assistant — `teaching` ro'yxatidan biri,
//    boshqa hodim — `other` ro'yxatidan biri. Berilmasa — permission TALAB
//    QILINMAYDI (rasm, API_CONTRACT_student_photo.md §3).
//  - Filial izolyatsiyasi: a'zolik `req.centerScope` filialida bo'lishi shart.
//  - Teacher/Assistant — o'quvchining shu client'dagi AKTIV a'zoligi o'zi
//    biriktirilgan (o'chirilmagan) guruhda bo'lishi shart.
const studentScopeGuard = ({ permissions = null } = {}) => async (req, res, next) => {
  if (!req.staff) return next(); // Client Owner
  try {
    const field = GROUP_SCOPE_FIELD[req.staff.role];
    if (permissions) {
      const own = req.staff.permissions || [];
      const allowed = field ? permissions.teaching : permissions.other;
      if (!allowed.some((p) => own.includes(p))) throw new Error("auth.forbidden");
    }

    const id = req.params.id;
    if (!isValidObjectId(id)) throw new Error("student.notFound");

    const student = await Student.findOne({ _id: id, isDeleted: false })
      .select("groups.client groups.center groups.group groups.status")
      .lean();
    if (!student) throw new Error("student.notFound");

    const scope = req.centerScope ? String(req.centerScope) : "";
    const entries = (student.groups || []).filter(
      (g) =>
        String(g.client) === String(req.client._id) &&
        g.status !== "archived" &&
        (!scope || String(g.center) === scope),
    );
    // O'qituvchi rollari uchun "begona o'quvchi" — 403, boshqalarga 404.
    if (!entries.length) throw new Error(field ? "auth.forbidden" : "student.notFound");

    if (field) {
      const groupIds = entries.filter((g) => g.status === "active").map((g) => g.group);
      const own = groupIds.length
        ? await Group.exists({
            _id: { $in: groupIds },
            client: req.client._id,
            [field]: req.staff._id,
            isDeleted: false,
          })
        : null;
      if (!own) throw new Error("auth.forbidden");
    }
    next();
  } catch (error) {
    next(error);
  }
};

// PATCH /:id/contact (API_CONTRACT_student_contact_telegram.md §2).
//  - Teacher/Assistant — `all` yoki `student:contact`.
//  - Boshqa hodim — `all` | `student:update` | `student:contact`
//    (`student:update` ⊇ `student:contact`).
const requireStudentContact = studentScopeGuard({
  permissions: {
    teaching: ["all", "student:contact"],
    other: ["all", "student:update", "student:contact"],
  },
});

// POST /:id/message/sms — bulk `/sms/send` bilan bir xil ruxsat qatoriga
// `sms:send` ham qo'shiladi, shunda faqat SMS huquqi berilgan Reception ham
// (student:contact'siz) bitta o'quvchiga SMS yubora oladi.
const requireStudentSms = studentScopeGuard({
  permissions: {
    teaching: ["all", "student:contact", "sms:send"],
    other: ["all", "student:update", "student:contact", "sms:send"],
  },
});

// PUT/DELETE /:id/photo (API_CONTRACT_student_photo.md §3) — har qanday hodim
// roli, alohida permission kerak emas; doira tekshiruvi kontakt bilan bir xil.
const requireStudentPhoto = studentScopeGuard();

// `blockTeachingRoles` — authenticator.middleware.js dan (avval shu faylda
// nusxasi bor edi; endi guruh marshrutlari ham o'shanga tayangani uchun
// yagona joyga ko'chirildi). O'quvchining BATAFSIL kartochkasi o'qituvchi
// rollariga umuman ochilmaydi (docs/teacher-scope-updates.md §3) — u yerda
// to'lov tarixi va qarzdorlik bor. Guruh sahifasidagi ro'yxat va davomat
// ularga yetarli.

const router = Router();

router.use(tenantAuth);
router.use(requireActiveSubscription);

// A'zolik (`:groupEntryId`) ustidagi barcha amallar (to'lov, oy o'tkazish,
// narx, chiqarish, ko'chirish, arxiv...) — hodim uchun a'zolik O'Z FILIALIDA
// bo'lishi shart. Xizmatlar faqat `client` bo'yicha tekshiradi, shuning uchun
// avval resepshin boshqa filial o'quvchisiga to'lov yoza olardi (QA 2026-10-02).
const requireEntryCenter = async (req, res, next) => {
  if (!req.staff) return next();
  try {
    const { id, groupEntryId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(groupEntryId)) return next();
    const student = await Student.findOne(
      { _id: id, "groups._id": groupEntryId },
      { "groups.$": 1 },
    ).lean();
    const entry = student?.groups?.[0];
    if (!entry) return next(); // xizmatning o'z "notFound" xatosi
    if (String(entry.client) !== String(req.client._id) || String(entry.center) !== String(req.staff.center)) {
      throw new Error("auth.forbidden");
    }
    next();
  } catch (error) {
    next(error);
  }
};
router.use("/:id/groups/:groupEntryId", requireEntryCenter);

// `?groupId=` — boshqa filial guruhi bo'yicha import tarixini ochmaslik uchun.
const requireQueryGroup = (req, res, next) => {
  req.params.groupId = req.query.groupId;
  return requireTeacherGroup("groupId")(req, res, next);
};

router.post("/", requireTenantPermission("student:create"), studentController.create);
// Excel'dan (yoki paste) guruhga ko'plab o'quvchi import qilish — bir xil
// `student:create` ruxsati, POST "/" bilan bir xil himoya darajasi
// (API_CONTRACT_student_import.md §3).
router.post("/import", requireTenantPermission("student:create"), studentController.importBulk);
// Importni bekor qilish (API_CONTRACT_import_undo.md §1) — `/:id` bilan
// TO'QNASHMASLIGI uchun `/import/batches/...` aniq yo'llardan OLDIN
// e'lon qilinadi (Express birinchi mos kelgan marshrutni tanlaydi).
router.get(
  "/import/batches/latest",
  requireTenantPermission("student:create"),
  requireQueryGroup,
  studentController.latestImportBatch,
);
router.post(
  "/import/batches/:id/undo",
  requireTenantPermission("student:create"),
  studentController.undoImportBatch,
);
router.get(
  "/",
  requireTenantPermission("student:view"),
  teacherStudentScope,
  studentController.list,
);
// Telefon bo'yicha qidiruv faqat o'quvchi QO'SHISH oqimi uchun — `student:create`
// (avval `student:view` yetarli edi va o'qituvchi ham platforma bo'ylab
// raqam bo'yicha qidira olardi).
router.get("/lookup", requireTenantPermission("student:create"), studentController.lookupByPhone);
router.get(
  "/export",
  blockTeachingRoles,
  requireTenantPermission("student:view"),
  requireTariffFeature("excel.export"),
  studentController.exportList,
);
// "Tushumlar" — faqat Client Owner ko'radi (har tranzaksiyani kim
// olganini ko'rsatadi). `/:id` dan OLDIN e'lon qilinadi.
router.get("/revenue", requireOwner, studentController.listRevenue);
router.get(
  "/revenue/export",
  requireOwner,
  requireTariffFeature("excel.export"),
  studentController.exportRevenue,
);
router.get(
  "/:id/export",
  blockTeachingRoles,
  requireTenantPermission("student:view"),
  requireStudentScope("id"),
  requireTariffFeature("excel.export"),
  studentController.exportOne,
);
router.get(
  "/:id",
  requireTenantPermission("student:view"),
  blockTeachingRoles,
  studentController.getOne,
);
router.patch(
  "/:id",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  requireStudentScope("id"),
  studentController.update,
);
router.patch("/:id/contact", requireStudentContact, studentController.updateContact);
// Profildan Telegram/SMS xabar (API_CONTRACT_profile_test_and_student_notify.md §2)
// — kontakt bilan bir xil doira/ruxsat (`student:contact`), yangi permission
// qo'shilmagan.
router.get("/:id/message/recipients", requireStudentContact, studentController.getMessageRecipients);
router.post("/:id/message/preview", requireStudentSms, studentController.previewMessage);
router.post("/:id/message/telegram", requireStudentContact, studentController.sendTelegramMessage);
router.post(
  "/:id/message/sms",
  requireStudentSms,
  requireActiveSubscription,
  requireTariffFeature("sms.notification"),
  studentController.sendSmsMessage,
);
// O'quvchi rasmi — `photo` maydoni, multipart (API_CONTRACT_student_photo.md §3).
// `/:id/photo` bilan to'qnashadigan boshqa PUT/DELETE marshrut yo'q.
router.put("/:id/photo", requireStudentPhoto, studentController.setPhoto);
router.delete("/:id/photo", requireStudentPhoto, studentController.removePhoto);
router.patch(
  "/:id/groups/:groupEntryId",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  studentController.updateGroupPrice,
);
// Ko'chirishdan oldingi qarz(lar) va avans — to'liq almashtirish
// (API_CONTRACT_opening_debts.md §3.2). Moliyaviy ma'lumot bo'lgani uchun
// o'qituvchi rollariga yopiq.
router.put(
  "/:id/groups/:groupEntryId/opening",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  studentController.updateOpening,
);
// "O'qishni boshlagan sana" — a'zolik `joinedAt`i va qo'shilish kreditlari
// (API_CONTRACT_group_month_filter_and_start_date.md §B.3). Billingga ta'sir
// qiladi — boshqa `.../groups/:groupEntryId/...` PATCH'lari bilan bir xil himoya.
router.patch(
  "/:id/groups/:groupEntryId/start-date",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  studentController.updateStartDate,
);
// "Alohida foiz" — a'zolik to'lovlarining o'qituvchiga alohida ulushi
// (API_CONTRACT_entry_teacher_percent.md §2). Moliyaviy — o'qituvchi rollariga yopiq.
router.patch(
  "/:id/groups/:groupEntryId/teacher-percent",
  blockTeachingRoles,
  requireTenantPermission("group:update"),
  studentController.updateTeacherPercent,
);
// Guruhdan guruhga o'tkazish — bitta atomar amal
// (API_CONTRACT_student_transfer.md §3). `leave` bilan bir xil himoya +
// tarif flagi.
router.post(
  "/:id/groups/:groupEntryId/transfer",
  blockTeachingRoles,
  requireTenantPermission("student:update"),
  requireTariffFeature("student.transfer"),
  studentController.transferGroup,
);
// A'zolikni arxivlash — "o'chirish" o'rniga (API_CONTRACT_archive.md).
// O'quvchi HUJJATI o'chmaydi: faqat SHU guruhdagi a'zoligi arxivga o'tadi.
router.patch(
  "/:id/groups/:groupEntryId/archive",
  blockTeachingRoles,
  requireTenantPermission("student:delete"),
  studentController.archiveGroupEntry,
);
router.post(
  "/:id/groups/:groupEntryId/payments",
  blockTeachingRoles,
  requireTenantPermission("payment:create"),
  studentController.addPayment,
);
router.patch(
  "/:id/groups/:groupEntryId/payments/:paymentId/month",
  blockTeachingRoles,
  requireTenantPermission("payment:create"),
  studentController.movePaymentMonth,
);
router.patch(
  "/:id/groups/:groupEntryId/payments/:paymentId/cancel",
  blockTeachingRoles,
  requireTenantPermission("payment:refund"),
  requireTariffFeature("finance.refund"),
  studentController.cancelPayment,
);

module.exports = router;
