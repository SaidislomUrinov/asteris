// Minimal tenant ma'lumotlari: Client(+obuna) → Center(lar) → Subject/Room →
// Group → Student. To'g'ridan-to'g'ri model orqali (servis biznes qoidalarini
// chetlab o'tib), faqat test uchun kerakli maydonlar bilan.
const { getHash } = require("../../src/utils/hash.util");
const { getNow, dateStringToUnix } = require("../../src/utils/date.util");
const Tariff = require("../../src/models/Tariff");
const Subscription = require("../../src/models/Subscription");
const Client = require("../../src/models/Client");
const Center = require("../../src/models/Center");
const Subject = require("../../src/models/Subject");
const Room = require("../../src/models/Room");
const Group = require("../../src/models/Group");
const Staff = require("../../src/models/Staff");
const Student = require("../../src/models/Student");

let tariffPromise = null;
const getTariff = () => {
  tariffPromise ??= Tariff.create({
    name: "Test",
    price: 0,
    studentLimit: -1,
    centerLimit: -1,
    teacherLimit: -1,
    receptionLimit: -1,
    // Xona moduli — validatsiya testlari `/rooms` orqali boradi.
    allowedPermissions: ["room.control"],
  });
  return tariffPromise;
};

let groupSeq = 0;
let phoneSeq = 1000000;

const seedClient = async ({ phone, password = "secret-pass" }) => {
  const tariff = await getTariff();
  const client = await Client.create({ name: `Client ${phone}`, phone, password: await getHash(password) });
  const now = getNow();
  const sub = await Subscription.create({
    client: client._id,
    tariff: tariff._id,
    tariffSnapshot: { name: tariff.name, price: 0, centerLimit: -1, allowedPermissions: [] },
    price: 0,
    startDate: now - 86400,
    endDate: now + 30 * 86400,
    status: "active",
  });
  client.subscription = sub._id;
  await client.save();
  return { client, phone, password };
};

const seedCenter = async (client, name) => {
  const center = await Center.create({ client: client._id, name });
  const subject = await Subject.create({
    client: client._id,
    center: center._id,
    name: `${name} fan`,
    price: 300000,
    durationMonths: 6,
  });
  const room = await Room.create({ client: client._id, center: center._id, name: `${name} xona` });
  return { center, subject, room };
};

const seedGroup = async (client, { center, subject, room }, schedule = {}) =>
  Group.create({
    client: client._id,
    center: center._id,
    subject: subject._id,
    room: room._id,
    pendingId: ++groupSeq,
    status: "active",
    activeId: groupSeq,
    activatedAt: dateStringToUnix("2026-01-10"),
    days: ["mon", "wed", "fri"],
    startTime: "09:00",
    endTime: "10:30",
    ...schedule,
  });

const seedStudent = async (client, group, fullName) =>
  Student.create({
    phone: `+99890${++phoneSeq}`,
    fullName,
    groups: [
      {
        group: group._id,
        center: group.center,
        client: client._id,
        subject: group.subject,
        price: 300000,
        joinedAt: dateStringToUnix("2026-01-10"),
      },
    ],
  });

const seedStaff = async (client, center, { login, password = "staff-pass", role = "reception", permissions = ["all"] }) => {
  const staff = await Staff.create({
    client: client._id,
    center: center._id,
    name: login,
    login,
    password: await getHash(password),
    role,
    permissions,
  });
  return { staff, login, password };
};

module.exports = { seedClient, seedCenter, seedGroup, seedStudent, seedStaff };
