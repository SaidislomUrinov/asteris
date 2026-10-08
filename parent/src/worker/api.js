import axios from "axios";
import { API, ApiError } from "../api/http";
import { authTelegram } from "../api/parent";
import { getInitData } from "../lib/telegram";

// Ishchi (Boshliq / Hodim) rejimi — docs/API_CONTRACT_worker_webapp.md §1, §5.
// Ota-ona tokenidan ALOHIDA saqlanadi: bitta brauzer tabida ikki rejim
// aralashib ketmasin (ota-ona `parent_access` kalitida qoladi).
const TOKEN_KEY = "worker_access";
const KIND_KEY = "worker_kind";

export const WORKER_KINDS = ["owner", "staff"];
export const isWorkerKind = (k) => WORKER_KINDS.includes(k);

const read = (k) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v) sessionStorage.setItem(k, v);
    else sessionStorage.removeItem(k);
  } catch {
    /* private rejim — sessiya xotirasiz ishlaydi */
  }
};

export const getWorkerToken = () => read(TOKEN_KEY);
export const getWorkerKind = () => read(KIND_KEY);
export const setWorkerSession = (token, kind) => {
  write(TOKEN_KEY, token);
  write(KIND_KEY, token ? kind : null);
};
export const clearWorkerSession = () => setWorkerSession(null, null);

// Header kind'ga qarab — mavjud Client/Staff JWT zanjiri (§0).
const authHeader = () => {
  const token = getWorkerToken();
  if (!token) return null;
  return getWorkerKind() === "owner"
    ? ["x-client-auth-token", `BerarerClient ${token}`]
    : ["x-staff-auth-token", `BerarerStaff ${token}`];
};

const http = axios.create({ baseURL: API });
http.interceptors.request.use((config) => {
  const h = authHeader();
  if (h) config.headers[h[0]] = h[1];
  return config;
});

// Refresh token yo'q (§1): `auth.failed` bo'lsa Telegram initData bilan bir
// marta jim qayta kiramiz. Bir vaqtda kelgan bir nechta 401 bitta so'rovni
// kutadi (single-flight).
let reauthPromise = null;
export const reauthWorker = () => {
  if (!reauthPromise) {
    reauthPromise = (async () => {
      const initData = getInitData();
      if (!initData) throw new ApiError("auth.failed");
      const res = await authTelegram(initData);
      if (!isWorkerKind(res?.kind)) throw new ApiError("auth.failed");
      setWorkerSession(res.access, res.kind);
      return res;
    })().finally(() => {
      reauthPromise = null;
    });
  }
  return reauthPromise;
};

// Sessiya butunlay tugaganda (qayta kirish ham o'xshamadi) AuthProvider
// eshitadigan hodisa.
export const WORKER_SESSION_LOST = "worker:session-lost";

const once = async (method, url, body, params) => {
  try {
    const res = await http.request({ method, url, data: body, params });
    const d = res.data;
    if (!d || d.ok === false) throw new ApiError(d?.msg, res.status);
    return d;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.response) throw new ApiError(e.response.data?.msg || `http.${e.response.status}`, e.response.status);
    throw new ApiError("error.network");
  }
};

// `{ ok, data, msg }` wrapper. Odatiy holda `data` (pagination bo'lsa
// `{ data, meta }`) qaytaradi; `raw: true` — butun javob tanasi (masalan
// `/students/revenue` yig'indilari `data` dan tashqarida keladi).
export const wreq = async (method, url, { body, params, raw = false } = {}) => {
  let d;
  try {
    d = await once(method, url, body, params);
  } catch (e) {
    if (e.code !== "auth.failed") throw e;
    try {
      await reauthWorker();
    } catch {
      window.dispatchEvent(new CustomEvent(WORKER_SESSION_LOST));
      throw e;
    }
    d = await once(method, url, body, params);
  }
  if (raw) return d;
  return d.meta ? { data: d.data, meta: d.meta } : d.data;
};

