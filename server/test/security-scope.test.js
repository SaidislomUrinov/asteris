// QA 2026-10-02 da topilgan ruxsat/filial teshiklari uchun regressiya testlari:
// filial izolyatsiyasi (oylik, a'zolik mutatsiyalari, davomat, sozlamalar,
// kalendar), boshqa mijoz o'quvchisining umumiy kontaktlari, bloklashning
// darhol kuchga kirishi (Redis sessiya keshi) va /dashboard ruxsati.
const { TEST_MONGO_URI } = require("./helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("./helpers/db");
const { startServer, clientHeader, staffHeader } = require("./helpers/http");
const { seedClient, seedCenter, seedGroup, seedStudent, seedStaff } = require("./helpers/seed");
const Student = require("../src/models/Student");
const { dateStringToUnix } = require("../src/utils/date.util");

let srv;
const ctx = {};

before(async () => {
  assert.match(TEST_MONGO_URI, /\/wenet_test$/);
  await db.connect();
  srv = await startServer();

  ctx.A = await seedClient({ phone: "+998900000011" });
  ctx.B = await seedClient({ phone: "+998900000012" });
  ctx.A1 = await seedCenter(ctx.A.client, "A1");
  ctx.A2 = await seedCenter(ctx.A.client, "A2");
  ctx.B1 = await seedCenter(ctx.B.client, "B1");

  ctx.gA1 = await seedGroup(ctx.A.client, ctx.A1);
  ctx.gA2 = await seedGroup(ctx.A.client, ctx.A2);
  ctx.gB1 = await seedGroup(ctx.B.client, ctx.B1);

  ctx.sA1 = await seedStudent(ctx.A.client, ctx.gA1, "Ali A1");
  ctx.sA2 = await seedStudent(ctx.A.client, ctx.gA2, "Vali A2");
  ctx.sB1 = await seedStudent(ctx.B.client, ctx.gB1, "Sardor B1");

  // Ikki mijozda (A va B) birga o'qiydigan o'quvchi — umumiy hujjat.
  ctx.shared = await seedStudent(ctx.B.client, ctx.gB1, "Umumiy");
  await Student.updateOne(
    { _id: ctx.shared._id },
    {
      $set: { parentPhone: "+998911111111" },
      $push: {
        groups: {
          group: ctx.gA1._id,
          center: ctx.gA1.center,
          client: ctx.A.client._id,
          subject: ctx.gA1.subject,
          price: 300000,
          joinedAt: dateStringToUnix("2026-01-10"),
        },
      },
    },
  );

  ctx.recA1 = await seedStaff(ctx.A.client, ctx.A1.center, { login: "sec_rec_a1" });
  ctx.recA2 = await seedStaff(ctx.A.client, ctx.A2.center, { login: "sec_rec_a2" });
  ctx.teachA1 = await seedStaff(ctx.A.client, ctx.A1.center, {
    login: "sec_teach_a1",
    role: "teacher",
    permissions: ["group:view", "student:view", "attendance:view", "attendance:create"],
  });
  ctx.blockMe = await seedStaff(ctx.A.client, ctx.A1.center, { login: "sec_block_me" });

  const signIn = async (path, body) => {
    const r = await srv.request("POST", path, { body });
    assert.equal(r.body.ok, true, `signin failed: ${r.body.msg}`);
    return r.body.access;
  };
  const staffSignIn = (s) => signIn("/staff-auth/signin", { login: s.login, password: s.password, slug: s.slug });
  ctx.tokenA = await signIn("/client-auth/signin", { phone: ctx.A.phone, password: ctx.A.password });
  ctx.tokenRecA1 = await staffSignIn(ctx.recA1);
  ctx.tokenTeachA1 = await staffSignIn(ctx.teachA1);
  ctx.tokenBlockMe = await staffSignIn(ctx.blockMe);
});

after(async () => {
  await srv?.close();
  await db.disconnect();
});

const asRec = () => ({ headers: staffHeader(ctx.tokenRecA1) });
const asTeach = () => ({ headers: staffHeader(ctx.tokenTeachA1) });

describe("Filial izolyatsiyasi (A1 hodimi → A2 ma'lumoti)", () => {
  test("oylik: boshqa filial hodimining hisobi ko'rinmaydi", async () => {
    const r = await srv.request("GET", `/salaries/${ctx.recA2.staff._id}`, asRec());
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "staff.notFound");
  });

  test("oylik: o'qituvchi boshqa hodimning hisobini ko'rolmaydi", async () => {
    const r = await srv.request("GET", `/salaries/${ctx.recA1.staff._id}`, asTeach());
    assert.equal(r.body.msg, "auth.forbidden");
  });

  test("oylik tranzaksiyasi: boshqa filial hodimiga yozib bo'lmaydi", async () => {
    const r = await srv.request("POST", `/salaries/${ctx.recA2.staff._id}/transactions`, {
      ...asRec(),
      body: { type: "bonus", amount: 1000 },
    });
    assert.equal(r.body.ok, false);
  });

  test("a'zolik: boshqa filial o'quvchisiga to'lov → auth.forbidden", async () => {
    const entry = ctx.sA2.groups[0]._id;
    const r = await srv.request("POST", `/students/${ctx.sA2._id}/groups/${entry}/payments`, {
      ...asRec(),
      body: { amount: 1, type: "cash" },
    });
    assert.equal(r.body.msg, "auth.forbidden");
  });

  test("o'quvchi tahriri: boshqa filial o'quvchisi → auth.forbidden", async () => {
    const r = await srv.request("PATCH", `/students/${ctx.sA2._id}`, { ...asRec(), body: { fullName: "X Y" } });
    assert.equal(r.body.msg, "auth.forbidden");
  });

  test("davomat: boshqa filial guruhi jurnali va belgilash → auth.forbidden", async () => {
    const get = await srv.request("GET", `/attendance/${ctx.gA2._id}`, asRec());
    assert.equal(get.body.msg, "auth.forbidden");
    const mark = await srv.request("POST", `/attendance/${ctx.gA2._id}/mark`, {
      ...asRec(),
      body: { studentId: String(ctx.sA2._id), status: "present" },
    });
    assert.equal(mark.body.msg, "auth.forbidden");
  });

  test("davomat sozlamalari va kalendar: boshqa filial → auth.forbidden", async () => {
    const settings = await srv.request("GET", `/attendance/settings/${ctx.A2.center._id}`, asRec());
    assert.equal(settings.body.msg, "auth.forbidden");
    const cal = await srv.request("GET", `/calendar/${ctx.A2.center._id}/2026-10`, asRec());
    assert.equal(cal.body.msg, "auth.forbidden");
  });

  test("o'z filiali ishlayveradi (asos tekshiruvi)", async () => {
    const r = await srv.request("GET", `/attendance/settings/${ctx.A1.center._id}`, asRec());
    assert.equal(r.body.ok, true, r.body.msg);
  });
});

