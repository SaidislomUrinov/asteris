// Tenant izolyatsiyasi — HTTP darajasida, haqiqiy router + auth middleware
// zanjiri bilan (MongoDB `wenet_test`, Redis DB 14 / `wenet_test:` prefiksi).
const { TEST_MONGO_URI } = require("./helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("./helpers/db");
const { startServer, clientHeader, staffHeader } = require("./helpers/http");
const { seedClient, seedCenter, seedGroup, seedStudent, seedStaff } = require("./helpers/seed");
const Student = require("../src/models/Student");
const Group = require("../src/models/Group");

let srv;
const ctx = {};

const ids = (list) => list.map((x) => String(x._id)).sort();

before(async () => {
  assert.match(TEST_MONGO_URI, /\/wenet_test$/);
  await db.connect();
  srv = await startServer();

  // Client A: ikki filial (A1, A2). Client B: bitta filial.
  ctx.A = await seedClient({ phone: "+998900000001" });
  ctx.B = await seedClient({ phone: "+998900000002" });
  ctx.A1 = await seedCenter(ctx.A.client, "A1");
  ctx.A2 = await seedCenter(ctx.A.client, "A2");
  ctx.B1 = await seedCenter(ctx.B.client, "B1");

  ctx.gA1 = await seedGroup(ctx.A.client, ctx.A1);
  ctx.gA2 = await seedGroup(ctx.A.client, ctx.A2);
  ctx.gB1 = await seedGroup(ctx.B.client, ctx.B1);

  ctx.sA1 = await seedStudent(ctx.A.client, ctx.gA1, "Ali A1");
  ctx.sA2 = await seedStudent(ctx.A.client, ctx.gA2, "Vali A2");
  ctx.sB1 = await seedStudent(ctx.B.client, ctx.gB1, "Sardor B1");

  // A1 filialining to'liq huquqli (permissions: ["all"]) resepshini.
  ctx.staffA1 = await seedStaff(ctx.A.client, ctx.A1.center, { login: "reception_a1" });

  const signIn = async (path, body) => {
    const r = await srv.request("POST", path, { body });
    assert.equal(r.body.ok, true, `signin failed: ${r.body.msg}`);
    return r.body.access;
  };
  ctx.tokenA = await signIn("/client-auth/signin", { phone: ctx.A.phone, password: ctx.A.password });
  ctx.tokenB = await signIn("/client-auth/signin", { phone: ctx.B.phone, password: ctx.B.password });
  ctx.tokenStaff = await signIn("/staff-auth/signin", {
    login: ctx.staffA1.login,
    password: ctx.staffA1.password,
  });
});

after(async () => {
  await srv?.close();
  await db.disconnect();
});

describe("Client A ↔ Client B", () => {
  test("o'z ma'lumoti ko'rinadi (asos tekshiruvi)", async () => {
    const r = await srv.request("GET", `/students/${ctx.sA1._id}`, { headers: clientHeader(ctx.tokenA) });
    assert.equal(r.body.ok, true);
    assert.equal(r.body.data.fullName, "Ali A1");
  });

  test("A tokeni bilan B o'quvchisi → student.notFound", async () => {
    const r = await srv.request("GET", `/students/${ctx.sB1._id}`, { headers: clientHeader(ctx.tokenA) });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "student.notFound");
  });

  test("A ro'yxatlarida B ning o'quvchi/guruhi yo'q (hatto ?center=B1 bilan ham)", async () => {
    const students = await srv.request("GET", "/students", { headers: clientHeader(ctx.tokenA) });
    assert.equal(students.body.ok, true);
    assert.deepEqual(ids(students.body.data), ids([ctx.sA1, ctx.sA2]));

    const groups = await srv.request("GET", "/groups", { headers: clientHeader(ctx.tokenA) });
    assert.equal(groups.body.ok, true);
    assert.deepEqual(ids(groups.body.data), ids([ctx.gA1, ctx.gA2]));

    const foreign = await srv.request("GET", `/students?center=${ctx.B1.center._id}`, {
      headers: clientHeader(ctx.tokenA),
    });
    assert.deepEqual(foreign.body.data, []);
    const foreignGroups = await srv.request("GET", `/groups?center=${ctx.B1.center._id}`, {
      headers: clientHeader(ctx.tokenA),
    });
    assert.deepEqual(foreignGroups.body.data, []);
  });

  test("A tokeni bilan B guruhi → group.notFound", async () => {
    const r = await srv.request("GET", `/groups/${ctx.gB1._id}`, { headers: clientHeader(ctx.tokenA) });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "group.notFound");
  });

  test("A tokeni bilan B o'quvchisiga to'lov qo'shib bo'lmaydi, DB o'zgarmaydi", async () => {
    const entryId = ctx.sB1.groups[0]._id;
    const r = await srv.request("POST", `/students/${ctx.sB1._id}/groups/${entryId}/payments`, {
      headers: clientHeader(ctx.tokenA),
      body: { amount: 100000, type: "cash" },
    });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "student.groupEntryNotFound");
    const fresh = await Student.findById(ctx.sB1._id);
    assert.equal(fresh.groups[0].payments.length, 0);
  });

  test("A tokeni bilan B guruhi jadvalini o'zgartirib bo'lmaydi", async () => {
    const r = await srv.request("PATCH", `/groups/${ctx.gB1._id}/schedule`, {
      headers: clientHeader(ctx.tokenA),
      body: { days: ["tue"], startTime: "15:00", endTime: "16:00" },
    });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "group.notFound");
    const fresh = await Group.findById(ctx.gB1._id);
    assert.deepEqual([...fresh.days], ["mon", "wed", "fri"]);
    assert.equal(fresh.startTime, "09:00");
  });
});

