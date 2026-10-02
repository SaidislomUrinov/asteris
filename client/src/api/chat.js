import { api } from "../utils/fetching";

// Qo'llab-quvvatlash chati — API_CONTRACT_chat.md "Frontend — Client".
// Owner (x-client-auth-token) va Staff (x-staff-auth-token) ikkalasi ham
// shu endpointlarga kira oladi — `api` interceptori (utils/fetching.js)
// joriy `authType`ga mos headerni avtomatik biriktiradi.

// O'z suhbatini oladi (mavjud bo'lmasa server avtomatik yaratadi, bo'sh
// state bilan). Oxirgi 50 ta xabar bilan birga qaytadi.
export const getConversation = () => api.get("/chat/conversation");

// Eski xabarlarni sahifalab yuklash (scroll up). `before` — eng eski
// yuklangan xabar id'si.
export const getMessages = (before, limit = 30) =>
  api.get("/chat/messages", { params: { before, limit } });

// Text xabar yuborish.
export const sendTextMessage = (text) => api.post("/chat/messages", { text });

// Rasm xabar yuborish — multipart/form-data, `req.files.image`.
export const sendImageMessage = (file) => {
  const fd = new FormData();
  fd.append("image", file);
  return api.post("/chat/messages/image", fd);
};

// O'z tomonidan barcha xabarlarni o'qilgan deb belgilaydi.
export const markChatRead = () => api.post("/chat/read");
