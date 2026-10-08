import { useCallback, useEffect, useRef, useState } from "react";
import { useWorker } from "../useWorker";
import { useSocketEvents } from "../useSocket";
import { workerApi } from "../api";
import { CHAT_FIRST_PAGE, CHAT_PAGE, isMineSender } from "../constants";

const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

// Id bo'yicha birlashtirish (socket va REST bir xabarni ikki marta olib
// kelishi mumkin), vaqt bo'yicha tartiblangan.
const mergeMessages = (prev, next) => {
  const map = new Map(prev.map((m) => [String(m._id), m]));
  next.forEach((m) => map.set(String(m._id), { ...map.get(String(m._id)), ...m }));
  return [...map.values()].sort(byTime);
};

// Yordam chati holati (API_CONTRACT_qr_card_send_and_worker_chat.md §B) —
// client'dagi `hooks/useChat.js` bilan bir xil manba va qoidalar:
// GET /chat/conversation (oxirgi 50 ta), GET /chat/messages?before&limit
// (yuqoriga skroll), POST /chat/messages | /chat/messages/image, POST /chat/read.
// Socket: `chat:message` { message }, `chat:read` { readByAdmin | readByClient }.
export const useSupportChat = () => {
  const { connected, setChatUnread } = useWorker();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(messages);
  const busyMore = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // `silent` — qayta ulanishda: skeleton'siz, yuklangan eski xabarlar saqlanadi.
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const d = await workerApi.chatConversation();
      const list = d?.messages || [];
      setConversation(d?.conversation || null);
      if (silent) setMessages((prev) => mergeMessages(prev, list));
      else {
        setMessages(list);
        setHasMore(list.length >= CHAT_FIRST_PAGE);
      }
    } catch (e) {
      if (!silent) setError(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  // Qayta ulanganda o'tkazib yuborilgan xabarlar uchun bir marta jim yangilash.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) load(true);
    wasConnected.current = connected;
  }, [connected, load]);

  // Eski xabarlar. Natija: qo'shilgan xabarlar soni (skroll joyini saqlash uchun).
  const loadMore = useCallback(async () => {
    const first = messagesRef.current[0];
    if (busyMore.current || !first) return 0;
    busyMore.current = true;
    setLoadingMore(true);
    try {
      const d = await workerApi.chatMessages(first._id, CHAT_PAGE);
      const older = d?.messages || [];
      setMessages((prev) => mergeMessages(prev, older));
      setHasMore(older.length >= CHAT_PAGE);
      return older.length;
    } catch {
      return 0; // jim — keyingi skrollda yana urinadi
    } finally {
      busyMore.current = false;
      setLoadingMore(false);
    }
  }, []);

  const send = useCallback(async (fn) => {
    setSending(true);
    try {
      const msg = await fn();
      if (msg?._id) setMessages((prev) => mergeMessages(prev, [msg]));
      return msg;
    } finally {
      setSending(false);
    }
  }, []);
  const sendText = useCallback((text) => send(() => workerApi.chatSendText(text)), [send]);
  const sendImage = useCallback((file) => send(() => workerApi.chatSendImage(file)), [send]);

  const reading = useRef(false);
  const markRead = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      await workerApi.chatRead();
      setChatUnread(0);
      setConversation((c) => (c ? { ...c, clientUnreadCount: 0 } : c));
      setMessages((prev) => (prev.some((m) => !m.readByClient) ? prev.map((m) => ({ ...m, readByClient: true })) : prev));
    } catch {
      /* jim — keyingi xabarda yana urinadi */
    } finally {
      reading.current = false;
    }
  }, [setChatUnread]);

  useSocketEvents(["chat:message", "chat:read"], (ev, payload) => {
    if (ev === "chat:message") {
      const m = payload?.message;
      if (!m?._id) return;
      setMessages((prev) => mergeMessages(prev, [m]));
      if (!isMineSender(m)) setConversation((c) => (c ? { ...c, clientUnreadCount: (c.clientUnreadCount || 0) + 1 } : c));
    } else if (payload?.readByAdmin) {
      setMessages((prev) => prev.map((m) => (isMineSender(m) ? { ...m, readByAdmin: true } : m)));
    }
  });

  return {
    conversation,
    messages,
    loading,
    error,
    loadingMore,
    hasMore,
    sending,
    reload: load,
    loadMore,
    sendText,
    sendImage,
    markRead,
  };
};
