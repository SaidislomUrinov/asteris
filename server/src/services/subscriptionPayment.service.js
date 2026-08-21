const Client = require("../models/Client");
const Tariff = require("../models/Tariff");
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const clientService = require("./client.service");
const inpayUtil = require("../utils/inpay.util");
const { isValidDuration, calcAmount } = require("../utils/subscriptionPricing.util");
const { getNow, addDays, addMonths } = require("../utils/date.util");
const envConfig = require("../configs/env.config");

const populateSubscription = (query) =>
  query.populate({ path: "subscription", populate: { path: "tariff" } });

module.exports = {
  // Client Owner "Obuna bo'lish"/"Uzaytirish"ni bosganda chaqiriladi.
  // `client.subscription` mavjud bo'lsa ham ishlaydi — tarif almashtirish/
  // uzaytirish shu orqali amalga oshadi (aniq holat verifyAndActivate'da,
  // to'lov tasdiqlangach hal qilinadi).
  initiate: async (clientId, tariffId, months) => {
    if (!tariffId) throw new Error("client.fillTheRows");

    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) throw new Error("client.notFound");

    const tariff = await Tariff.findOne({ _id: tariffId, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");

    // Tekin sinov muddati — faqat hali hech qanday obuna bo'lmagan va
    // ishlatilmagan bo'lsa, tranzaksiyasiz darhol faollashtiriladi.
    // "Uzaytirish"/tarif almashtirish (client.subscription mavjud) uchun
    // trial qo'llanilmaydi.
    if (tariff.trialDays > 0 && !client.trialUsed && !client.subscription) {
      const start = getNow();
      const end = addDays(start, tariff.trialDays);

      const sub = await Subscription.create({
        client: client._id,
        tariff: tariff._id,
        tariffSnapshot: clientService.snapshotTariff(tariff),
        price: 0,
        startDate: start,
        endDate: end,
        status: "active",
        source: "trial",
      });

      client.subscription = sub._id;
      client.trialUsed = true;
      await client.save();
      await populateSubscription(client);

      return { activated: true, data: clientService.DTO(client) };
    }

    const durationMonths = Number(months) || 1;
    if (!isValidDuration(durationMonths)) {
      throw new Error("subscription.invalidDuration");
    }

    const amount = calcAmount(tariff.price, durationMonths);

    const { payUrl, orderId } = await inpayUtil.createPayment({
      amount,
      description: `Asteris obuna — ${tariff.name} (${durationMonths} oy)`,
      paymentMethod: "inPAY",
      callbackUrl: `${envConfig.SERVER_URL}/api/inpay/callback`,
      phone: client.phone,
    });

    await SubscriptionPayment.create({
      client: client._id,
      tariff: tariff._id,
      amount,
      months: durationMonths,
      orderId,
      payUrl,
      status: "pending",
    });

    return { activated: false, payUrl, orderId };
  },

  // Callback (webhook) va qo'lda polling — ikkalasi ham shu funksiyani
  // chaqiradi, idempotent. Webhook tanasidagi ma'lumotga ishonilmaydi —
  // holat har doim inPAY'dan qayta so'raladi.
  verifyAndActivate: async (orderId) => {
    const txn = await SubscriptionPayment.findOne({ orderId });
    if (!txn) throw new Error("subscription.transactionNotFound");

    if (txn.status === "paid") {
      const client = await populateSubscription(
        Client.findOne({ _id: txn.client, isDeleted: false }),
      );
      return { status: "paid", activated: true, data: client ? clientService.DTO(client) : null };
    }

    const status = await inpayUtil.getTransactionStatus(orderId);

    if (status === "paid") {
      const client = await Client.findOne({ _id: txn.client, isDeleted: false });
      if (!client) throw new Error("client.notFound");

      txn.status = "paid";
      txn.paidAt = getNow();

      const tariff = await Tariff.findOne({ _id: txn.tariff });
      if (!tariff) throw new Error("tariff.notFound");

      const now = getNow();
      let current = null;
      if (client.subscription) {
        current = await Subscription.findById(client.subscription);
      }

      let start = now;
      if (current && String(current.tariff) === String(txn.tariff)) {
        // Bir xil tarif — "Uzaytirish": muddati hali tugamagan bo'lsa,
        // yangi davr eskisi tugagan joydan boshlanadi (pullik kunlar
        // yo'qotilmaydi). Allaqachon tugagan bo'lsa hozirdan boshlanadi.
        start = current.endDate > now ? current.endDate : now;
      }
      // Boshqa tarif yoki obuna umuman yo'q bo'lsa — hozirdan boshlanadi
      // (yuqoridagi `start = now` default holati shu ikkalasini qamrab oladi).

      const end = addMonths(start, txn.months);

      const sub = await Subscription.create({
        client: client._id,
        tariff: tariff._id,
        tariffSnapshot: clientService.snapshotTariff(tariff),
        price: txn.amount,
        startDate: start,
        endDate: end,
        status: "active",
        source: "payment",
      });

      if (current) {
        current.status = "changed";
        await current.save();
      }

      client.subscription = sub._id;
      await client.save();
      txn.subscription = sub._id;

      await txn.save();
      await populateSubscription(client);

      return { status: "paid", activated: true, data: clientService.DTO(client) };
    }

    if (status === "cancelled" || status === "failed") {
      txn.status = status;
      await txn.save();
      return { status, activated: false };
    }

    return { status: "pending", activated: false };
  },
};
