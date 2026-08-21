const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const redisUtil = require("../utils/redis.util");

// inPAY (https://inpay.uz/api/v1/) — ochiq hujjatida aniq JSON sxemalar va
// webhook imzo tekshiruvi ko'rsatilmagan (to'liq reference login talab
// qiladigan /docs/ ostida). Shu sabab bu modul himoyalangan tarzda yozilgan:
// token muddati noaniq bo'lgani uchun konservativ TTL bilan keshlanadi,
// status javobidagi maydon/qiymat nomlari bir nechta variant bo'yicha
// tekshiriladi, tanib bo'lmagan holat har doim "pending" (xavfsiz default).
const TOKEN_TTL = 45 * 60; // 45 daqiqa — hujjatlashtirilmagan muddat uchun ehtiyotkor chegara

const assertConfigured = () => {
  if (!envConfig.INPAY_MERCHANT_ID || !envConfig.INPAY_MERCHANT_TOKEN) {
    throw new Error("inpay.notConfigured");
  }
};

const request = async (path, { method = "GET", query, body, token } = {}) => {
  const url = new URL(`${envConfig.INPAY_BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || "inpay.requestFailed");
  }

  return data || {};
};

const fetchFreshToken = async () => {
  assertConfigured();

  const data = await request("/authorization/", {
    query: {
      merchant_id: envConfig.INPAY_MERCHANT_ID,
      merchant_token: envConfig.INPAY_MERCHANT_TOKEN,
    },
  });

  // Aniq javob maydon nomi hujjatlashtirilmagan — bir nechta ehtimoliy
  // nomni tekshiramiz.
  const token = data?.token || data?.access_token || data?.bearer || data?.data?.token;
  if (!token) throw new Error("inpay.tokenMissing");

  return token;
};

const getToken = async () => {
  const key = keyConfig.inpayToken();
  const cached = await redisUtil.get(key);
  if (cached) return cached;

  const token = await fetchFreshToken();
  await redisUtil.set(key, token, TOKEN_TTL);
  return token;
};

// So'rov 401 bilan qaytsa keshni tozalab bir marta qayta uriniladi — token
// muddati kutilganidan oldin tugagan bo'lishi mumkin.
const withAuth = async (fn) => {
  let token = await getToken();
  try {
    return await fn(token);
  } catch (error) {
    if (error.message === "inpay.requestFailed") {
      await redisUtil.del(keyConfig.inpayToken());
      token = await fetchFreshToken();
      await redisUtil.set(keyConfig.inpayToken(), token, TOKEN_TTL);
      return await fn(token);
    }
    throw error;
  }
};

/**
 * @param {{ amount:number, description:string, paymentMethod:string, callbackUrl:string, phone:string }} params
 * @returns {Promise<{ payUrl:string, orderId:string }>}
 */
const createPayment = async ({ amount, description, paymentMethod, callbackUrl, phone }) => {
  assertConfigured();
  if (!amount || amount < 1000) throw new Error("inpay.invalidAmount");

  return withAuth(async (token) => {
    const data = await request("/create/", {
      method: "POST",
      token,
      body: {
        merchant_id: envConfig.INPAY_MERCHANT_ID,
        token,
        amount,
        description,
        payment_method: paymentMethod,
        callback_url: callbackUrl,
        phone,
      },
    });

    const payUrl = data?.pay_url || data?.payUrl || data?.data?.pay_url;
    const orderId = data?.order_id || data?.orderId || data?.data?.order_id;
    if (!payUrl || !orderId) throw new Error("inpay.createFailed");

    return { payUrl, orderId: String(orderId) };
  });
};

const SUCCESS_VALUES = ["paid", "success", "successful", "completed", "confirmed"];
const FAILURE_VALUES = ["cancelled", "canceled", "failed", "error", "expired", "rejected"];

/**
 * inPAY'dan kelgan xom statusni bizning enum'ga xavfsiz normallashtiradi.
 * @param {string} orderId
 * @returns {Promise<"paid"|"cancelled"|"failed"|"pending">}
 */
const getTransactionStatus = async (orderId) => {
  const data = await withAuth((token) =>
    request("/transactions/", { token, query: { order_id: orderId } }),
  );

  const raw =
    data?.status || data?.state || data?.payment_status || data?.data?.status;
  const normalized = String(raw || "").toLowerCase();

  if (SUCCESS_VALUES.includes(normalized)) return "paid";
  if (FAILURE_VALUES.includes(normalized)) return "failed";
  return "pending";
};

module.exports = { getToken, createPayment, getTransactionStatus };
