const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const { getNow } = require("../utils/date.util");

// TEST (QUIZ) moduli — API_CONTRACT_quiz.md. O'qituvchi guruhga test
// yuboradi, o'quvchilar WebApp orqali belgilangan vaqtda ishlaydi.
// Savollar embedded, har o'quvchining urinishi (`attempts[]`) ham shu
// hujjat ichida — bir martalik, qayta ochish mumkin (yangi urinish yo'q).

const actorSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["client", "staff"], default: null },
  },
  { _id: false },
);

const optionSchema = new Schema({ id: String, text: String }, { _id: false }); // id: "a","b","c","d"

const questionSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    options: {
      type: [optionSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 6,
    },
    correctOptionId: { type: String, required: true },
    // Eski (savol boshiga vaqt) maydon — endi vaqt butun testga umumiy
    // (`totalTimeSec`), bu maydon ishlatilmaydi.
    timeLimitSec: { type: Number, default: null },
  },
  { _id: false },
);

const attemptAnswerSchema = new Schema(
  {
    questionId: Schema.Types.ObjectId,
    optionId: { type: String, default: null }, // null = javobsiz
    correct: Boolean,
    answeredAt: Number,
  },
  { _id: false },
);

const attemptSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    startedAt: { type: Number, default: null },
    finishedAt: { type: Number, default: null },
    answers: { type: [attemptAnswerSchema], default: [] },
    correctCount: { type: Number, default: 0 },
    score: { type: Number, default: null }, // 1-10, auto or manual
    scoreSource: { type: String, enum: ["auto", "manual", null], default: null },
    notifiedAt: { type: Number, default: null }, // result-sent-to-telegram marker
  },
  { _id: false },
);

const schema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
  group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
  title: { type: String, trim: true, maxlength: 200, default: "" },
  questions: {
    type: [questionSchema],
    required: true,
    validate: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 100,
  },
  startAt: { type: Number, required: true }, // epoch ms, Asia/Tashkent HH:mm shu kuni
  totalTimeSec: { type: Number, required: true }, // = sum(questions.timeLimitSec), denormalized
  status: { type: String, enum: ["scheduled", "active", "finished"], default: "scheduled" },
  attempts: { type: [attemptSchema], default: [] },
  createdBy: { type: actorSchema, default: () => ({}) }, // {id, kind:"staff"}
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
  createdAt: { type: Number, default: getNow },
  updatedAt: { type: Number, default: getNow },
});
schema.index({ client: 1, center: 1, group: 1, startAt: -1 });
// Job'da "scheduled"/"active" bosqichlarini tezda topish uchun.
schema.index({ status: 1, startAt: 1 });

schema.pre("save", function () {
  this.updatedAt = getNow();
});

module.exports = model("Quiz", schema);
