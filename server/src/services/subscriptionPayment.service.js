const Client = require("../models/Client");
const Tariff = require("../models/Tariff");
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const clientService = require("./client.service");
const inpayUtil = require("../utils/inpay.util");
const { calcAmount, discountsOf } = require("../utils/subscriptionPricing.util");
const systemSettingService = require("./systemSetting.service");
const { getNow, addDays, addMonths } = require("../utils/date.util");
const envConfig = require("../configs/env.config");
const emitter = require("../utils/emitter.util");
const redisUtil = require("../utils/redis.util");
const keyConfig = require("../configs/key.config");

const populateSubscription = (query) =>
  query.populate({ path: "subscription", populate: { path: "tariff" } });

module.exports = {
  // Client Owner "Obuna bo'lish"/"Uzaytirish"ni bosganda chaqiriladi.
  // `client.subscription` mavjud bo'lsa ham ishlaydi — tarif almashtirish/
  // uzaytirish shu orqali amalga oshadi (aniq holat verifyAndActivate'da,
  // to'lov tasdiqlangach hal qilinadi).
  initiate: async (clientId, tariffId, months) => {
    console.log("[subscriptionPayment] initiate boshlandi", { clientId, tariffId, months });
    if (!tariffId) throw new Error("client.fillTheRows");

    const client = await Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) throw new Error("client.notFound");

    const tariff = await Tariff.findOne({ _id: tariffId, isDeleted: false });
    if (!tariff) throw new Error("tariff.notFound");
    console.log("[subscriptionPayment] client va tariff topildi", { client: client._id.toString(), tariff: tariff.name });

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

      const trialDto = clientService.DTO(client);
      // Redis sessiya keshi ham yangilanadi — aks holda `fullClientAuth`
      // TTL tugagunicha eski (obunasiz) holatni qaytaraveradi (refresh'da
      // shu sabab "o'z holiga qaytib qolar" edi).
      await redisUtil.set(keyConfig.client(client._id), trialDto, envConfig.CLIENT_SESSION_TTL);

      console.log("[subscriptionPayment] trial faollashtirildi, to'lovsiz", { client: client._id.toString() });
      return { activated: true, data: trialDto };
    }

    const durationMonths = Number(months) || 1;
    // Chegirmalar Admin paneldan sozlanadi (docs/API_CONTRACT_tariff_discounts.md).
    const discounts = discountsOf(await systemSettingService.getRaw());
    const amount = calcAmount(tariff.price, durationMonths, discounts);
    if (amount == null) {
      console.error("[subscriptionPayment] invalidDuration", durationMonths);
      throw new Error("subscription.invalidDuration");
    }
    console.log("[subscriptionPayment] summa hisoblandi", { amount, durationMonths });

    console.log("[subscriptionPayment] inpayUtil.createPayment chaqirilmoqda");
    const { payUrl, orderId } = await inpayUtil.createPayment({
      amount,
      description: `WENET obuna — ${tariff.name} (${durationMonths} oy)`,
      callbackUrl: `${envConfig.SERVER_URL}/api/inpay/callback`,
      returnUrl: `${envConfig.CLIENT_APP_URL}/subscription`,
      phone: client.phone,
    });
    console.log("[subscriptionPayment] inpayUtil.createPayment natija", { payUrl, orderId });

    await SubscriptionPayment.create({
      client: client._id,
      tariff: tariff._id,
      amount,
      months: durationMonths,
      orderId,
      payUrl,
      status: "pending",
    });
    console.log("[subscriptionPayment] SubscriptionPayment yozuvi yaratildi", { orderId });

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
      // Tarif ko'tarilgan bo'lsa bloklangan filiallar limit doirasida qayta ochiladi.
      await require("./center.service").reconcileAfterTariffChange(client._id);

      const dto = clientService.DTO(client);
      // Redis sessiya keshi ham yangilanadi — aks holda `fullClientAuth`
      // TTL tugagunicha eski (obunasiz/eski tarif) holatni qaytaraveradi va
      // refresh qilinganda to'lov "bekor bo'lgandek" ko'rinadi.
      await redisUtil.set(keyConfig.client(client._id), dto, envConfig.CLIENT_SESSION_TTL);

      // Boshliq va shu markazdagi barcha hodimlar bir xil `client:{id}`
      // socket xonasida — ikkalasi ham darhol obuna faollashganini ko'radi.
      emitter(`client:${client._id}`, "subscription:activated", {
        data: dto,
        tariffName: tariff.name,
        orderId: txn.orderId,
      });

      return { status: "paid", activated: true, data: dto };
    }

    if (status === "cancelled" || status === "failed") {
      txn.status = status;
      await txn.save();
      return { status, activated: false };
    }

    return { status: "pending", activated: false };
  },
};
