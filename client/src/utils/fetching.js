import axios from "axios";
import store from "../contexts/store";
import { resetUser } from "../contexts/user";

export const API = "http://localhost:5000";

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
const REFRESH_ENDPOINTS = {
  owner: "/client-auth/refresh",
  staff: "/staff-auth/refresh",
};

export const getAuthType = () => localStorage.getItem("authType");
export const setSession = (authType, access, refresh) => {
  localStorage.setItem("authType", authType);
  localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
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
  localStorage.removeItem("refresh");
  localStorage.removeItem("authType");
  store.dispatch(resetUser());
};

// Access token muddati qisqa (15m) — parallel so'rovlar bir vaqtda ko'p marta
// refresh chaqirmasligi uchun bitta umumiy promise ishlatiladi.
let refreshPromise = null;

const performRefresh = () => {
  const authType = getAuthType();
  const refresh = localStorage.getItem("refresh");
  const endpoint = REFRESH_ENDPOINTS[authType];
  if (!refresh || !endpoint) return Promise.reject(new Error("auth.failed"));

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API}/api${endpoint}`, { refresh })
      .then((res) => {
        const { ok, access, refresh: newRefresh } = res.data;
        if (!ok) throw new Error("auth.failed");
        setSession(authType, access, newRefresh);
        return access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  async (response) => {
    if (response.data?.ok === false && response.data?.msg === "auth.failed") {
      const config = response.config;
      if (!config._retried) {
        config._retried = true;
        try {
          const authType = getAuthType();
          const access = await performRefresh();
          config.headers[AUTH_HEADERS[authType]] = `${AUTH_PREFIX[authType]} ${access}`;
          return api(config);
        } catch {
          dropSession();
        }
      } else {
        dropSession();
      }
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        const authType = getAuthType();
        const access = await performRefresh();
        config.headers[AUTH_HEADERS[authType]] = `${AUTH_PREFIX[authType]} ${access}`;
        return api(config);
      } catch {
        dropSession();
      }
    } else if (error.response?.status === 401) {
      dropSession();
    }
    return Promise.reject(error);
  },
);
