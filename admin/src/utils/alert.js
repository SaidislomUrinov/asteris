import { toast } from "sonner";
import i18n from "./i18n";

// Server xatolari i18n kaliti ko'rinishida keladi ("news.titleRequired"). Lang
// fayllarida yo'q kalit yoki kutilmagan texnik xato (axios / JS runtime)
// foydalanuvchiga XOM holda ko'rinmasligi uchun umumiy matnga almashtiriladi.
// Allaqachon tarjima qilingan matn (masalan `errorMsg(t("..."))`) o'zgarmaydi.
// client/src/utils/alert.js bilan bir xil mantiq.
const KEY_RE = /^[a-zA-Z]\w*\.[\w.:]+$/;
const NETWORK_RE = /^(Network Error|Request failed with status code|timeout of \d+ms exceeded|Failed to fetch|Load failed)/;
const RUNTIME_RE = /^(Cannot read propert|Cannot set propert|Unexpected token|Cast to |E11000 |\w+ is not (defined|a function))/;

const resolve = (msg, fallback, options) => {
  if (!msg || typeof msg !== "string") return i18n.t(fallback);
  if (KEY_RE.test(msg)) {
    if (i18n.exists(msg)) return i18n.t(msg, options);
    // Dev'da bo'shliq ko'rinsin — prod'da foydalanuvchi umumiy matnni ko'radi.
    if (import.meta.env.DEV) console.warn(`[i18n] tarjimasi yo'q kalit: ${msg}`);
    return i18n.t(fallback);
  }
  if (NETWORK_RE.test(msg)) return i18n.t("common.networkError");
  if (RUNTIME_RE.test(msg)) return i18n.t(fallback);
  return msg;
};

export const successMsg = (msg = "common.success") => {
  return toast.success(resolve(msg, "common.success"));
};
export const errorMsg = (msg = "common.error", options) => {
  return toast.error(resolve(msg, "common.error", options));
};
