import axios from "axios";
import store from "../contexts/store";
import { resetUser } from "../contexts/user";

export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API}/api`,
});

// "owner" (Client Owner) yoki "staff" (Center Manager/Reception/Teacher) — login
// paytida tanlangan rolga qarab boshqa header/JWT scope ishlatiladi. Ikkalasi
// backendda mutlaqo mustaqil auth zanjiri (server/CLAUDE.md "Autentifikatsiya").
const AUTH_HEADERS = {
  owner: "x-client-auth-token",
  staff: "x-staff-auth-token",
};
const AUTH_PREFIX = {
  owner: "BerarerClient",
  staff: "BerarerStaff",
};

export const getAuthType = () => localStorage.getItem("authType");

// Faol filial (docs/API_CONTRACT_multi_center.md §2) — har so'rov `x-center-id`
// bilan ketadi, backend ro'yxatlarni shu filialga cheklaydi. Filial
// almashtirish — components/CenterSwitcher.jsx (to'liq reload bilan).
const ACTIVE_CENTER_KEY = "activeCenter";
export const getActiveCenter = () => {
  try {
    return localStorage.getItem(ACTIVE_CENTER_KEY) || "";
  } catch {
    return "";
  }
};
// Filiallar ro'yxati o'zgardi (yaratildi/o'chirildi/qayta ochildi) — App
// `verify`ni qayta chaqiradi: almashtirgich yangilanadi, faol filial
// o'chirilgan bo'lsa boshqasiga o'tib reload bo'ladi.
export const CENTERS_CHANGED_EVENT = "wenet:centers-changed";
export const notifyCentersChanged = () => window.dispatchEvent(new Event(CENTERS_CHANGED_EVENT));

export const setActiveCenter = (id) => {
  try {
    if (id) localStorage.setItem(ACTIVE_CENTER_KEY, id);
    else localStorage.removeItem(ACTIVE_CENTER_KEY);
  } catch {
    // localStorage yo'q — header yuborilmaydi, backend asosiy filialni oladi
  }
};
export const setSession = (authType, access) => {
  localStorage.setItem("authType", authType);
  localStorage.setItem("access", access);
};

api.interceptors.request.use((config) => {
  const authType = getAuthType();
  const token = localStorage.getItem("access");
  if (token && authType && AUTH_HEADERS[authType]) {
    config.headers[AUTH_HEADERS[authType]] = `${AUTH_PREFIX[authType]} ${token}`;
  }
  // So'rov o'zi `x-center-id` bergan bo'lsa (masalan "" — barcha filiallar
  // kerak bo'lgan Owner lookup'i, Hodim dialogi fanlari) — tegilmaydi.
  const center = getActiveCenter();
  if (center && config.headers["x-center-id"] === undefined) config.headers["x-center-id"] = center;
  return config;
});

// Server har doim HTTP 200 bilan javob beradi ({ ok:false, msg }) — 401 status
// kelmaydi, shuning uchun sessiya tugaganini javob tanasidan aniqlaymiz.
const dropSession = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("authType");
  store.dispatch(resetUser());
};

// Refresh token yo'q, access token muddatsiz — "auth.failed"/401 endi faqat
// signOut yoki boshqa qurilmadan qayta login qilinganda (bitta qurilmadan
// sessiya) kelishi mumkin, shuning uchun qayta urinmasdan sessiyani tugatamiz.
api.interceptors.response.use(
  (response) => {
    if (response.data?.ok === false && response.data?.msg === "auth.failed") {
      dropSession();
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      dropSession();
    }
    return Promise.reject(error);
  },
);
