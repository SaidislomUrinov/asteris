// O'quvchi rasmi o'quv markaz (Client) darajasida
// (API_CONTRACT_student_photo_per_client.md). Servis darajasida, MongoDB
// `wenet_test` bilan. Fayllar vaqtinchalik katalogga yoziladi (process.chdir) —
// dev `uploads/` ga hech narsa tushmaydi.
const { TEST_MONGO_URI } = require("./helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");

const db = require("./helpers/db");
const { seedClient, seedCenter, seedGroup, seedStudent } = require("./helpers/seed");
const Student = require("../src/models/Student");
const studentService = require("../src/services/student.service");
const migrateStudentPhotos = require("../src/scripts/migrate-student-photos");
const { photoFor, latestPhoto } = require("../src/utils/studentPhoto.util");
const { dateStringToUnix } = require("../src/utils/date.util");

const ctx = {};
const originalCwd = process.cwd();
let tmpDir;

const makeFile = async (color) => ({
  name: "photo.png",
  mimetype: "image/png",
  data: await sharp({ create: { width: 40, height: 40, channels: 3, background: color } }).png().toBuffer(),
});
const fileExists = (p) => fs.existsSync(path.join(tmpDir, p));
const reload = (id) => Student.findById(id).lean();

before(async () => {
  assert.match(TEST_MONGO_URI, /\/wenet_test$/);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wenet-photo-test-"));
  process.chdir(tmpDir);
  await db.connect();

  ctx.A = await seedClient({ phone: "+998900000101" });
  ctx.B = await seedClient({ phone: "+998900000102" });
  ctx.A1 = await seedCenter(ctx.A.client, "A1");
  ctx.B1 = await seedCenter(ctx.B.client, "B1");
  ctx.gA = await seedGroup(ctx.A.client, ctx.A1);
  ctx.gB = await seedGroup(ctx.B.client, ctx.B1);
});

