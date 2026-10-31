// SMS balans hisobi (FILIAL darajasida — client+center, qism sonida). Qoidalar:
// docs/API_CONTRACT_sms_packages.md §0. Yechish FIFO (eng erta tugaydigan birinchi,
// cheksizlari oxirida), atomar — `remaining >= take` sharti bilan $inc.
const { Types } = require("mongoose");
const SmsPurchase = require("../models/SmsPurchase");
const SmsTransaction = require("../models/SmsTransaction");
const { getNow } = require("./date.util");

const oid = (id) => new Types.ObjectId(String(id));

// Yaroqli bo'lak: to'langan, qoldig'i bor, muddati o'tmagan.
const validFilter = (clientId, centerId, now = getNow()) => ({
  client: oid(clientId),
  center: oid(centerId),
  status: "paid",
  remaining: { $gt: 0 },
  $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

// FIFO tartib: muddatlilar o'sish bo'yicha, cheksizlar oxirida.
const fifo = (a, b) => {
  if (a.expiresAt == null && b.expiresAt == null) return (a.paidAt || 0) - (b.paidAt || 0);
  if (a.expiresAt == null) return 1;
  if (b.expiresAt == null) return -1;
  return a.expiresAt - b.expiresAt || (a.paidAt || 0) - (b.paidAt || 0);
};

const validPurchases = async (clientId, centerId) => {
  const rows = await SmsPurchase.find(validFilter(clientId, centerId)).lean();
  return rows.sort(fifo);
};

// Summary/socket/status javoblaridagi yagona `balance` shakli.
const getBalance = async (clientId, centerId) => {
  const rows = await validPurchases(clientId, centerId);
  const total = rows.reduce((s, r) => s + r.remaining, 0);
  // Eng erta tugaydigan sana va shu sanada tugaydigan jami qoldiq (cheksizlar hisobga kirmaydi).
  const dated = rows.filter((r) => r.expiresAt != null);
  const nearestExpiry = dated.length
    ? {
        at: dated[0].expiresAt,
        count: dated.filter((r) => r.expiresAt === dated[0].expiresAt).reduce((s, r) => s + r.remaining, 0),
      }
    : null;
  return {
    total,
    nearestExpiry,
    purchases: rows.map((r) => ({
      _id: r._id,
      packageName: r.packageName,
      remaining: r.remaining,
      smsCount: r.smsCount,
      expiresAt: r.expiresAt ?? null,
    })),
  };
};

const getTotal = async (clientId, centerId) => (await getBalance(clientId, centerId)).total;

const rollback = async (allocations) => {
  for (const a of allocations) await SmsPurchase.updateOne({ _id: a.purchase }, { $inc: { remaining: a.count } });
};

/**
 * `need` qismni FIFO bo'yicha atomar yechadi. Yetmasa olinganlari qaytariladi va
 * `sms.insufficientBalance` otiladi.
 * @returns {Promise<{ purchase: ObjectId, count: number, packageName: string }[]>}
 */
const deduct = async (clientId, centerId, need) => {
  const allocations = [];
  let left = need;
  // Parallel yechishda poyga bo'lsa qayta o'qib davom etamiz (cheklangan urinish).
  for (let attempt = 0; left > 0 && attempt < 50; attempt += 1) {
    const rows = await validPurchases(clientId, centerId);
    const available = rows.reduce((s, r) => s + r.remaining, 0);
    if (available < left) {
      await rollback(allocations);
      throw new Error("sms.insufficientBalance");
    }
    const row = rows[0];
    const take = Math.min(row.remaining, left);
    const upd = await SmsPurchase.findOneAndUpdate(
      { _id: row._id, remaining: { $gte: take }, $or: [{ expiresAt: null }, { expiresAt: { $gt: getNow() } }] },
      { $inc: { remaining: -take } },
      { returnDocument: "after" },
    ).select("packageName");
    if (!upd) continue;
    left -= take;
    const found = allocations.find((a) => String(a.purchase) === String(row._id));
    if (found) found.count += take;
    else allocations.push({ purchase: row._id, count: take, packageName: upd.packageName });
  }
  if (left > 0) {
    await rollback(allocations);
    throw new Error("sms.insufficientBalance");
  }
  return allocations;
};

/**
 * Batch.allocations bo'yicha `amount` qismni o'sha paketlarga qaytaradi.
 * `allocations` — batch hujjatidagi massiv (mutatsiya qilinadi, chaqiruvchi saqlaydi).
 * @returns {Promise<number>} haqiqatda qaytarilgan qism
 */
const refundToAllocations = async (allocations, amount) => {
  let left = amount;
  for (const a of allocations) {
    if (left <= 0) break;
    const room = a.count - (a.refunded || 0);
    const give = Math.min(room, left);
    if (give <= 0) continue;
    await SmsPurchase.updateOne({ _id: a.purchase }, { $inc: { remaining: give } });
    a.refunded = (a.refunded || 0) + give;
    left -= give;
  }
  return amount - left;
};

/**
 * Muddati o'tgan qoldiqni `expire` tranzaksiyasi sifatida BIR MARTA yozadi
 * (`expiredLogged` bayrog'i, atomar — parallel chaqiruvda ham bitta yozuv).
 * Balans hisobi muddatni o'zi e'tiborga oladi, shuning uchun bu faqat tarix uchun.
 */
const expireDue = async (clientId = null) => {
  const filter = {
    status: "paid",
    remaining: { $gt: 0 },
    expiresAt: { $ne: null, $lte: getNow() },
    expiredLogged: { $ne: true },
  };
  if (clientId) filter.client = oid(clientId);
  const due = await SmsPurchase.find(filter).select("_id").limit(500).lean();
  let count = 0;
  for (const { _id } of due) {
    const p = await SmsPurchase.findOneAndUpdate(
      { _id, expiredLogged: { $ne: true } },
      { $set: { expiredLogged: true } },
      { returnDocument: "after" },
    );
    if (!p || p.remaining < 1) continue;
    await SmsTransaction.create({
      client: p.client,
      center: p.center || null,
      type: "expire",
      amount: p.remaining,
      purchase: p._id,
      packageName: p.packageName,
    });
    count += 1;
  }
  return count;
};

module.exports = { getBalance, getTotal, deduct, refundToAllocations, expireDue, validFilter };
