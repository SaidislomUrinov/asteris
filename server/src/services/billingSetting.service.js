const BillingSetting = require("../models/BillingSetting");
const Center = require("../models/Center");
const redisUtil = require("../utils/redis.util");
const keyConfig = require("../configs/key.config");

const DTO = (s) => ({ cycleMode: s.cycleMode });

// Sozlama yozuvlar kam o'zgaradi, lekin har to'lov hisob-kitobida
// (computeBilling, applyCredit) o'qiladi — shuning uchun cache-aside:
// avval Redis'dan o'qiladi, topilmasa DB'dan olinib Redis'ga joylanadi,
// `updateSettings` chaqirilganda esa kalit o'chiriladi (keyingi o'qishda
// qayta DB'dan olib, yangi qiymat bilan Redis qayta to'ldiriladi). TTL —
// faqat xavfsizlik chizig'i (invalidatsiya asosan write paytida bo'ladi).
const CACHE_TTL = 3600;

// Center darajasida — har filial o'z sikl qoidasini tanlaydi (API_CONTRACT
// _center_settings.md). `centerId` shu clientga tegishli ekanligi chaqiruvchi
// tomonidan (controller) yoki shu yerda tekshiriladi.
const getOrCreate = async (centerId) => {
  const cacheKey = keyConfig.billingSetting(centerId);
  const cached = await redisUtil.get(cacheKey);
  if (cached) return cached;

  let setting = await BillingSetting.findOne({ center: centerId });
  if (!setting) {
    const center = await Center.findById(centerId).select("client");
    try {
      setting = await BillingSetting.create({ client: center?.client, center: centerId });
    } catch (error) {
      // Parallel so'rov shu orada yaratib qo'ydi (center unique) — o'shani olamiz.
      if (error?.code !== 11000) throw error;
      setting = await BillingSetting.findOne({ center: centerId });
    }
  }

  const dto = DTO(setting);
  await redisUtil.set(cacheKey, dto, CACHE_TTL);
  return dto;
};

const assertCenterOwnership = async (clientId, centerId) => {
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
  if (!center) throw new Error("center.notFound");
};

module.exports = {
  getOrCreate,

  getSettings: async (clientId, centerId) => {
    await assertCenterOwnership(clientId, centerId);
    return await getOrCreate(centerId);
  },

  updateSettings: async (clientId, centerId, body) => {
    await assertCenterOwnership(clientId, centerId);
    if (!["anchor", "calendarMonth"].includes(body.cycleMode)) {
      throw new Error("billing.invalidCycleMode");
    }
    const setting = await BillingSetting.findOneAndUpdate(
      { center: centerId },
      { $set: { client: clientId, cycleMode: body.cycleMode } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await redisUtil.del(keyConfig.billingSetting(centerId));
    return DTO(setting);
  },
};
