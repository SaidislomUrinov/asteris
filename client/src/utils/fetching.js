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
