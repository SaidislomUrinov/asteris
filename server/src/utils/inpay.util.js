const envConfig = require("../configs/env.config");
const keyConfig = require("../configs/key.config");
const redisUtil = require("../utils/redis.util");

// inPAY (https://inpay.uz/api/v1/) — hujjatda webhook imzo tekshiruvi
// ko'rsatilmagan, shu sabab callback body'ga ishonilmaydi: holat har doim
// /transactions/ orqali qayta so'raladi, tanib bo'lmagan holat "pending"
// (xavfsiz default).
const TOKEN_TTL = 23 * 60 * 60; // 23 soat — hujjatga ko'ra token 24 soat amal qiladi

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

  console.log(`[inpay] -> ${method} ${url.toString()}`, body ? { ...body, token: body.token ? "***" : undefined } : "");

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

  console.log(`[inpay] <- ${res.status} ${url.pathname}`, data);

  if (!res.ok) {
    console.error(`[inpay] request failed: ${res.status}`, data?.message || "no message");
    throw new Error(data?.message || "inpay.requestFailed");
  }

  return data || {};
};

const fetchFreshToken = async () => {
  console.log("[inpay] fetching fresh token from inPAY");
  assertConfigured();

  const data = await request("/authorization/", {
    query: {
      merchant_id: envConfig.INPAY_MERCHANT_ID,
      merchant_token: envConfig.INPAY_MERCHANT_TOKEN,
    },
  });

  const token = data?.bearer_token;
  if (!token) {
    console.error("[inpay] tokenMissing — javobda bearer_token yo'q", data);
    throw new Error("inpay.tokenMissing");
  }

  console.log("[inpay] fresh token olindi");
  return token;
};

const getToken = async () => {
  const key = keyConfig.inpayToken();
  const cached = await redisUtil.get(key);
  if (cached) {
    console.log("[inpay] token Redis keshdan olindi");
    return cached;
  }

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
      console.warn("[inpay] token eskirgan bo'lishi mumkin, qayta uriniladi");
      await redisUtil.del(keyConfig.inpayToken());
      token = await fetchFreshToken();
      await redisUtil.set(keyConfig.inpayToken(), token, TOKEN_TTL);
      return await fn(token);
    }
    throw error;
  }
};

/**
 * @param {{ amount:number, description:string, callbackUrl:string, returnUrl?:string, phone:string }} params
 * @returns {Promise<{ payUrl:string, orderId:string }>}
 */
const createPayment = async ({ amount, description, callbackUrl, returnUrl, phone }) => {
  console.log("[inpay] createPayment boshlandi", { amount, description, callbackUrl, returnUrl, phone });
  assertConfigured();
  if (!amount || amount < 1000) {
    console.error("[inpay] invalidAmount", amount);
    throw new Error("inpay.invalidAmount");
  }

  return withAuth(async (token) => {
    const data = await request("/create/", {
      method: "POST",
      token,
      body: {
        merchant_id: envConfig.INPAY_MERCHANT_ID,
        token,
        amount,
        description,
        callback_url: callbackUrl,
        return_url: returnUrl,
        phone,
      },
    });

    const payUrl = data?.pay_url || data?.payUrl || data?.data?.pay_url;
    const orderId = data?.order_id || data?.orderId || data?.data?.order_id;
    if (!payUrl || !orderId) {
      console.error("[inpay] createFailed — javobda pay_url/order_id topilmadi", data);
      throw new Error("inpay.createFailed");
    }

    console.log("[inpay] createPayment muvaffaqiyatli", { orderId, payUrl });
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
  console.log("[inpay] getTransactionStatus so'ralmoqda", orderId);
  const data = await withAuth((token) =>
    request("/transactions/", { token, query: { order_id: orderId } }),
  );

  const raw =
    data?.status || data?.state || data?.payment_status || data?.data?.status;
  const normalized = String(raw || "").toLowerCase();

  let result = "pending";
  if (SUCCESS_VALUES.includes(normalized)) result = "paid";
  else if (FAILURE_VALUES.includes(normalized)) result = "failed";

  console.log(`[inpay] getTransactionStatus natija: ${orderId} -> ${result} (raw: ${raw})`);
  return result;
};

module.exports = { getToken, createPayment, getTransactionStatus };
