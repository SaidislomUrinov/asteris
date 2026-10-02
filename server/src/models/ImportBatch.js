const { Schema, model } = require("mongoose");
const { getNow } = require("../utils/date.util");

// Bitta muvaffaqiyatli import (`student.service.js#importBulk`) — bitta
// ImportBatch. Import YARATGAN hujjat va QO'SHGAN a'zolik shu batch'ga
// belgilanadi (Student.js "importBatch"), bekor qilish esa aynan shu
// belgilarni izlab importdan oldingi holatni tiklaydi
// (API_CONTRACT_import_undo.md §1).
const schema = new Schema({
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true,
    index: true,
  },
  center: {
    type: Schema.Types.ObjectId,
    ref: "Center",
    required: true,
  },
  // Import har doim BITTA guruh ichida ishlaydi (importBulk parametrlari) —
  // shu sabab batch ham bitta guruhga bog'lanadi, "eng oxirgi batch"ni
  // guruh bo'yicha topish (`latestImportBatch`) shu indeksga tayanadi.
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    index: true,
  },
  // Kim import qildi — bekor qilish huquqi shunga (yoki Client Owner
  // bo'lishga) bog'liq. `refPath` emas, aniq `kind` — Student.payments.
  // collectedBy bilan bir xil naqsh (amal bajaruvchi ikki mustaqil
  // modeldan biri bo'lishi mumkin).
  createdBy: {
    id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["client", "staff"], required: true },
  },
  counts: {
    created: { type: Number, default: 0 }, // yangi Student hujjati
    enrolled: { type: Number, default: 0 }, // mavjud hujjatga yangi a'zolik
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ["applied", "undone"],
    default: "applied",
    index: true,
  },
  undoneAt: {
    type: Number,
    default: null,
  },
  undoneBy: {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["client", "staff", null], default: null },
  },
  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
});

schema.pre("save", async function () {
  this.updatedAt = getNow();
});

module.exports = model("ImportBatch", schema);
