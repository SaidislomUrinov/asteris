const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

// Berilgan sertifikatlar reestri — PDF FAYLI saqlanmaydi (chek bilan bir
// xil naqsh, receiptPdf.util.js), u har safar client-side shablon + shu
// hujjatdagi ma'lumotlardan qayta generatsiya qilinadi. `studentName` va
// `subjectName` ATAYLAB SNAPSHOT sifatida saqlanadi — keyinchalik o'quvchi
// ismi yoki fan nomi o'zgarsa ham, allaqachon berilgan sertifikat matni
// o'zgarib qolmasligi kerak (haqiqiylik tekshiruvi ham shu holatga tayanadi).
const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  template: { type: Schema.Types.ObjectId, ref: "CertificateTemplate", required: true },
  student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
  studentName: { type: String, required: true },
  subjectName: { type: String, default: "" },
  groupName: { type: String, default: "" },
  // Tasodifiy, taxmin qilib bo'lmaydigan kod — QR shunga ishora qiladi,
  // ochiq (auth talab qilmaydigan) tekshirish sahifasi ham shu bilan qidiradi.
  code: { type: String, required: true, unique: true },
  issuedBy: {
    id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["client", "staff", "admin"], required: true },
    name: { type: String, default: "" },
  },
  issuedAt: { type: Number, default: getNow },
});

schema.virtual("date").get(function () {
  return formatDate(this.issuedAt);
});

module.exports = model("Certificate", schema);