describe("Auth zanjirlari mustaqil", () => {
  test("tokensiz → auth.failed", async () => {
    const r = await srv.request("GET", "/students");
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "auth.failed");
  });

  // Boshqa secret bilan imzolangan token jwt.verify'da yiqiladi. Middleware
  // bu xatoni "auth.failed" ga o'ramaydi — javobda jsonwebtoken'ning xom
  // "invalid signature" matni chiqadi (rad etish baribir ishlaydi).
  const REJECTED = ["auth.failed", "invalid signature"];

  test("Staff tokeni Client header'ida → rad etiladi", async () => {
    const r = await srv.request("GET", "/client-auth/verify", { headers: clientHeader(ctx.tokenStaff) });
    assert.equal(r.body.ok, false);
    assert.ok(REJECTED.includes(r.body.msg), r.body.msg);
    assert.equal(r.body.data, undefined);
    const r2 = await srv.request("GET", "/students", { headers: clientHeader(ctx.tokenStaff) });
    assert.equal(r2.body.ok, false);
    assert.ok(REJECTED.includes(r2.body.msg), r2.body.msg);
    assert.equal(r2.body.data, undefined);
  });

  test("Client tokeni Staff header'ida → rad etiladi", async () => {
    const r = await srv.request("GET", "/students", { headers: staffHeader(ctx.tokenA) });
    assert.equal(r.body.ok, false);
    assert.ok(REJECTED.includes(r.body.msg), r.body.msg);
    assert.equal(r.body.data, undefined);
  });

  // Regressiya (2026-10-02 tuzatildi, jwt.util.verify): avval xom
  // "invalid signature"/"jwt malformed" qaytardi — frontend logout qilmasdi,
  // error.util esa uni 5xx deb hisoblab Telegram alert yuborardi.
  test("boshqa secret bilan imzolangan token aniq 'auth.failed' qaytaradi", async () => {
    const r = await srv.request("GET", "/students", { headers: staffHeader(ctx.tokenA) });
    assert.equal(r.body.msg, "auth.failed");
  });

  test("buzilgan (malformed) token ham 'auth.failed' qaytaradi", async () => {
    const r = await srv.request("GET", "/students", { headers: staffHeader("not.a.jwt") });
    assert.equal(r.body.msg, "auth.failed");
  });

  test("Staff tokeni Staff header'ida, lekin 'BerarerClient' prefiksi bilan → auth.failed", async () => {
    const r = await srv.request("GET", "/students", {
      headers: { "x-staff-auth-token": `BerarerClient ${ctx.tokenStaff}` },
    });
    assert.equal(r.body.msg, "auth.failed");
  });

  test("Staff (hatto permissions: all) faqat-Owner endpointga kira olmaydi", async () => {
    const r = await srv.request("GET", "/students/revenue", { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "auth.forbidden");
    const audit = await srv.request("GET", "/audit-logs", { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(audit.body.msg, "auth.forbidden");
  });
});

describe("Staff filial izolyatsiyasi (Express 5 req.query tuzog'i)", () => {
  test("ro'yxatlar faqat o'z filiali — filtrsiz ham", async () => {
    const students = await srv.request("GET", "/students", { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(students.body.ok, true);
    assert.deepEqual(ids(students.body.data), ids([ctx.sA1]));
    const groups = await srv.request("GET", "/groups", { headers: staffHeader(ctx.tokenStaff) });
    assert.deepEqual(ids(groups.body.data), ids([ctx.gA1]));
  });

  test("?center=<boshqa filial> majburan o'z filialiga almashtiriladi", async () => {
    const students = await srv.request("GET", `/students?center=${ctx.A2.center._id}`, {
      headers: staffHeader(ctx.tokenStaff),
    });
    assert.equal(students.body.ok, true);
    assert.deepEqual(ids(students.body.data), ids([ctx.sA1]));

    const groups = await srv.request("GET", `/groups?center=${ctx.A2.center._id}`, {
      headers: staffHeader(ctx.tokenStaff),
    });
    assert.deepEqual(ids(groups.body.data), ids([ctx.gA1]));
  });

  test("boshqa filial guruhi ID orqali → auth.forbidden", async () => {
    const r = await srv.request("GET", `/groups/${ctx.gA2._id}`, { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "auth.forbidden");
  });

  test("boshqa filial o'quvchisi ID orqali → student.notFound", async () => {
    const r = await srv.request("GET", `/students/${ctx.sA2._id}`, { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "student.notFound");
  });

  test("boshqa client'ning ma'lumoti → topilmaydi", async () => {
    const r = await srv.request("GET", `/students/${ctx.sB1._id}`, { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(r.body.msg, "student.notFound");
    const g = await srv.request("GET", `/groups/${ctx.gB1._id}`, { headers: staffHeader(ctx.tokenStaff) });
    assert.equal(g.body.msg, "group.notFound");
  });
});