describe("Boshqa mijoz o'quvchisi (umumiy hujjat)", () => {
  // O'quvchi mijoz darajasida: boshqa mijoz hujjati lookup'da umuman chiqmaydi.
  test("lookup boshqa mijoz o'quvchisini ko'rsatmaydi", async () => {
    const r = await srv.request("GET", `/students/lookup?phone=${encodeURIComponent(ctx.sB1.phone)}`, {
      headers: clientHeader(ctx.tokenA),
    });
    assert.equal(r.body.ok, true);
    assert.deepEqual(r.body.data, []);
  });

  test("lookup — o'qituvchiga yopiq (student:create kerak)", async () => {
    const r = await srv.request("GET", `/students/lookup?phone=${encodeURIComponent(ctx.sB1.phone)}`, asTeach());
    assert.equal(r.body.msg, "auth.forbidden");
  });

  test("existingStudentId telefon mos kelmasa → student.notFound", async () => {
    const r = await srv.request("POST", "/students", {
      headers: clientHeader(ctx.tokenA),
      body: {
        phone: "+998999999999",
        centerId: String(ctx.A1.center._id),
        groupId: String(ctx.gA1._id),
        existingStudentId: String(ctx.sB1._id),
      },
    });
    assert.equal(r.body.msg, "student.notFound");
    const fresh = await Student.findById(ctx.sB1._id).lean();
    assert.equal(fresh.groups.length, 1);
  });

  test("ikki mijozdagi o'quvchining ota-ona raqamini bitta mijoz o'zgartira olmaydi", async () => {
    const r = await srv.request("PATCH", `/students/${ctx.shared._id}`, {
      headers: clientHeader(ctx.tokenA),
      body: { parentPhone: "+998900000099" },
    });
    assert.equal(r.body.msg, "student.sharedContactLocked");
    const fresh = await Student.findById(ctx.shared._id).lean();
    assert.equal(fresh.parentPhone, "+998911111111");
  });

  test("telefon formati tekshiriladi (\"abc\" saqlanmaydi)", async () => {
    const r = await srv.request("PATCH", `/students/${ctx.sA1._id}`, {
      headers: clientHeader(ctx.tokenA),
      body: { phone: "abc" },
    });
    assert.equal(r.body.msg, "student.invalidPhone");
  });
});

