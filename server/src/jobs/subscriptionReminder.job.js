const moment = require("moment-timezone");
const redis = require("../configs/redis.config");
const Subscription = require("../models/Subscription");
const Client = require("../models/Client");
const notificationService = require("../services/notification.service");
const { sendMail } = require("../utils/mail.util");
const { sendAlert } = require("../bot/alert");
const { getNow, addDays, formatDate, todayString } = require("../utils/date.util");
const env = require("../configs/env.config");

const TZ = "Asia/Tashkent";
const RUN_HOUR = 9; // 09:00 Asia/Tashkent
const TICK_MS = 60_000;

// ioredis `keyPrefix` ni o'zi qo'shadi — yakuniy kalit
// `asteris:scheduler:subscriptionReminder:{YYYY-MM-DD}`.
const lockKey = (day) => `scheduler:subscriptionReminder:${day}`;

// Kuniga BIR marta — qulf butun kunga (25 soat) qo'yiladi, shuning uchun
// cluster'dagi boshqa workerlar ham, qayta ishga tushirish ham takrorlamaydi.
const acquireDailyLock = async (day) => {
  try {
    const res = await redis.set(lockKey(day), "1", "EX", 90_000, "NX");
    return res === "OK";
  } catch {
    return false;
  }
};

const panelLink = `${env.SERVER_URL}`.replace(/\/$/, "");

// Bitta obuna uchun: email + panel bildirishnomasi. Har biri fire-and-forget.
const notifyOne = async (sub, kind) => {
  const client = await Client.findById(sub.client).select("name email blocked isDeleted");
  if (!client || client.isDeleted) return false;

  const daysLeft = Math.max(0, Math.ceil((sub.endDate - getNow()) / 86400));
  const tariffName = sub.tariffSnapshot?.name || "";

  // 1) Panel bildirishnomasi (dedup bilan — kuniga bitta).
  try {
    await notificationService.create({
      clientId: client._id,
      recipient: { id: client._id, kind: "client" },
      type: kind === "expired" ? "subscription:expired" : "subscription:expiring",
      title:
        kind === "expired"
          ? "notification.subscriptionExpiredTitle"
          : "notification.subscriptionExpiringTitle",
      body:
        kind === "expired"
          ? "notification.subscriptionExpiredBody"
          : "notification.subscriptionExpiringBody",
      data: { daysLeft, endDate: sub.endDate, tariffName },
      dedupKey: `subscription:${kind}:${sub._id}:${todayString()}`,
    });
  } catch {
    // bildirishnoma yozilmasa ham email ketaveradi
  }

  // 2) Email (client emaili bo'lsa va SMTP yoqilgan bo'lsa).
  if (client.email) {
    await sendMail({
      to: client.email,
      subject:
        kind === "expired"
          ? "WENET — obunangiz muddati tugadi"
          : `WENET — obunangiz ${daysLeft} kundan so'ng tugaydi`,
      template: kind === "expired" ? "subscription-expired" : "subscription-expiring",
      data: {
        clientName: client.name,
        tariffName,
        endDate: formatDate(sub.endDate),
        daysLeft,
        link: panelLink,
      },
    });
  }

  return true;
};

// Muddati o'tgan, lekin hali "active" deb qolgan obunalarni "expired"ga
// o'tkazadi. `requireActiveSubscription` middleware Read-Only'ni HAR DOIM
// jonli hisoblaydi (status+endDate), shu sabab bu sweep UX'ga ta'sir
// qilmaydi — faqat `Subscription.status` maydonining o'zi haqiqatga mos
// bo'lishi uchun (aks holda "expired" bo'yicha filtr/hisobot hech narsa
// topmasdi). Har tikda ishlaydi (kunlik qulfsiz) — `updateMany` idempotent,
// bir nechta worker bir vaqtda chaqirsa ham xavfsiz.
const expireLapsedSubscriptions = async () => {
  try {
    await Subscription.updateMany(
      { status: "active", endDate: { $lte: getNow() } },
      { $set: { status: "expired" } },
    );
  } catch (error) {
    console.error("subscriptionReminder(expire):", error.message);
  }
};

const run = async () => {
  const now = moment().tz(TZ);
  if (now.hour() !== RUN_HOUR) return;

  const day = now.format("YYYY-MM-DD");
  if (!(await acquireDailyLock(day))) return;

  const nowUnix = getNow();
  const soon = addDays(nowUnix, 2);

  const [expiring, expired] = await Promise.all([
    // Tugashiga ≤2 kun qolgan faol obunalar
    Subscription.find({ status: "active", endDate: { $gt: nowUnix, $lte: soon } }).select(
      "client endDate tariffSnapshot",
    ),
    // Kecha tugagan (hali "active" deb belgilangan) obunalar — markaz
    // read-only ga o'tgani haqida bir marta xabar beriladi.
    Subscription.find({
      status: "active",
      endDate: { $lte: nowUnix, $gt: addDays(nowUnix, -1) },
    }).select("client endDate tariffSnapshot"),
  ]);

  let notified = 0;
  for (const sub of expiring) {
    try {
      if (await notifyOne(sub, "expiring")) notified++;
    } catch (error) {
      console.error("subscriptionReminder(expiring):", error.message);
    }
  }
  for (const sub of expired) {
    try {
      if (await notifyOne(sub, "expired")) notified++;
    } catch (error) {
      console.error("subscriptionReminder(expired):", error.message);
    }
  }

  // Bildirishnomalar yuborilib bo'lgach — endi "kecha tugagan" to'plamni
  // (yuqorida `expired` qulaydi) haqiqatan ham "expired"ga o'tkazamiz.
  // Kechroq tugagan (bir kundan ortiq oldin), lekin hali "active" qolib
  // ketgan yozuvlar ham (masalan server bir necha kun o'chib turgan bo'lsa)
  // shu bitta sweep bilan tozalanadi.
  await expireLapsedSubscriptions();

  // Platforma adminiga umumiy xulosa (bitta xabar, spam yo'q).
  if (expiring.length || expired.length) {
    await sendAlert(
      "subscriptionExpiring",
      {
        title: "Obuna eslatmasi",
        body: "Kunlik tekshiruv yakunlandi.",
        meta: {
          "Tugash arafasida": expiring.length,
          Tugagan: expired.length,
          "Xabar berildi": notified,
        },
      },
      { throttle: false },
    );
  }
};

const start = () => {
  const timer = setInterval(() => {
    run().catch((error) => console.error("subscriptionReminder:", error.message));
  }, TICK_MS);
  timer.unref?.();
  console.log(`Subscription reminder scheduler started (har kuni ${RUN_HOUR}:00)`);
};

module.exports = { start, run, expireLapsedSubscriptions };
