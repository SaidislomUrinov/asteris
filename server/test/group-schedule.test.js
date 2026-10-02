// `PATCH /groups/:id/schedule` — faqat O'SHA guruhni o'zgartiradi. Prod
// incidenti: eski bulk `mode: "full"` saqlash barcha guruh vaqtlarini
// o'chirib yuborgan edi (endi per-group PATCH).
require("./helpers/env");
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("./helpers/db");
const { startServer, clientHeader } = require("./helpers/http");
const { seedClient, seedCenter, seedGroup } = require("./helpers/seed");
const Group = require("../src/models/Group");
const Room = require("../src/models/Room");

let srv;
const ctx = {};

const snapshot = async (id) => {
  const g = await Group.findById(id).lean();
  return { days: [...g.days], startTime: g.startTime, endTime: g.endTime, room: g.room ? String(g.room) : null };
};

const INITIAL = {
  g1: { days: ["mon", "wed", "fri"], startTime: "09:00", endTime: "10:30", room: "r1" },
  g2: { days: ["tue", "thu"], startTime: "14:00", endTime: "15:30", room: "r2" },
  g3: { days: ["sat"], startTime: "11:00", endTime: "12:00", room: "r1", status: "pending" },
  other: { days: ["mon"], startTime: "09:00", endTime: "10:00", room: "ro" },
};

const expected = (key) => {
  const { status, room, ...rest } = INITIAL[key];
  return { ...rest, room: String(ctx[room]._id) };
};

before(async () => {
  await db.connect();
  srv = await startServer();

  ctx.A = await seedClient({ phone: "+998900000011" });
  ctx.B = await seedClient({ phone: "+998900000012" });
  ctx.centerA = await seedCenter(ctx.A.client, "A1");
  ctx.centerB = await seedCenter(ctx.B.client, "B1");
  ctx.r1 = ctx.centerA.room;
  ctx.r2 = await Room.create({ client: ctx.A.client._id, center: ctx.centerA.center._id, name: "A1 xona 2" });
  ctx.ro = ctx.centerB.room;

  const r = await srv.request("POST", "/client-auth/signin", { body: { phone: ctx.A.phone, password: ctx.A.password } });
  ctx.token = r.body.access;
});

// Har testdan oldin guruhlar boshlang'ich jadvaliga qaytariladi.
beforeEach(async () => {
  await Group.deleteMany({});
  for (const key of ["g1", "g2", "g3"]) {
    const { room, ...rest } = INITIAL[key];
    ctx[key] = await seedGroup(ctx.A.client, { ...ctx.centerA, room: ctx[room] }, rest);
  }
  const { room, ...rest } = INITIAL.other;
  ctx.other = await seedGroup(ctx.B.client, { ...ctx.centerB, room: ctx[room] }, rest);
});

after(async () => {
  await srv?.close();
  await db.disconnect();
});

const patch = (id, body) =>
  srv.request("PATCH", `/groups/${id}/schedule`, { headers: clientHeader(ctx.token), body });

const assertUntouched = async (...keys) => {
  for (const key of keys) assert.deepEqual(await snapshot(ctx[key]._id), expected(key), `${key} o'zgarib qoldi`);
};

test("bitta guruh jadvali o'zgaradi, qolganlari (shu client va boshqa client) tegilmaydi", async () => {
  const r = await patch(ctx.g1._id, { days: ["tue", "thu"], startTime: "16:00", endTime: "17:00", roomId: String(ctx.r2._id) });
  assert.equal(r.body.ok, true, r.body.msg);
  assert.deepEqual(await snapshot(ctx.g1._id), {
    days: ["tue", "thu"],
    startTime: "16:00",
    endTime: "17:00",
    room: String(ctx.r2._id),
  });
  await assertUntouched("g2", "g3", "other");
});

test("faqat yuborilgan maydon o'zgaradi (qisman PATCH)", async () => {
  const r = await patch(ctx.g1._id, { startTime: "08:00" });
  assert.equal(r.body.ok, true, r.body.msg);
  assert.deepEqual(await snapshot(ctx.g1._id), { ...expected("g1"), startTime: "08:00" });
  await assertUntouched("g2", "g3", "other");
});

test("roomId: null — faqat shu guruh jadvaldan bo'shatiladi", async () => {
  const r = await patch(ctx.g1._id, { roomId: null });
  assert.equal(r.body.ok, true, r.body.msg);
  assert.equal((await snapshot(ctx.g1._id)).room, null);
  await assertUntouched("g2", "g3", "other");
});

test("eski bulk ko'rinishidagi body (mode: full, groups: []) boshqa guruhlarni o'chirmaydi", async () => {
  const r = await patch(ctx.g1._id, { mode: "full", groups: [], startTime: "07:00", endTime: "08:00" });
  assert.equal(r.body.ok, true, r.body.msg);
  assert.equal((await snapshot(ctx.g1._id)).startTime, "07:00");
  await assertUntouched("g2", "g3", "other");
  assert.equal(await Group.countDocuments({ startTime: "" }), 0);
});

test("xona to'qnashuvi → room.busyAtThisTime, hech qaysi guruh o'zgarmaydi", async () => {
  const r = await patch(ctx.g1._id, { roomId: String(ctx.r2._id), days: ["thu"], startTime: "15:00", endTime: "16:00" });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.msg, "room.busyAtThisTime");
  await assertUntouched("g1", "g2", "g3", "other");
});

test("boshqa filial/client xonasi biriktirilmaydi (room.notFound)", async () => {
  const r = await patch(ctx.g1._id, { roomId: String(ctx.ro._id) });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.msg, "room.notFound");
  await assertUntouched("g1", "g2", "g3", "other");
});

test("GET /groups/schedule — PATCH'dan keyin barcha guruhlar jadvali joyida", async () => {
  await patch(ctx.g2._id, { startTime: "13:00", endTime: "14:00" });
  const r = await srv.request("GET", "/groups/schedule", { headers: clientHeader(ctx.token) });
  assert.equal(r.body.ok, true, r.body.msg);
  const json = JSON.stringify(r.body.data);
  for (const key of ["g1", "g2", "g3"]) assert.ok(json.includes(String(ctx[key]._id)), `${key} yo'q`);
  assert.ok(!json.includes(String(ctx.other._id)), "boshqa client guruhi chiqib qoldi");
  await assertUntouched("g1", "g3", "other");
});
