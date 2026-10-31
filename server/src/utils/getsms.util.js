// getsms.uz SMS shlyuzi klienti. Hujjat: POST (form-urlencoded) `login`,
// `password`, `nickname`, `data` = JSON massiv (bitta so'rovda ko'pi bilan 100 ta).
// Akkaunt (creds) `{ login, password, nickname }` ko'rinishida beriladi (hozircha
// tizim darajasida — env.config GETSMS_*).
const envConfig = require("../configs/env.config");

const MAX_BATCH = 100;
const TIMEOUT_MS = 20000;

const post = async (creds, path, fields) => {
  if (!creds?.login || !creds?.password) throw new Error("sms.notConfigured");

  const body = new URLSearchParams({ login: creds.login, password: creds.password, ...fields });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${envConfig.GETSMS_URL.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const raw = await res.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error("sms.gatewayInvalidResponse");
    }
    return Array.isArray(json) ? json : [json];
  } catch (error) {
    if (error.name === "AbortError") throw new Error("sms.gatewayTimeout");
    if (error.message?.startsWith("sms.")) throw error;
    throw new Error("sms.gatewayUnreachable");
  } finally {
    clearTimeout(timer);
  }
};

// "+998901234567" → "998901234567"; yaroqsiz bo'lsa null.
const toGatewayPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return /^998\d{9}$/.test(digits) ? digits : null;
};

// items: [{ phone: "998...", text }] (≤100). Qaytaradi: items bilan bir xil tartibda
// [{ ok, requestId, messageId, error }]. Umumiy xato (login, limit...) — hamma element xato.
const send = async (creds, items) => {
  if (!items.length) return [];
  if (items.length > MAX_BATCH) throw new Error("sms.batchTooLarge");
  const fields = { data: JSON.stringify(items.map((i) => ({ phone: i.phone, text: i.text }))) };
  if (creds.nickname) fields.nickname = creds.nickname;

  const result = await post(creds, "/", fields);
  const globalError = result.length === 1 && result[0]?.error && !result[0]?.recipient ? result[0] : null;
  return items.map((_, idx) => {
    const r = globalError || result[idx];
    if (!r) return { ok: false, error: "noResponse" };
    if (r.error) return { ok: false, error: r.error_text || r.text || `error ${r.error_no}`, errorNo: r.error_no };
    return { ok: true, requestId: String(r.request_id), messageId: String(r.message_id) };
  });
};

// Yetkazilish holati: request_id → "delivered" | "failed" | "pending" | ...
const status = async (creds, requestId) => {
  const result = await post(creds, "/status/", { data: JSON.stringify([{ request_id: String(requestId) }]) });
  const r = result[0];
  if (!r || r.error) return { status: "unknown", error: r?.error_text || r?.text || "", errorNo: r?.error_no };
  return { status: String(r.status || "unknown").toLowerCase(), description: r.description || "" };
};

module.exports = { send, status, toGatewayPhone, MAX_BATCH };
