import i18n from "../../i18n";
import { API } from "../../api/http";
import { fmtDate } from "../../utils/format";
import { tashkentDate, tashkentDateShift, tashkentHHmm } from "../utils";

// Rasm URL'lari server ildiziga nisbatan (`/uploads/chat/...`), `API` esa
// ".../api" — shuning uchun `/api` qismi olib tashlanadi (§B.2).
const ORIGIN = API.replace(/\/api\/?$/, "");
export const chatImageSrc = (url) => (!url ? "" : /^https?:\/\//i.test(url) ? url : `${ORIGIN}${url}`);

const asDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

// Toshkent vaqti bo'yicha (server vaqtlari bilan bir xil mintaqa).
export const chatTime = (v) => tashkentHHmm(asDate(v));
export const chatDayKey = (v) => tashkentDate(asDate(v));

// Sana ajratgichi: "Bugun" / "Kecha" / "8-oktabr" (boshqa yil — yil bilan).
export const chatDayLabel = (key) => {
  if (key === tashkentDate()) return i18n.t("worker.support.today");
  if (key === tashkentDateShift(-1)) return i18n.t("worker.support.yesterday");
  const label = fmtDate(key);
  return key.slice(0, 4) === tashkentDate().slice(0, 4) ? label : `${label} ${key.slice(0, 4)}`;
};
