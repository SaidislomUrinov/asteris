import { API } from "../../utils/fetching";

export const MAX_MEDIA = 10;
export const MAX_RESOURCES = 10;
export const TITLE_MAX = 200;
export const RESOURCE_LABEL_MAX = 80;
export const DESCRIPTION_MAX = 20000;

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
export const VIDEO_EXTENSIONS = ["mp4", "webm"];
export const MEDIA_ACCEPT = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].map((e) => `.${e}`).join(",");

export const LEVELS = ["important", "critical"];
export const AUDIENCES = ["all", "owners", "staff"];
export const STATUSES = ["draft", "published"];

// Daraja ranglari — client popup'dagi belgi bilan bir xil (Muhim — amber, Juda muhim — qizil).
export const LEVEL_TONES = {
  important: {
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
  },
  critical: {
    chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
};

export const STATUS_TONES = {
  draft: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  published: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

// Server bilan bir xil naqshlar: watch?v=, youtu.be/, /shorts/, /embed/, /live/.
export const parseYoutubeId = (raw = "") => {
  const value = String(raw).trim();
  if (!value) return null;
  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube(?:-nocookie)?\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  return null;
};

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// Server "/uploads/news/..." qaytaradi; lokal (yuklanayotgan) fayl uchun blob: URL.
export const resolveMediaUrl = (url = "") =>
  !url || /^(https?:|blob:)/.test(url) ? url : `${API}${url}`;

export const fileExtension = (name = "") => name.split(".").pop()?.toLowerCase() || "";

export const detectFileType = (file) => {
  const ext = fileExtension(file?.name);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return null;
};

export const isValidExternalUrl = (url = "") => /^https?:\/\/[^\s]+\.[^\s]+/.test(url.trim());
export const isValidInternalUrl = (url = "") => url.startsWith("/") && !url.startsWith("//");

export const htmlToText = (html = "") => {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/\u200b/g, "").trim();
};

const pad = (n) => String(n).padStart(2, "0");

// "28.09.2026 14:05" — server vaqtlari UNIX SONIYA (getNow()); ms yoki ISO ham qabul qilinadi.
export const formatDateTime = (value) => {
  if (!value) return "";
  const num = typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : null;
  const d = new Date(num === null ? value : num < 1e12 ? num * 1000 : num);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Muqova — birinchi media: rasm bo'lsa o'zi, YouTube bo'lsa thumbnail, video bo'lsa null.
export const coverOf = (media = []) => {
  const first = media?.[0];
  if (!first) return null;
  if (first.type === "image") return { kind: "image", src: resolveMediaUrl(first.url) };
  if (first.type === "youtube") {
    const id = first.youtubeId || parseYoutubeId(first.url);
    return id ? { kind: "youtube", src: youtubeThumb(id) } : null;
  }
  if (first.type === "video") return { kind: "video", src: resolveMediaUrl(first.url) };
  return null;
};

let keySeq = 0;
export const localKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

// Rich-text tarkib uslubi — muharrir va preview bir xil ko'rinsin.
export const NEWS_HTML_CLASS =
  "[&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:underline [&_p]:my-1 [&_code]:font-jet [&_code]:text-[12px] [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded";
