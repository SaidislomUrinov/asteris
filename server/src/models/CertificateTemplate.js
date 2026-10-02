const { Schema, model } = require("mongoose");
const { getNow, formatDate } = require("../utils/date.util");

// Har bir maydon fonga nisbatan FOIZDA joylashtiriladi (`xPct`/`yPct`,
// 0-100) — constructor preview'da fon istalgan o'lchamda ko'rsatilishi
// mumkin, PDF generatsiyada esa asl fon o'lchami ishlatiladi; foiz
// koordinata ikkalasida ham bir xil natija beradi (piksel bo'lganda
// preview kengligi/asl rasm kengligi mos kelmasa siljib qolardi).
const fieldSchema = new Schema(
  {
    key: {
      type: String,
      enum: ["studentName", "subjectName", "groupName", "date", "qr", "text"],
      required: true,
    },
    xPct: { type: Number, required: true, min: 0, max: 100 },
    yPct: { type: Number, required: true, min: 0, max: 100 },
    // "qr" uchun bu maydon QR kod tomonini (kvadrat, px) bildiradi.
    fontSize: { type: Number, default: 24 },
    color: { type: String, default: "#0f172a" },
    align: { type: String, enum: ["left", "center", "right"], default: "center" },
    // "text" uchun — admin qo'lda yozadigan qat'iy matn (masalan
    // "Diplom" yoki tabrik matni). Boshqa kalitlarda ishlatilmaydi.
    content: { type: String, default: "" },
    // `Font.family` qiymati (masalan "font-6a..."). Bo'sh bo'lsa PDF'da
    // standart shrift (helvetica) ishlatiladi. "qr"da e'tiborga olinmaydi.
    fontFamily: { type: String, default: "" },
  },
  { _id: false },
);

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  name: { type: String, required: true, trim: true },
  backgroundUrl: { type: String, required: true },
  fields: { type: [fieldSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});

schema.pre("save", function () {
  this.updatedAt = getNow();
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

module.exports = model("CertificateTemplate", schema);
