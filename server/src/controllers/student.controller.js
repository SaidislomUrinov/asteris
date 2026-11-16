const studentService = require("../services/student.service");
const studentMessageService = require("../services/studentMessage.service");
const { buildActor } = require("../utils/audit.util");
const teacherView = require("../utils/teacherView.util");
const { sendExcel, THEME } = require("../utils/excel.util");
const { formatDate } = require("../utils/date.util");

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await studentService.create(req.client._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "student.created" });
    } catch (error) {
      next(error);
    }
  },

  importBulk: async (req, res, next) => {
    try {
      const data = await studentService.importBulk(req.client._id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "student.importDone" });
    } catch (error) {
      next(error);
    }
  },

  latestImportBatch: async (req, res, next) => {
    try {
      const data = await studentService.latestImportBatch(req.client._id, req.query.groupId);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  undoImportBatch: async (req, res, next) => {
    try {
      const data = await studentService.undoImportBatch(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "import.undone" });
    } catch (error) {
      next(error);
    }
  },

  lookupByPhone: async (req, res, next) => {
    try {
      const data = await studentService.lookupByPhone(req.query.phone, req.client._id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const { page, limit, search, center, group, status, debtStatus } = req.query;
      const { data, meta } = await studentService.list(req.client._id, {
        page,
        limit,
        search,
        center,
        group,
        status,
        debtStatus,
      });
      // O'qituvchiga moliyaviy maydonlar umuman yuborilmaydi.
      return res.send({
        ok: true,
        data: teacherView.isTeacher(req) ? teacherView.stripStudents(data) : data,
        meta,
      });
    } catch (error) {
      next(error);
    }
  },

  getOne: async (req, res, next) => {
    try {
      // Staff bo'lsa `req.centerScope` — o'z filiali (tenantAuth qo'yadi),
      // Owner bo'lsa undefined -> barcha filiallar ko'rinadi.
      const data = await studentService.getOne(
        req.client._id,
        req.params.id,
        req.centerScope || "",
      );
      return res.send({
        ok: true,
        data: teacherView.isTeacher(req) ? teacherView.stripStudent(data) : data,
      });
    } catch (error) {
      next(error);
    }
  },

  exportList: async (req, res, next) => {
    try {
      const { search, center, group, status, debtStatus } = req.query;
      const rows = await studentService.exportList(req.client._id, {
        search,
        center,
        group,
        status,
        debtStatus,
      });
      await sendExcel(res, "oquvchilar", [
        {
          sheetName: "O'quvchilar",
          color: THEME.student,
          title: "O'quvchilar ro'yxati",
          subtitle: `Jami: ${rows.length} ta`,
          columns: [
            { header: "F.I.Sh.", width: 26, value: (r) => r.fullName },
            { header: "Telefon raqami", width: 18, value: (r) => r.phone },
            { header: "Faol guruhlar", width: 30, value: (r) => r.groupLabels || "—" },
            { header: "Filial", width: 20, value: (r) => r.centerNames || "—" },
            {
              header: "Qarzdorlik (so'm)",
              width: 18,
              align: "right",
              numFmt: "#,##0",
              value: (r) => r.debt,
            },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  exportOne: async (req, res, next) => {
    try {
      const { student, groupRows, paymentRows } = await studentService.exportOne(
        req.client._id,
        req.params.id,
      );
      await sendExcel(res, `oquvchi_${student.fullName}`, [
        {
          sheetName: "Guruhlar",
          color: THEME.student,
          title: student.fullName,
          subtitle: student.phone,
          columns: [
            { header: "Fan", width: 22, value: (r) => r.subjectName },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Narx (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.price },
            {
              header: "Holat",
              width: 14,
              value: (r) => (r.status === "active" ? "O'qimoqda" : "Chiqarilgan"),
            },
            { header: "To'langan (joriy)", width: 18, align: "right", numFmt: "#,##0", value: (r) => r.paid },
            { header: "Jami (joriy)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.due },
            { header: "Qarzdorlik", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.debt },
          ],
          rows: groupRows,
        },
        {
          sheetName: "To'lovlar tarixi",
          color: THEME.student,
          title: `${student.fullName} — to'lovlar tarixi`,
          columns: [
            { header: "Fan", width: 22, value: (r) => r.subjectName },
            { header: "Summa (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.amount },
            {
              header: "Turi",
              width: 14,
              value: (r) =>
                ({ cash: "Naqd", card: "Karta", mixed: "Aralash", previousMonth: "Avvalgi oydan" }[
                  r.type
                ] || r.type),
            },
            {
              header: "Holat",
              width: 14,
              value: (r) =>
                ({ paid: "To'langan", cancelled: "Bekor qilingan", refunded: "Qaytarilgan" }[r.status] ||
                  r.status),
            },
            { header: "Qaysi oy uchun", width: 16, value: (r) => r.forMonth || "—" },
            { header: "Sana", width: 18, value: (r) => r.date },
          ],
          rows: paymentRows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const data = await studentService.update(req.client._id, req.params.id, req.body, buildActor(req));
      return res.send({ ok: true, data, msg: "student.updated" });
    } catch (error) {
      next(error);
    }
  },

  // PUT /students/:id/photo — multipart `photo` (API_CONTRACT_student_photo.md §3).
  // Doira `requireStudentPhoto` da tekshirilgan.
  setPhoto: async (req, res, next) => {
    try {
      const data = await studentService.setPhoto(req.client._id, req.params.id, req.files?.photo, buildActor(req));
      return res.send({ ok: true, data, msg: "student.photoUpdated" });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /students/:id/photo
  removePhoto: async (req, res, next) => {
    try {
      const data = await studentService.removePhoto(req.client._id, req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "student.photoRemoved" });
    } catch (error) {
      next(error);
    }
  },

  // PATCH /students/:id/contact — ism/raqam/ota-ona raqami
  // (API_CONTRACT_student_contact_telegram.md §2). Ruxsat va guruh doirasi
  // `requireStudentContact` da tekshirilgan.
  updateContact: async (req, res, next) => {
    try {
      const data = await studentService.updateContact(req.client._id, req.params.id, req.body, buildActor(req));
      return res.send({
        ok: true,
        data: teacherView.isTeacher(req) ? teacherView.stripStudent(data) : data,
        msg: "student.updated",
      });
    } catch (error) {
      next(error);
    }
  },

  // POST /students/:id/message/telegram — body { templateId?, text? }
  // (API_CONTRACT_profile_test_and_student_notify.md §2). Doira
  // `requireStudentContact` da (student.routes.js, `student:contact`).
  sendTelegramMessage: async (req, res, next) => {
    try {
      const data = await studentMessageService.sendStudentMessage(
        req.client._id,
        req.centerScope || null,
        req.params.id,
        { channel: "telegram", templateId: req.body?.templateId, text: req.body?.text },
      );
      return res.send({ ok: true, data, msg: "student.message.sent" });
    } catch (error) {
      next(error);
    }
  },

  // POST /students/:id/message/sms — body { templateId?, text? }
  sendSmsMessage: async (req, res, next) => {
    try {
      const data = await studentMessageService.sendStudentMessage(
        req.client._id,
        req.centerScope || null,
        req.params.id,
        { channel: "sms", templateId: req.body?.templateId, text: req.body?.text },
      );
      return res.send({ ok: true, data, msg: "student.message.sent" });
    } catch (error) {
      next(error);
    }
  },

  updateGroupPrice: async (req, res, next) => {
    try {
      const data = await studentService.updateGroupPrice(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body.price,
        buildActor(req),
        // Ixtiyoriy — o'tgan bitta sikl (API_CONTRACT_past_cycle_price.md).
        req.body.cycleStart ?? null,
      );
      return res.send({ ok: true, data, msg: "student.updated" });
    } catch (error) {
      next(error);
    }
  },

  // Ko'chirishdan oldingi qarz(lar) + avans — to'liq almashtirish
  // (API_CONTRACT_opening_debts.md §3.2). Validatsiya servisda.
  updateOpening: async (req, res, next) => {
    try {
      const data = await studentService.updateOpening(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body || {},
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.openingDebtsSaved" });
    } catch (error) {
      next(error);
    }
  },

  // "O'qishni boshlagan sana"ni tahrirlash
  // (API_CONTRACT_group_month_filter_and_start_date.md §B.3). Validatsiya servisda.
  updateStartDate: async (req, res, next) => {
    try {
      const data = await studentService.updateStartDate(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body || {},
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.updated" });
    } catch (error) {
      next(error);
    }
  },

  // "Alohida foiz" (API_CONTRACT_entry_teacher_percent.md §2). Validatsiya servisda.
  updateTeacherPercent: async (req, res, next) => {
    try {
      const data = await studentService.updateTeacherPercent(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body || {},
        buildActor(req),
      );
      return res.send({
        ok: true,
        data,
        msg: data.teacherPercent === null ? "entryPercent.removed" : "entryPercent.updated",
      });
    } catch (error) {
      next(error);
    }
  },

  archiveGroupEntry: async (req, res, next) => {
    try {
      const data = await studentService.archiveGroupEntry(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "archive.archived" });
    } catch (error) {
      next(error);
    }
  },

  leaveGroup: async (req, res, next) => {
    try {
      const data = await studentService.leaveGroup(req.client._id, req.params.id, req.params.groupEntryId, buildActor(req));
      return res.send({ ok: true, data, msg: "student.left" });
    } catch (error) {
      next(error);
    }
  },

  transferGroup: async (req, res, next) => {
    try {
      const data = await studentService.transferGroup(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.transferred" });
    } catch (error) {
      next(error);
    }
  },

  // "Tushumlar" — Owner uchun, har to'lovni kim qabul qilgani bilan.
  listRevenue: async (req, res, next) => {
    try {
      const { page, from, to, center, type, collectedBy, search, status } = req.query;
      const data = await studentService.listRevenue(req.client._id, {
        page,
        from,
        to,
        center,
        type,
        collectedBy,
        search,
        status,
      });
      return res.send({ ok: true, ...data });
    } catch (error) {
      next(error);
    }
  },

  exportRevenue: async (req, res, next) => {
    try {
      const { from, to, center, type, collectedBy, search, status } = req.query;
      const rows = await studentService.exportRevenue(req.client._id, {
        from,
        to,
        center,
        type,
        collectedBy,
        search,
        status,
      });
      const TYPE_LABELS = { cash: "Naqd", card: "Karta", mixed: "Aralash", previousMonth: "O'tgan oy" };
      const STATUS_LABELS = { paid: "To'langan", cancelled: "Bekor qilingan", refunded: "Qaytarilgan" };
      await sendExcel(res, "tushumlar", [
        {
          sheetName: "Tushumlar",
          color: THEME.student,
          title: "Tushumlar",
          subtitle: `Jami: ${rows.length} ta tranzaksiya`,
          columns: [
            { header: "O'quvchi", width: 24, value: (r) => r.studentName },
            { header: "Telefon", width: 18, value: (r) => r.phone },
            { header: "Filial", width: 20, value: (r) => r.centerName },
            { header: "Summa (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.amount },
            { header: "Turi", width: 14, value: (r) => TYPE_LABELS[r.type] || r.type },
            { header: "Qaysi oy uchun", width: 16, value: (r) => r.forMonth || "—" },
            { header: "Kim qabul qildi", width: 24, value: (r) => r.collectedBy?.name || "Noma'lum" },
            { header: "Sana", width: 20, value: (r) => formatDate(r.date) },
            { header: "Holat", width: 16, value: (r) => STATUS_LABELS[r.status] || r.status },
          ],
          rows,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  addPayment: async (req, res, next) => {
    try {
      // To'lovni kim qabul qilgani: hodim bo'lsa Staff, aks holda Client Owner.
      const collector = req.staff
        ? { id: req.staff._id, kind: "staff" }
        : { id: req.client._id, kind: "owner" };
      const data = await studentService.addPayment(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.body,
        collector,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.paymentAdded" });
    } catch (error) {
      next(error);
    }
  },

  // To'lovning "qaysi oy uchun" belgisini o'zgartirish
  // (API_CONTRACT_payment_move_month.md). Validatsiya servisda.
  movePaymentMonth: async (req, res, next) => {
    try {
      const data = await studentService.movePaymentMonth(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.params.paymentId,
        req.body || {},
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.paymentMonthMoved" });
    } catch (error) {
      next(error);
    }
  },

  cancelPayment: async (req, res, next) => {
    try {
      const data = await studentService.cancelPayment(
        req.client._id,
        req.params.id,
        req.params.groupEntryId,
        req.params.paymentId,
        buildActor(req),
      );
      return res.send({ ok: true, data, msg: "student.paymentCancelled" });
    } catch (error) {
      next(error);
    }
  },
};
