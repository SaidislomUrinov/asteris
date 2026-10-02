const moment = require("moment-timezone");
const Client = require("../models/Client");
const Center = require("../models/Center");
const Staff = require("../models/Staff");
const Student = require("../models/Student");
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const redisUtil = require("../utils/redis.util");
const { getNow } = require("../utils/date.util");

const TZ = "Asia/Tashkent";
const CACHE_KEY = "cache:admin:dashboard";
const CACHE_TTL = 60;
const CHART_MONTHS = 6;

// So'nggi N oy uchun bo'sh (0 qiymatli) "YYYY-MM" bucketlar — hisoblangan
// natijalar shu ustiga qo'shiladi, shunda ma'lumot bo'lmagan oy ham grafikda
// uzilib qolmasdan ko'rinadi.
const emptyMonthBuckets = (months) => {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    buckets.push(moment.tz(TZ).subtract(i, "months").format("YYYY-MM"));
  }
  return buckets;
};

const monthOf = (unixSeconds) => moment.unix(unixSeconds).tz(TZ).format("YYYY-MM");

const getDashboard = async () => {
  const cached = await redisUtil.get(CACHE_KEY).catch(() => null);
  if (cached) return cached;

  const now = getNow();
  const twoDaysFromNow = now + 2 * 24 * 60 * 60;
  const monthStart = moment.tz(TZ).startOf("month").unix();
  const lastMonthStart = moment.tz(TZ).subtract(1, "month").startOf("month").unix();
  const lastMonthEnd = monthStart - 1;
  const chartFrom = moment.tz(TZ).subtract(CHART_MONTHS - 1, "months").startOf("month").unix();

  const [
    clientsTotal,
    activeClients,
    blockedClients,
    centersCount,
    staffCount,
    activeStudentGroups,
    activeSubscriptions,
    expiringSoonCount,
    expiredCount,
    activeSubsForMrr,
    tariffBreakdown,
    recentClientsRaw,
    monthlyPayments,
    newClientsRaw,
  ] = await Promise.all([
    Client.countDocuments({ isDeleted: false }),
    Client.countDocuments({ isDeleted: false, blocked: false }),
    Client.countDocuments({ isDeleted: false, blocked: true }),
    Center.countDocuments({ isDeleted: false }),
    Staff.countDocuments({ isDeleted: false }),
    // Har bir faol guruh-a'zoligi bitta o'quvchi-markaz bog'lanishi — distinct
    // o'quvchilar soni emas, balki markazlar bo'yicha "faol o'qiyapti" sonini
    // beradi (bitta o'quvchi bir nechta markazda bo'lsa bir nechta marta sanaladi,
    // bu platforma darajasidagi "faollik" ko'rsatkichi uchun to'g'ri).
    Student.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$groups" },
      { $match: { "groups.status": "active" } },
      { $count: "count" },
    ]),
    Subscription.countDocuments({ status: "active" }),
    Subscription.countDocuments({
      status: "active",
      endDate: { $gte: now, $lte: twoDaysFromNow },
    }),
    Subscription.countDocuments({ status: "expired" }),
    Subscription.find({ status: "active" }).select("price tariffSnapshot.name").lean(),
    Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$tariffSnapshot.name", count: { $sum: 1 } } },
    ]),
    Client.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({
        path: "subscription",
        select: "status endDate tariffSnapshot.name",
      })
      .select("clientId name phone blocked createdAt subscription")
      .lean(),
    SubscriptionPayment.find({
      status: "paid",
      paidAt: { $gte: chartFrom },
    })
      .select("amount paidAt")
      .lean(),
    Client.find({ isDeleted: false, createdAt: { $gte: chartFrom } })
      .select("createdAt")
      .lean(),
  ]);

  const students = activeStudentGroups[0]?.count || 0;
  const mrr = activeSubsForMrr.reduce((sum, s) => sum + (s.price || 0), 0);

  const currentMonthRevenue = monthlyPayments
    .filter((p) => p.paidAt >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0);
  const lastMonthRevenue = monthlyPayments
    .filter((p) => p.paidAt >= lastMonthStart && p.paidAt <= lastMonthEnd)
    .reduce((sum, p) => sum + p.amount, 0);

  const revenueBuckets = Object.fromEntries(emptyMonthBuckets(CHART_MONTHS).map((m) => [m, 0]));
  monthlyPayments.forEach((p) => {
    const m = monthOf(p.paidAt);
    if (m in revenueBuckets) revenueBuckets[m] += p.amount;
  });

  const growthBuckets = Object.fromEntries(emptyMonthBuckets(CHART_MONTHS).map((m) => [m, 0]));
  newClientsRaw.forEach((c) => {
    const m = monthOf(c.createdAt);
    if (m in growthBuckets) growthBuckets[m] += 1;
  });

  const noSubscriptionCount = Math.max(
    0,
    clientsTotal - activeSubscriptions - expiredCount,
  );

  const recentClients = recentClientsRaw.map((c) => {
    const sub = c.subscription;
    let subscriptionStatus = "none";
    if (sub) {
      if (sub.status === "active" && sub.endDate <= twoDaysFromNow) subscriptionStatus = "expiringSoon";
      else if (sub.status === "active") subscriptionStatus = "active";
      else subscriptionStatus = sub.status;
    }
    return {
      _id: c._id,
      clientId: c.clientId,
      name: c.name,
      phone: c.phone,
      blocked: c.blocked,
      createdAt: c.createdAt,
      tariff: sub?.tariffSnapshot?.name || null,
      subscriptionStatus,
    };
  });

  const data = {
    totals: {
      clients: clientsTotal,
      activeClients,
      blockedClients,
      centers: centersCount,
      staff: staffCount,
      students,
      activeSubscriptions,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
    },
    revenue: {
      currentMonth: currentMonthRevenue,
      lastMonth: lastMonthRevenue,
      mrr,
    },
    revenueChart: Object.entries(revenueBuckets).map(([month, amount]) => ({ month, amount })),
    clientGrowth: Object.entries(growthBuckets).map(([month, count]) => ({ month, count })),
    tariffDistribution: tariffBreakdown
      .filter((t) => t._id)
      .map((t) => ({ tariff: t._id, count: t.count })),
    subscriptionStatus: [
      { status: "active", count: activeSubscriptions - expiringSoonCount },
      { status: "expiringSoon", count: expiringSoonCount },
      { status: "expired", count: expiredCount },
      { status: "none", count: noSubscriptionCount },
    ],
    recentClients,
  };

  await redisUtil.set(CACHE_KEY, data, CACHE_TTL).catch(() => {});

  return data;
};

module.exports = { getDashboard };
