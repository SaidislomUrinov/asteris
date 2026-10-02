import axios from "axios";
import { mockRequest } from "./mock";

export const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "1";

const TOKEN_KEY = "parent_access";
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY);

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["x-parent-auth-token"] = `BerarerParent ${token}`;
  return config;
});

// Server doim HTTP 200 + { ok, data, msg } qaytaradi. Bu wrapper `ok:false` ni
// Error'ga aylantiradi (err.code = msg), sahifalar bitta try/catch bilan ishlaydi.
export class ApiError extends Error {
  constructor(code, status) {
    super(code || "error.unknown");
    this.code = code || "error.unknown";
    this.status = status;
  }
}

// Rol mos kelmasligi (masalan, rol botda almashtirilgan, WebApp esa eski rolda
// ochiq qolgan) — AuthProvider shu hodisani tinglab, toast chiqaradi va /me ni
// qayta yuklaydi.
export const ROLE_MISMATCH_EVENT = "parent:role-mismatch";
const ROLE_MISMATCH_CODES = ["parent.forbiddenForStudent", "parent.roleNotAvailable"];
const notifyRoleMismatch = (e) => {
  if (ROLE_MISMATCH_CODES.includes(e?.code))
    window.dispatchEvent(new CustomEvent(ROLE_MISMATCH_EVENT, { detail: { code: e.code } }));
};

export const request = async (method, url, body, params) => {
  try {
    return await rawRequest(method, url, body, params);
  } catch (e) {
    notifyRoleMismatch(e);
    throw e;
  }
};

const rawRequest = async (method, url, body, params) => {
  if (USE_MOCK) return mockRequest(method, url, body, params);
  try {
    const res = await api.request({ method, url, data: body, params });
    const d = res.data;
    if (!d || d.ok === false) throw new ApiError(d?.msg, res.status);
    // Pagination'li javoblar: { ok, data:[...], meta } → { data, meta }
    return d.meta ? { data: d.data, meta: d.meta } : d.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.response) throw new ApiError(e.response.data?.msg || `http.${e.response.status}`, e.response.status);
    throw new ApiError("error.network");
  }
};
