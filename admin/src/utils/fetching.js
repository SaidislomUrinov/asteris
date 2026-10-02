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
  store.dispatch(resetUser());
};

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
