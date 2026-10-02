import { useCallback, useEffect, useRef, useState } from "react";
import {
  getConversation,
  getMessages,
  markChatRead,
  sendImageMessage,
  sendTextMessage,
} from "../api/chat";
import { useSocketEvent } from "./useSocketEvent";
import i18n from "../utils/i18n";

// Qo'llab-quvvatlash chati — conversation + messages state, socket
// obunalari (`chat:message`, `chat:read`) va yuborish/o'qish funksiyalarini
// birlashtiruvchi hook (API_CONTRACT_chat.md "Frontend — Client").
//
// `enabled` — foydalanuvchi login qilingan bo'lsagina ishga tushirilsin
// (App.jsx `<ChatWidget />`ni faqat auth holatida ko'rsatadi, lekin bu
// hook ham himoyalanadi — ikkinchi marta chaqirilishga qarshi).
function useChat(enabled = true) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await getConversation();
      const { ok, data } = res.data;
      if (ok) {
        setConversation(data.conversation);
        setMessages(data.messages || []);
        setHasMore((data.messages || []).length >= 50);
      }
    } catch {
      // tarmoq xatosi — widget bo'sh holatda qoladi, foydalanuvchi qayta ochsa qayta urinadi
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [enabled, load]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const before = messages[0]?._id;
      const res = await getMessages(before, 30);
      const { ok, data } = res.data;
      if (ok) {
        const older = data.messages || [];
        setMessages((prev) => [...older, ...prev]);
        setHasMore(older.length >= 30);
      }
    } catch {
      // jim — foydalanuvchi qayta scroll qilsa qayta urinadi
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, loadingMore, hasMore, messages]);

  const sendText = useCallback(async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    setSending(true);
    try {
      const res = await sendTextMessage(trimmed);
      const { ok, data } = res.data;
      if (ok) {
        setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev : [...prev, data]));
        return data;
      }
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  const sendImage = useCallback(async (file) => {
    if (!file) return null;
    setSending(true);
    try {
      const res = await sendImageMessage(file);
      const { ok, data } = res.data;
      if (ok) {
        setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev : [...prev, data]));
        return data;
      }
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  const markRead = useCallback(async () => {
    try {
      await markChatRead();
      setConversation((prev) => (prev ? { ...prev, clientUnreadCount: 0 } : prev));
      setMessages((prev) => prev.map((m) => ({ ...m, readByClient: true })));
    } catch {
      // jim
    }
  }, []);

  // Yangi xabar (o'zidan yoki admindan) — socket orqali barcha ulangan
  // qurilmalar sinxronlanadi. O'zi yuborgan xabar allaqachon `sendText`da
  // qo'shilgan bo'lishi mumkin — id bo'yicha dublikat oldini olinadi.
  useSocketEvent(
    "chat:message",
    (payload) => {
      const message = payload?.message;
      if (!message) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessageAt: message.createdAt,
              lastMessagePreview: message.type === "image" ? `📷 ${i18n.t("chat.imagePreview")}` : message.text,
              clientUnreadCount:
                message.sender?.kind === "admin" || message.sender?.kind === "system"
                  ? (prev.clientUnreadCount || 0) + 1
                  : prev.clientUnreadCount,
            }
          : prev,
      );
    },
    enabled,
  );

  useSocketEvent(
    "chat:read",
    (payload) => {
      if (payload?.readByAdmin) {
        setMessages((prev) => prev.map((m) => ({ ...m, readByAdmin: true })));
      }
    },
    enabled,
  );

  const unreadCount = conversation?.clientUnreadCount || 0;

  return {
    conversation,
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    unreadCount,
    loadMore,
    sendText,
    sendImage,
    markRead,
    reload: load,
  };
}

export default useChat;
