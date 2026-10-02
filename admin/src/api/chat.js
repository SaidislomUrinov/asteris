import { api } from "../utils/fetching";

// Admin tomon — API_CONTRACT_chat.md "Admin tomoni" bo'limiga mos.

export const fetchConversations = (params = {}) =>
  api.get("/admin/chat/conversations", { params });

export const fetchConversationMessages = (id, params = {}) =>
  api.get(`/admin/chat/conversations/${id}/messages`, { params });

export const sendTextMessage = (id, text) =>
  api.post(`/admin/chat/conversations/${id}/messages`, { text });

// Rich-text (b/i, ul/ol, blockquote, a) — server sanitizatsiya qiladi.
export const sendRichMessage = (id, html) =>
  api.post(`/admin/chat/conversations/${id}/messages`, { html });

export const sendImageMessage = (id, file) => {
  const fd = new FormData();
  fd.append("image", file);
  return api.post(`/admin/chat/conversations/${id}/messages/image`, fd);
};

export const markConversationRead = (id) =>
  api.post(`/admin/chat/conversations/${id}/read`);

export const sendGreeting = (id, lang) =>
  api.post(`/admin/chat/conversations/${id}/greeting`, { lang });
