const { Schema, model } = require("mongoose");

const schema = new Schema({
  _id: { type: String, required: true }, // masalan: "client"
  seq: { type: Number, default: 0 },
});

schema.statics.next = async function (name) {
  const doc = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
};

module.exports = model("Counter", schema);
