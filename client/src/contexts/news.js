import { createSlice } from "@reduxjs/toolkit";
import { resetUser } from "./user";
import { api } from "../utils/fetching";
import { errorMsg } from "../utils/alert";

/**
 * Yangiliklar holatining YAGONA manbai (API_CONTRACT_news.md §3–§5).
 *
 * - `unread` — qo'ng'iroq badge'i va "Yangiliklar" tabi hisoblagichi.
 * - `queue`  — popup navbati: o'qilmagan yangiliklar id'lari server tartibida
 *   (Juda muhim avval, keyin eski → yangi); jonli kelganlar OXIRIGA qo'shiladi.
 * - `items`  — id → yangilik. O'qilgan yangilik navbatdan chiqadi, lekin shu
 *   yerda qoladi — popup "Oldingi" bilan o'qilgan slaydga qaytishi mumkin.
 *
 * Socket obunalari `hooks/useNewsSync.js` da (NewsPopup ichida bir marta).
 */
const initialState = {
  unread: 0,
  queue: [],
  items: {},
  loaded: false,
};

const news = createSlice({
  name: "news",
  initialState,
  reducers: {
    setNewsUnread: (state, { payload }) => {
      state.unread = Math.max(0, Number(payload) || 0);
    },
    // Serverdagi o'qilmaganlar ro'yxati bilan sinxronlash: navbatdagi mavjud
    // tartib saqlanadi (ochiq popup'dagi joriy slayd sakramaydi), serverda
    // yo'qlari (boshqa joyda o'qilgan/o'chirilgan) olib tashlanadi, yangilari
    // oxiriga qo'shiladi.
    syncNewsQueue: (state, { payload }) => {
      const list = payload || [];
      list.forEach((x) => {
        state.items[x._id] = { ...x, read: false };
      });
      const serverIds = list.map((x) => x._id);
      const serverSet = new Set(serverIds);
      const kept = state.queue.filter((id) => serverSet.has(id));
      const keptSet = new Set(kept);
      state.queue = [...kept, ...serverIds.filter((id) => !keptSet.has(id))];
      state.loaded = true;
    },
    appendNews: (state, { payload }) => {
      if (!payload?._id) return;
      state.items[payload._id] = { ...payload, read: false };
      if (!state.queue.includes(payload._id)) state.queue.push(payload._id);
    },
    updateNews: (state, { payload }) => {
      const prev = state.items[payload?._id];
      if (!prev) return;
      // O'qilganlik holati mahalliy haqiqat — payload'dagi `read:false` uni bosmaydi.
      state.items[payload._id] = { ...prev, ...payload, read: prev.read };
    },
    removeNews: (state, { payload: id }) => {
      delete state.items[id];
      state.queue = state.queue.filter((x) => x !== id);
    },
    readNewsLocal: (state, { payload: { id, wasUnread } }) => {
      const inQueue = state.queue.includes(id);
      if (inQueue || wasUnread) state.unread = Math.max(0, state.unread - 1);
      state.queue = state.queue.filter((x) => x !== id);
      if (state.items[id]) state.items[id].read = true;
    },
    readAllNewsLocal: (state) => {
      state.unread = 0;
      state.queue = [];
      Object.values(state.items).forEach((x) => {
        x.read = true;
      });
    },
  },
  extraReducers: (builder) => {
    // Chiqishda (yoki sessiya tugaganda) keyingi foydalanuvchiga eski navbat qolmasin.
    builder.addCase(resetUser, () => initialState);
  },
});

export const {
  setNewsUnread,
  syncNewsQueue,
  appendNews,
  updateNews,
  removeNews,
  readNewsLocal,
  readAllNewsLocal,
} = news.actions;

// ── Thunk'lar ───────────────────────────────────────────────────────────

// Optimistic o'qilgan id'lar — `/news/unread` so'rovi "o'qildi" POST'idan
// OLDIN yuborilib, KEYIN qaytsa, yangilik navbatga qaytib kirib, popup
// qayta ochilib qolmasligi uchun. O'qilgan yangilik hech qachon qayta
// o'qilmagan bo'lmaydi, shuning uchun sessiya davomida saqlash xavfsiz.
const locallyRead = new Set();
let syncSeq = 0;
let readSeq = 0;

export const resetNewsSession = () => {
  locallyRead.clear();
  syncSeq += 1;
  readSeq += 1;
};

const listOf = (data) => (Array.isArray(data) ? data : data?.items || []);

/** `/news/unread` + `/news/unread-count` — boshlang'ich yuklash va qayta ulanishda. */
export const fetchNewsUnread = () => async (dispatch) => {
  const seq = ++syncSeq;
  try {
    const [listRes, countRes] = await Promise.all([
      api.get("/news/unread"),
      api.get("/news/unread-count"),
    ]);
    // Kechikib kelgan eski javob yangisini bosib ketmasin (StrictMode'dagi
    // ikki marta mount, connect + boshlang'ich yuklash bir vaqtda...).
    if (seq !== syncSeq) return;
    if (listRes.data?.ok) {
      const list = listOf(listRes.data.data).filter((x) => x?._id && !locallyRead.has(x._id));
      dispatch(syncNewsQueue(list));
    }
    if (countRes.data?.ok) dispatch(setNewsUnread(countRes.data.data?.unread));
  } catch {
    // jim — keyingi `connect`da qayta urinamiz
  }
};

/** Faqat son (jonli `news:new`/`news:removed` dan keyin). */
export const fetchNewsUnreadCount = () => async (dispatch) => {
  try {
    const res = await api.get("/news/unread-count");
    if (res.data?.ok) dispatch(setNewsUnread(res.data.data?.unread));
  } catch {
    // jim
  }
};

/** Bitta yangilikni o'qilgan qilish — optimistic, xato bo'lsa toast. */
export const markNewsRead = (id, wasUnread = false) => async (dispatch) => {
  if (!id) return;
  locallyRead.add(id);
  dispatch(readNewsLocal({ id, wasUnread }));
  const seq = ++readSeq;
  try {
    const res = await api.post(`/news/${id}/read`);
    const { ok, data, msg } = res.data || {};
    // O'chirilgan/endi ko'rinmaydigan yangilik — navbatdan allaqachon
    // olingan, foydalanuvchiga xato ko'rsatishga hojat yo'q.
    if (!ok && msg === "news.notFound") return;
    if (!ok) throw new Error(msg);
    // Ketma-ket tez "Keyingi" bosilganda javoblar aralash kelishi mumkin —
    // faqat oxirgi so'rovning soni haqiqat.
    if (seq === readSeq && data && typeof data.unread === "number") {
      dispatch(setNewsUnread(data.unread));
    }
  } catch (error) {
    errorMsg(error?.message || "news.readError");
  }
};

/** Barchasini o'qilgan qilish — optimistic. */
export const markAllNewsRead = () => async (dispatch, getState) => {
  getState().news.queue.forEach((id) => locallyRead.add(id));
  dispatch(readAllNewsLocal());
  readSeq += 1;
  try {
    const res = await api.post("/news/read-all");
    const { ok, msg } = res.data || {};
    if (!ok) throw new Error(msg);
  } catch (error) {
    errorMsg(error?.message || "news.readError");
  }
};

export default news.reducer;