after(async () => {
  process.chdir(originalCwd);
  await db.disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Ikki client'da (A va B) o'qiydigan o'quvchi.
const seedShared = async (name) => {
  const s = await seedStudent(ctx.A.client, ctx.gA, name);
  s.groups.push({
    group: ctx.gB._id,
    center: ctx.gB.center,
    client: ctx.B.client._id,
    subject: ctx.gB.subject,
    price: 300000,
    joinedAt: dateStringToUnix("2026-01-10"),
  });
  await s.save();
  return s;
};

describe("studentPhoto.util", () => {
  test("photoFor / latestPhoto", () => {
    const s = {
      photos: [
        { client: "a", path: "/uploads/students/a.webp", updatedAt: 10 },
        { client: "b", path: "/uploads/students/b.webp", updatedAt: 20 },
      ],
    };
    assert.equal(photoFor(s, "a"), "/uploads/students/a.webp");
    assert.equal(photoFor(s, "c"), "");
    assert.equal(photoFor({}, "a"), "");
    assert.equal(latestPhoto(s), "/uploads/students/b.webp");
    assert.equal(latestPhoto({ photos: [] }), "");
  });
});

describe("rasm client darajasida", () => {
  test("A rasm o'zgartirsa B ning rasmi o'zgarmaydi", async () => {
    const s = await seedShared("Ali");
    const a = await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#f00"));
    const b = await studentService.setPhoto(ctx.B.client._id, s._id, await makeFile("#0f0"));
    assert.notEqual(a.photo, b.photo);

    const a2 = await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#00f"));
    const doc = await reload(s._id);
    assert.equal(doc.photos.length, 2, "har client uchun bitta element");
    assert.equal(photoFor(doc, ctx.A.client._id), a2.photo);
    assert.equal(photoFor(doc, ctx.B.client._id), b.photo);
    assert.equal(fileExists(a.photo), false, "A ning eski fayli o'chdi (hech kim ishlatmaydi)");
    assert.equal(fileExists(b.photo), true);

    // DTO har client'ga o'z rasmini beradi.
    assert.equal((await studentService.DTO(doc, ctx.A.client._id)).photo, a2.photo);
    assert.equal((await studentService.DTO(doc, ctx.B.client._id)).photo, b.photo);

    // A o'chiradi — B o'zgarmaydi.
    await studentService.removePhoto(ctx.A.client._id, s._id);
    const after = await reload(s._id);
    assert.equal(photoFor(after, ctx.A.client._id), "");
    assert.equal(photoFor(after, ctx.B.client._id), b.photo);
    assert.equal(fileExists(a2.photo), false);
  });

  test("umumiy path: A o'chirsa fayl qoladi, B ham o'chirsa fayl o'chadi", async () => {
    const s = await seedShared("Vali");
    const { photo } = await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#ff0"));
    // B'ga xuddi shu fayl (qo'shishdagi nusxa holati).
    await Student.updateOne(
      { _id: s._id },
      { $push: { photos: { client: ctx.B.client._id, path: photo, updatedAt: 1 } } },
    );

    await studentService.removePhoto(ctx.A.client._id, s._id);
    assert.equal(fileExists(photo), true, "B ishlatayotgan fayl qolishi kerak");

    await studentService.removePhoto(ctx.B.client._id, s._id);
    assert.equal(fileExists(photo), false, "endi hech kim ishlatmaydi — fayl o'chadi");
    assert.deepEqual((await reload(s._id)).photos, []);
  });

  test("A almashtirsa umumiy fayl B uchun qoladi", async () => {
    const s = await seedShared("Sardor");
    const { photo } = await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#0ff"));
    await Student.updateOne(
      { _id: s._id },
      { $push: { photos: { client: ctx.B.client._id, path: photo, updatedAt: 1 } } },
    );
    await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#f0f"));
    assert.equal(fileExists(photo), true);
    assert.equal(photoFor(await reload(s._id), ctx.B.client._id), photo);
  });

  // O'quvchi mijoz darajasida (API_CONTRACT_student_per_client.md): lookup va
  // `existingStudentId` faqat SHU mijoz hujjatlarini ko'radi.
  test("existingStudentId — faqat o'z mijozi ichida, rasm saqlanadi", async () => {
    const s = await seedStudent(ctx.A.client, ctx.gA, "Jasur");
    const { photo } = await studentService.setPhoto(ctx.A.client._id, s._id, await makeFile("#888"));

    // Boshqa mijoz bu hujjatni na ko'radi, na o'z guruhiga biriktira oladi.
    assert.deepEqual(await studentService.lookupByPhone(s.phone, ctx.B.client._id), []);
    await assert.rejects(
      studentService.create(ctx.B.client._id, {
        phone: s.phone,
        centerId: ctx.B1.center._id,
        groupId: ctx.gB._id,
        existingStudentId: s._id,
      }),
      /student\.notFound/,
    );

    const own = (await studentService.lookupByPhone(s.phone, ctx.A.client._id)).find(
      (x) => String(x._id) === String(s._id),
    );
    assert.equal(own.photo, photo);

    // O'z mijozi ichida ikkinchi guruhga qo'shish — hujjat va rasm o'sha.
    const gA2 = await seedGroup(ctx.A.client, ctx.A1);
    const dto = await studentService.create(ctx.A.client._id, {
      phone: s.phone,
      centerId: ctx.A1.center._id,
      groupId: gA2._id,
      existingStudentId: s._id,
    });
    assert.equal(String(dto._id), String(s._id));
    assert.equal(dto.photo, photo);
    const doc = await reload(s._id);
    assert.equal(doc.groups.length, 2);
    assert.equal(doc.photos.length, 1);
    assert.equal(fileExists(photo), true);
  });

  test("yangi o'quvchida rasm elementi yo'q", async () => {
    const dto = await studentService.create(ctx.A.client._id, {
      phone: "+998901234567",
      fullName: "Yangi",
      centerId: ctx.A1.center._id,
      groupId: ctx.gA._id,
    });
    assert.equal(dto.photo, "");
    assert.deepEqual((await reload(dto._id)).photos, []);
  });
});

describe("migratsiya", () => {
  test("photo → photos[], idempotent", async () => {
    const col = Student.collection;
    const legacyPath = "/uploads/students/legacy.webp";
    const base = (await seedShared("Legacy")).toObject();
    await col.updateOne({ _id: base._id }, { $set: { photo: legacyPath }, $unset: { photos: "" } });

    // A'zoliksiz hujjat — faqat $unset.
    const orphan = await seedStudent(ctx.A.client, ctx.gA, "Orphan");
    await col.updateOne({ _id: orphan._id }, { $set: { photo: legacyPath, groups: [] } });

    // Bitta client elementi allaqachon bor — saqlanadi, faqat yo'q client qo'shiladi.
    const partial = await seedShared("Partial");
    await col.updateOne(
      { _id: partial._id },
      {
        $set: {
          photo: legacyPath,
          photos: [{ client: ctx.A.client._id, path: "/uploads/students/own.webp", updatedAt: 5 }],
        },
      },
    );

    const first = await migrateStudentPhotos();
    assert.equal(first.migrated, 2);
    assert.equal(first.cleared, 1);

    const doc = await col.findOne({ _id: base._id });
    assert.equal(doc.photo, undefined);
    assert.equal(doc.photos.length, 2);
    assert.equal(photoFor(doc, ctx.A.client._id), legacyPath);
    assert.equal(photoFor(doc, ctx.B.client._id), legacyPath);

    const o = await col.findOne({ _id: orphan._id });
    assert.equal(o.photo, undefined);
    assert.deepEqual(o.photos, []);

    const p = await col.findOne({ _id: partial._id });
    assert.equal(p.photos.length, 2);
    assert.equal(photoFor(p, ctx.A.client._id), "/uploads/students/own.webp");
    assert.equal(photoFor(p, ctx.B.client._id), legacyPath);

    const second = await migrateStudentPhotos();
    assert.deepEqual(second, { migrated: 0, cleared: 0 });
    assert.deepEqual(await col.findOne({ _id: base._id }), doc);
  });
});

// Ota-ona paneli cross-tenant — `photo = latestPhoto(student)`
// (API_CONTRACT_student_photo_everywhere.md §1).
describe("ota-ona paneli", () => {
  test("findChildren / children / allPayments latestPhoto qaytaradi", async () => {
    const parentService = require("../src/services/parent.service");
    const { normalizeTelegramPhone } = require("../src/utils/phone.util");
    const phone = normalizeTelegramPhone("+998977770101");
    const s = await seedShared("Ota-ona Rasm");
    const old = "/uploads/students/parent-old.webp";
    const fresh = "/uploads/students/parent-new.webp";
    // Hook'larni chetlab o'tib to'g'ridan-to'g'ri yoziladi.
    await Student.updateOne(
      { _id: s._id },
      {
        $set: {
          parentTelegramPhone: phone,
          photos: [
            { client: ctx.A.client._id, path: fresh, updatedAt: 200 },
            { client: ctx.B.client._id, path: old, updatedAt: 100 },
          ],
        },
      },
    );
    const parent = { phone, role: "parent" };

    const kids = await parentService.findChildren(phone, "parent");
    assert.equal(kids.length, 1);
    assert.equal(kids[0].photo, fresh);

    const tree = await parentService.children(parent);
    assert.equal(tree[0].student.photo, fresh);

    const pays = await parentService.allPayments(parent);
    for (const d of pays.debts) assert.equal(d.student.photo, fresh);

    // Rasm yo'q bo'lsa — "".
    await Student.updateOne({ _id: s._id }, { $set: { photos: [] } });
    assert.equal((await parentService.findChildren(phone, "parent"))[0].photo, "");
    assert.equal((await parentService.children(parent))[0].student.photo, "");
  });
});