// ── Endpointlar (mavjud server yo'llari — server/src/routes) ──────────────
export const workerApi = {
  me: () => wreq("get", "/worker/me"),
  today: (centerId) => wreq("get", "/worker/today", { params: { centerId: centerId || undefined } }),

  // O'quvchilar / to'lov
  searchStudents: (search, center) =>
    wreq("get", "/students", { params: { page: 1, search: search || undefined, center: center || undefined } }),
  debtors: (center) => wreq("get", "/students", { params: { page: 1, debtStatus: "debtor", center: center || undefined } }),
  groupStudents: (groupId) =>
    wreq("get", "/students", { params: { page: 1, group: groupId, status: "active", limit: 1000 } }),
  addPayment: (studentId, entryId, body) =>
    wreq("post", `/students/${studentId}/groups/${entryId}/payments`, { body }),
  revenue: (params) => wreq("get", "/students/revenue", { params, raw: true }),
  student: (id) => wreq("get", `/students/${id}`),

  // Guruhlar
  groups: (params) => wreq("get", "/groups", { params: { page: 1, ...params } }),
  group: (id) => wreq("get", `/groups/${id}`),
  // O'qituvchi/yordamchi ismlari (ruxsatsiz tanlov ro'yxati — staff.routes `/lookup`).
  staffLookup: (role) => wreq("get", "/staffs/lookup", { params: { role } }),
  syllabus: (groupId) => wreq("get", `/syllabus/${groupId}`),

  // Davomat
  currentLesson: () => wreq("get", "/teacher/current-lesson"),
  attendanceToday: (groupId) => wreq("get", `/attendance/${groupId}`),
  attendanceMonth: (groupId, month) => wreq("get", `/attendance/${groupId}/month`, { params: { month } }),
  studentAttendance: (groupId, studentId) => wreq("get", `/attendance/${groupId}/student/${studentId}`),
  // `date` berilmasa — bugun (server default); berilsa o'tgan dars kuni.
  markAttendance: (groupId, studentId, status, reason = "", date) =>
    wreq("post", `/attendance/${groupId}/mark`, { body: { studentId, status, reason, date: date || undefined } }),
  // QR skan (tarif `attendance.qr`) — natija / `duplicate` / `needsGroup`.
  qrScan: (token, groupId) => wreq("post", "/attendance/qr/scan", { body: { token, groupId: groupId || undefined } }),

  // Baholar
  grades: (groupId, month) => wreq("get", `/grades/${groupId}`, { params: { month } }),
  setGrade: (groupId, studentId, value, date) =>
    wreq("post", `/grades/${groupId}`, { body: { studentId, value, date: date || undefined } }),
  studentGrades: (groupId, studentId) => wreq("get", `/grades/${groupId}/student/${studentId}`),
  removeGrade: (groupId, gradeId) => wreq("delete", `/grades/${groupId}/${gradeId}`),
  gradeSummary: (studentId) => wreq("get", `/grades/summary/${studentId}`),

  // Uyga vazifa (tarif `homework.manage`). Bo'sh matn = o'chirish (server).
  homework: (groupId, month) => wreq("get", `/homework/${groupId}`, { params: { month } }),
  setHomework: (groupId, date, text) => wreq("put", `/homework/${groupId}/${date}`, { body: { text } }),

  // Yutuqlar (tarif `gamification.badges`) — o'qituvchida faqat o'z guruhlari.
  studentBadges: (studentId) => wreq("get", `/badges/student/${studentId}`),

  // Lidlar
  leads: (params) => wreq("get", "/student-leads", { params: { page: 1, ...params } }),

  // Moliya / hisobot (owner)
  dashboard: (center) => wreq("get", "/dashboard", { params: { center: center || undefined } }),

  // Oylik (o'zi)
  salary: (staffId, month) => wreq("get", `/salaries/${staffId}`, { params: { month } }),

  // Xabarlar
  notifications: (page = 1) => wreq("get", "/notifications", { params: { page }, raw: true }),
  unreadCount: () => wreq("get", "/notifications/unread-count"),
  readAll: () => wreq("patch", "/notifications/read-all"),
  readOne: (id) => wreq("patch", `/notifications/${id}/read`),

  // Telegram xabarlari tili (Top til almashtirgichi)
  setLang: (lang) => wreq("patch", "/telegram/lang", { body: { lang } }),
};
