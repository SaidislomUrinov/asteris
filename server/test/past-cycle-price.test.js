// O'tgan sikl narxini o'zgartirish (docs/API_CONTRACT_past_cycle_price.md):
// tanlangan sikldan boshlab keyingi barcha oylarga tarqaladi, oldingilar
// o'zgarmaydi va `entry.price` (tahrir oynasi, WebApp, SMS ko'rsatadigan
// joriy narx) hisob bilan bir xil bo'lib qoladi.
require("./helpers/env");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("./helpers/db");
const { seedClient, seedCenter, seedGroup, seedStudent } = require("./helpers/seed");
const studentService = require("../src/services/student.service");
const Student = require("../src/models/Student");
const redis = require("../src/configs/redis.config");

const ctx = {};

before(async () => {
  await db.connect();
  ctx.A = await seedClient({ phone: "+998900000201" });
  ctx.A1 = await seedCenter(ctx.A.client, "A1");
  ctx.group = await seedGroup(ctx.A.client, ctx.A1);
});

after(async () => {
  await db.disconnect();
  await redis.quit().catch(() => redis.disconnect());
});

const cyclesOf = async (studentId) => {
  const doc = await Student.findById(studentId);
  const entry = doc.groups[0];
  return { entry, cycles: studentService.computeBilling(entry, ctx.group, "anchor").priceCycles };
};

describe("updateGroupPrice — o'tgan sikl", () => {
  test("shu sikldan boshlab tarqaladi, oldingilar o'zgarmaydi, entry.price mos", async () => {
    const s = await seedStudent(ctx.A.client, ctx.group, "Narx");
    const before = await cyclesOf(s._id);
    const past = before.cycles.filter((c) => !c.isCurrent);
    assert.ok(past.length >= 3, "kamida 3 ta yopilgan sikl kerak");
    const target = past[1];

    await studentService.updateGroupPrice(ctx.A.client._id, s._id, before.entry._id, 200000, null, target.cycleStart);

    const { entry, cycles } = await cyclesOf(s._id);
    for (const c of cycles) {
      assert.equal(c.price, c.cycleStart < target.cycleStart ? 300000 : 200000, `sikl ${c.month}`);
    }
    assert.equal(entry.price, 200000);

    // Keyin joriy narx alohida o'zgartirilsa — faqat joriy sikldan boshlab.
    await studentService.updateGroupPrice(ctx.A.client._id, s._id, entry._id, 350000);
    const after = await cyclesOf(s._id);
    const current = after.cycles.find((c) => c.isCurrent);
    assert.equal(current.price, 350000);
    assert.equal(after.entry.price, 350000);
    assert.equal(after.cycles.find((c) => c.cycleStart === target.cycleStart).price, 200000);
  });

  test("joriy yoki mavjud bo'lmagan sikl → student.invalidCycle", async () => {
    const s = await seedStudent(ctx.A.client, ctx.group, "Xato");
    const { entry, cycles } = await cyclesOf(s._id);
    const current = cycles.find((c) => c.isCurrent);
    for (const cycleStart of [current.cycleStart, 12345]) {
      await assert.rejects(
        studentService.updateGroupPrice(ctx.A.client._id, s._id, entry._id, 100000, null, cycleStart),
        /student\.invalidCycle/,
      );
    }
    assert.equal((await cyclesOf(s._id)).entry.price, 300000);
  });
});
