const { generateUniqueShortCode } = require("../utils/shortCode.util");
const Certificate = require("../models/Certificate");
const CertificateTemplate = require("../models/CertificateTemplate");
const Student = require("../models/Student");
const Group = require("../models/Group");
const Subject = require("../models/Subject");
const Center = require("../models/Center");
const Client = require("../models/Client");
const { log: auditLog } = require("../utils/audit.util");

const DTO = (c) => ({
  _id: c._id,
  template: c.template,
  student: c.student,
  group: c.group,
  studentName: c.studentName,
  subjectName: c.subjectName,
  groupName: c.groupName,
  code: c.code,
  issuedAt: c.issuedAt,
  date: c.date,
});

// Guruh nomi loyihada HECH QAYERDA saqlanmaydi — har doim
// "{fanNomi} - {activeId}" ko'rinishida hisoblanadi (group.service.js'dagi
// bir xil naqsh).
const groupLabel = (subjectName, group) =>
  `${subjectName || "?"} - ${group.status === "pending" ? group.pendingId : group.activeId}`;

const issueOne = async ({ clientId, centerId, templateId, student, group, subjectName, actor }) => {
  // Qisqa, qo'lda yozib bo'ladigan kod (8 belgi) — QR bilan bir qatorda
  // link ham qo'lda kiritilishi mumkin bo'lishi uchun (uzun hex o'rniga).
  const code = await generateUniqueShortCode((c) => Certificate.exists({ code: c }));
  const doc = await Certificate.create({
    client: clientId,
    center: centerId,
    template: templateId,
    student: student._id,
    group: group?._id || null,
    studentName: student.fullName,
    subjectName: subjectName || "",
    groupName: group ? groupLabel(subjectName, group) : "",
    code,
    issuedBy: { id: actor.id, kind: actor.kind, name: actor.name || "" },
  });
  return doc;
};

module.exports = {
  DTO,

  // Bitta o'quvchiga — o'quvchining shu paytdagi FAOL guruhlaridan biri
  // tanlanadi (`groupId` berilmasa birinchi faol guruh olinadi).
  issueForStudent: async (clientId, studentId, body, actor) => {
    const template = await CertificateTemplate.findOne({
      _id: body?.templateId,
      client: clientId,
      isDeleted: false,
    });
    if (!template) throw new Error("certificateTemplate.notFound");

    const student = await Student.findOne({
      _id: studentId,
      isDeleted: false,
      groups: { $elemMatch: { client: clientId } },
    });
    if (!student) throw new Error("student.notFound");

    let group = null;
    let subjectName = "";
    const activeGroups = (student.groups || []).filter((g) => g.status === "active");
    const targetGroupId = body?.groupId || activeGroups[0]?.group;
    if (targetGroupId) {
      group = await Group.findOne({ _id: targetGroupId, client: clientId, isDeleted: false });
      if (group) {
        const subject = await Subject.findById(group.subject, { name: 1 });
        subjectName = subject?.name || "";
      }
    }

    const doc = await issueOne({
      clientId,
      centerId: template.center,
      templateId: template._id,
      student,
      group,
      subjectName,
      actor,
    });

    await auditLog({
      actor,
      client: clientId,
      center: template.center,
      action: "certificate:issued",
      entity: { type: "Certificate", id: doc._id, label: student.fullName },
    });

    return DTO(doc);
  },

  // Guruhdagi barcha FAOL o'quvchilarga birdaniga.
  issueForGroup: async (clientId, groupId, body, actor) => {
    const template = await CertificateTemplate.findOne({
      _id: body?.templateId,
      client: clientId,
      isDeleted: false,
    });
    if (!template) throw new Error("certificateTemplate.notFound");

    const group = await Group.findOne({ _id: groupId, client: clientId, isDeleted: false });
    if (!group) throw new Error("group.notFound");

    const subject = await Subject.findById(group.subject, { name: 1 });
    const subjectName = subject?.name || "";

    const students = await Student.find({
      isDeleted: false,
      groups: { $elemMatch: { group: group._id, status: "active" } },
    });
    if (!students.length) throw new Error("certificate.noActiveStudents");

    const docs = [];
    for (const student of students) {
      docs.push(
        await issueOne({
          clientId,
          centerId: template.center,
          templateId: template._id,
          student,
          group,
          subjectName,
          actor,
        }),
      );
    }

    await auditLog({
      actor,
      client: clientId,
      center: template.center,
      action: "certificate:issuedBulk",
      entity: { type: "Group", id: group._id, label: `${subjectName} - ${group.activeId}` },
      meta: { count: docs.length },
    });

    return docs.map(DTO);
  },

  listForStudent: async (clientId, studentId) => {
    const rows = await Certificate.find({ client: clientId, student: studentId }).sort({
      issuedAt: -1,
    });
    return rows.map(DTO);
  },

  // Ochiq (auth talab qilmaydigan) tekshirish — ko'rsatish uchun matn BILAN
  // BIRGA `code` va shablon (`backgroundUrl`/`fields`) ham qaytadi, chunki
  // website "PDF yuklash" tugmasi berilgan sertifikatni 1:1 qayta hosil
  // qilishi kerak (certificatePdf.util.js bilan bir xil generatsiya —
  // client/src/pages/Certificates/certificatePdf.util.js). Tenant ICHKI
  // ID'lari (client/center/student/_id) hamon oshkor qilinmaydi — faqat
  // shablonning PDF chizish uchun kerakli ochiq maydonlari.
  verify: async (code) => {
    const cert = await Certificate.findOne({ code });
    if (!cert) throw new Error("certificate.notFound");

    const [center, client, template] = await Promise.all([
      Center.findById(cert.center, { name: 1 }),
      Client.findById(cert.client, { name: 1 }),
      CertificateTemplate.findById(cert.template, { backgroundUrl: 1, fields: 1 }),
    ]);

    return {
      code: cert.code,
      studentName: cert.studentName,
      subjectName: cert.subjectName,
      groupName: cert.groupName,
      date: cert.date,
      centerName: center?.name || "",
      clientName: client?.name || "",
      template: template
        ? { backgroundUrl: template.backgroundUrl, fields: template.fields }
        : null,
    };
  },
};
