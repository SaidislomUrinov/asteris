import axios from "axios";
import store from "../contexts/store";
import { resetUser } from "../contexts/user";

export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers["x-admin-auth-token"] = `BerarerAdmin ${token}`;
  }
  return config;
});

// Server har doim HTTP 200 bilan javob beradi ({ ok:false, msg }) — 401 status
// kelmaydi, shuning uchun sessiya tugaganini javob tanasidan aniqlaymiz.
const dropSession = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  store.dispatch(resetUser());
};

// Access token 15 daqiqa yashaydi. `auth.failed` kelsa avval BIR MARTA refresh
// token bilan yangilab, so'rov qayta yuboriladi; refresh ham o'tmasa — logout.
// Bir vaqtda kelgan bir nechta `auth.failed` bitta refresh so'rovini kutadi
// (server refresh tokenni har safar almashtiradi — ikkinchi parallel refresh
// eski token bilan rad etilib, foydalanuvchini chiqarib yuborardi).
let refreshing = null;
const refreshSession = async () => {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return false;
  try {
    const res = await axios.post(`${API}/api/admin/refresh`, { refresh });
    if (!res.data?.ok) return false;
    localStorage.setItem("access", res.data.access);
    localStorage.setItem("refresh", res.data.refresh || "");
    return true;
  } catch {
    return false;
  }
};

api.interceptors.response.use(
  async (response) => {
    if (response.data?.ok === false && response.data?.msg === "auth.failed") {
      const original = response.config;
      if (!original._retried && !original.url?.includes("/admin/signin")) {
        refreshing ??= refreshSession().finally(() => {
          refreshing = null;
        });
        if (await refreshing) {
          original._retried = true;
          return api(original);
        }
      }
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