describe("Sessiya va ruxsatlar", () => {
  test("bloklangan hodim keyingi so'rovdayoq to'xtatiladi (kesh tozalanadi)", async () => {
    const before = await srv.request("GET", "/groups", { headers: staffHeader(ctx.tokenBlockMe) });
    assert.equal(before.body.ok, true, before.body.msg);

    const block = await srv.request("PATCH", `/staffs/${ctx.blockMe.staff._id}/block`, {
      headers: clientHeader(ctx.tokenA),
      body: { blocked: true },
    });
    assert.equal(block.body.ok, true, block.body.msg);

    const after = await srv.request("GET", "/groups", { headers: staffHeader(ctx.tokenBlockMe) });
    assert.equal(after.body.ok, false);
    // Bloklashda sessiyalar bekor qilinadi (`revokeSessions`) — eski token
    // endi umuman yaroqsiz; qayta kirishga urinish esa `staff.blocked` oladi.
    assert.equal(after.body.msg, "auth.failed");
    const relogin = await srv.request("POST", "/staff-auth/signin", {
      body: { login: ctx.blockMe.login, password: ctx.blockMe.password, slug: ctx.blockMe.slug },
    });
    assert.equal(relogin.body.msg, "staff.blocked");
  });

  test("o'qituvchi /dashboard moliyasini ko'rmaydi (dashboard:view yo'q)", async () => {
    const r = await srv.request("GET", "/dashboard", asTeach());
    assert.equal(r.body.msg, "auth.forbidden");
  });
});

describe("Kirish validatsiyasi va javob formati", () => {
  const owner = () => ({ headers: clientHeader(ctx.tokenA) });

  test("body'dagi Mongo operatori ($ne) bajarilmaydi — xona yaratilmaydi", async () => {
    const r = await srv.request("POST", "/rooms", { ...owner(), body: { centerId: { $ne: null }, name: "inj" } });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "common.invalidInput");
  });

  test("noto'g'ri ObjectId xom 'Cast to ObjectId' emas, common.invalidInput", async () => {
    const r = await srv.request("GET", "/students/xyz", owner());
    assert.equal(r.body.ok, false);
    assert.doesNotMatch(r.body.msg, /Cast to/);
  });

  test("satr o'rniga obyekt (name.trim) → common.invalidInput", async () => {
    const r = await srv.request("POST", "/rooms", {
      ...owner(),
      body: { centerId: String(ctx.A1.center._id), name: { a: 1 } },
    });
    assert.equal(r.body.msg, "common.invalidInput");
  });

  test("xona: manfiy sig'im va juda uzun nom rad etiladi", async () => {
    const neg = await srv.request("POST", "/rooms", {
      ...owner(),
      body: { centerId: String(ctx.A1.center._id), name: "R", capacity: -50 },
    });
    assert.equal(neg.body.msg, "common.invalidInput");
    const long = await srv.request("POST", "/rooms", {
      ...owner(),
      body: { centerId: String(ctx.A1.center._id), name: "x".repeat(500) },
    });
    assert.equal(long.body.msg, "common.invalidInput");
  });

  test("to'lov summasi: true / 'abc' / 1e300 qabul qilinmaydi", async () => {
    const entry = ctx.sA1.groups[0]._id;
    for (const amount of [true, "abc", 1e300, [5], 0.5]) {
      const r = await srv.request("POST", `/students/${ctx.sA1._id}/groups/${entry}/payments`, {
        ...owner(),
        body: { amount, type: "cash" },
      });
      assert.equal(r.body.msg, "student.invalidAmount", `amount=${JSON.stringify(amount)}`);
    }
    const fresh = await Student.findById(ctx.sA1._id).lean();
    assert.equal(fresh.groups[0].payments.length, 0);
  });

  test("mavjud bo'lmagan API yo'li — JSON (HTML emas)", async () => {
    const r = await srv.request("GET", "/no-such-route", owner());
    assert.equal(r.body.ok, false);
    assert.equal(r.body.msg, "common.notFound");
  });
});
