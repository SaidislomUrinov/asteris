import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPaperAirplane, HiPhoto, HiOutlineLanguage, HiArrowLeft } from "react-icons/hi2";
import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import {
  fetchConversations,
  fetchConversationMessages,
  sendTextMessage,
  sendRichMessage,
  sendImageMessage,
  sendGreeting,
  markConversationRead,
} from "../../api/chat";
import { errorMsg } from "../../utils/alert";
import { API } from "../../utils/fetching";
import socket from "../../socket";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import Avatar from "../../ui/Avatar";
import IconButton from "../../ui/IconButton";
import RichComposer from "./RichComposer";
import ParticipantBadge from "./ParticipantBadge";

// Server rasmli xabar uchun lastMessagePreview'ga shu belgini yozadi
// (chat.service.js) — ko'rsatishda joriy tilga tarjima qilinadi.
const IMAGE_PREVIEW = "📷 Rasm";

// Suhbat kimniki: odam ismi (Owner yoki aniq hodim) va uning konteksti —
// hodim uchun "Markaz · Filial", owner uchun telefon.
const participantInfo = (conv, t) => {
  const p = conv?.participant;
  const clientName = conv?.clientName || conv?.clientId?.name || "";
  const name = p?.name || clientName || t("chat.unknownClient");
  const context =
    p?.kind === "staff"
      ? [clientName, p.centerName].filter(Boolean).join(" · ")
      : conv?.clientPhone || "";
  return { name, context };
};

// Ro'yxatdagi vaqt: bugun bo'lsa "14:05", aks holda "26.09".
const shortTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.toDateString() === now.toDateString()
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

// Suhbatlar ro'yxatidagi bitta karta (Telegram uslubi): ism + vaqt,
// "Mijoz" / "Ishchi · rol" belgisi + markaz/filial, oxirgi xabar.
const ConversationItem = ({ conv, active, onClick, t }) => {
  const { name, context } = participantInfo(conv, t);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left duration-150 cursor-pointer ${
        active ? "bg-blue-500 text-white shadow-[0_4px_14px_-4px_rgba(59,130,246,0.45)]" : "hover:bg-slate-100 text-slate-800"
      }`}
    >
      <Avatar user={{ name }} size={42} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <span className={`text-[10px] shrink-0 ${active ? "text-white/70" : "text-slate-400"}`}>
            {shortTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <ParticipantBadge participant={conv.participant} inverted={active} />
          {context && (
            <span className={`text-[11px] truncate ${active ? "text-white/80" : "text-slate-500"}`}>{context}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className={`text-xs truncate ${active ? "text-white/70" : "text-slate-400"}`}>
            {conv.lastMessagePreview === IMAGE_PREVIEW
              ? t("chat.imagePreview")
              : conv.lastMessagePreview || t("chat.noMessages")}
          </p>
          {conv.adminUnreadCount > 0 && (
            <span
              className={`flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold leading-none shrink-0 ${
                active ? "bg-white text-blue-600" : "bg-red-500 text-white"
              }`}
            >
              {conv.adminUnreadCount > 99 ? "99+" : conv.adminUnreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// Ro'yxat filtri: hammasi / faqat mijozlar (owner) / faqat ishchilar.
const KIND_FILTERS = [
  { value: "all", labelKey: "chat.filterAll" },
  { value: "client", labelKey: "chat.filterClients" },
  { value: "staff", labelKey: "chat.filterStaff" },
];

// Bitta xabar bulbucha.
const MessageBubble = ({ msg, t }) => {
  const kind = msg.sender?.kind;
  // `system` (avto-javob) admin panelida ham "biz tomon" (o'ng, ko'k)
  // sifatida ko'rsatiladi — go'yo admin tarafdan kelganday.
  const isAdmin = kind === "admin" || kind === "system";

  return (
    <div className={`flex items-end gap-2 max-w-[70%] ${isAdmin ? "self-end flex-row-reverse" : "self-start"}`}>
      {!isAdmin && <Avatar user={{ name: msg.sender?.name }} size={24} className="mb-0.5" />}
      <div className="flex flex-col min-w-0">
        {!isAdmin && (
          <p className="text-[10px] font-medium text-slate-400 px-1 mb-0.5">
            {msg.sender?.name || t("chat.unknownClient")}
          </p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isAdmin ? "bg-blue-500 text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
          }`}
        >
          {msg.type === "image" ? (
            <img
              src={`${API}${msg.imageUrl}`}
              alt="chat"
              className="rounded-lg max-w-full max-h-64 object-cover -mx-0.5 -my-0.5"
            />
          ) : msg.format === "html" ? (
            <div
              className={`text-sm leading-relaxed break-words [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_a]:underline [&_p]:m-0 ${
                isAdmin ? "[&_blockquote]:border-white/40" : "[&_blockquote]:border-slate-300 [&_a]:text-blue-600"
              }`}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Avto javob tugmasi — til tanlanganda shu til bo'yicha shablon xabar
// yuboriladi (server: `GREETING_TEMPLATES`, chat.service.js).
const GREETING_LANGS = [
  { value: "uz", label: "O'zbekcha" },
  { value: "uzc", label: "Ўзбекча" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export default function Chat() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const [activeId, setActiveId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [sending, setSending] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);
  const [sendingGreeting, setSendingGreeting] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const activeIdRef = useRef(null);
  const greetingRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    if (!greetingOpen) return;
    const handler = (e) => {
      if (greetingRef.current && !greetingRef.current.contains(e.target)) setGreetingOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [greetingOpen]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = async () => {
    try {
      setLoadingList(true);
      const res = await fetchConversations({ search });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setConversations(data.conversations || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadConversations, search ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const openConversation = async (conv) => {
    try {
      setActiveId(conv._id);
      setActiveConv(conv);
      setMessages([]);
      setHasMore(true);
      setLoadingMessages(true);
      const res = await fetchConversationMessages(conv._id, { limit: 30 });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setActiveConv(data.conversation || conv);
      setMessages(data.messages || []);
      setHasMore((data.messages || []).length >= 30);
      scrollToBottom();

      await markConversationRead(conv._id);
      setConversations((prev) =>
        prev.map((c) => (c._id === conv._id ? { ...c, adminUnreadCount: 0 } : c)),
      );
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMore = async () => {
    if (!activeId || !messages.length || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const before = messages[0]._id;
      const res = await fetchConversationMessages(activeId, { before, limit: 30 });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      const older = data.messages || [];
      setHasMore(older.length >= 30);
      const container = scrollRef.current;
      const prevHeight = container?.scrollHeight || 0;
      setMessages((prev) => [...older, ...prev]);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevHeight;
        }
      });
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop < 60) loadMore();
  };

  const submitText = async (value) => {
    if (!value.trim() || !activeId || sending) return;
    try {
      setSending(true);
      const res = await sendTextMessage(activeId, value.trim());
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data],
      );
      scrollToBottom();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  const submitHtml = async (html) => {
    if (!activeId || sending) return;
    try {
      setSending(true);
      const res = await sendRichMessage(activeId, html);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data],
      );
      scrollToBottom();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  const submitImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId) return;
    try {
      setSending(true);
      const res = await sendImageMessage(activeId, file);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data],
      );
      scrollToBottom();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  const submitGreeting = async (lang) => {
    setGreetingOpen(false);
    if (!activeId || sendingGreeting) return;
    try {
      setSendingGreeting(true);
      const res = await sendGreeting(activeId, lang);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setMessages((prev) =>
        prev.some((m) => m._id === data._id) ? prev : [...prev, data],
      );
      scrollToBottom();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSendingGreeting(false);
    }
  };

  // Realtime: yangi xabar va suhbat ro'yxati yangilanishi.
  useEffect(() => {
    const onMessage = ({ conversationId, message }) => {
      if (conversationId === activeIdRef.current) {
        setMessages((prev) =>
          prev.some((m) => m._id === message._id) ? prev : [...prev, message],
        );
        scrollToBottom();
        if (message.sender?.kind !== "admin") {
          markConversationRead(conversationId).catch(() => {});
        }
      }
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev.map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessagePreview:
                  message.type === "image"
                    ? IMAGE_PREVIEW
                    : message.format === "html"
                      ? message.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                      : message.text,
                lastMessageAt: message.createdAt,
                adminUnreadCount:
                  conversationId === activeIdRef.current
                    ? c.adminUnreadCount
                    : (c.adminUnreadCount || 0) + (message.sender?.kind === "admin" ? 0 : 1),
              }
            : c,
        );
      });
    };

    const onConversationUpdated = ({ conversation: conv }) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conv._id);
        const next = exists
          ? prev.map((c) => (c._id === conv._id ? { ...c, ...conv } : c))
          : [conv, ...prev];
        return [...next].sort(
          (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0),
        );
      });
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:conversationUpdated", onConversationUpdated);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:conversationUpdated", onConversationUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedConversations = [...conversations]
    .filter((c) => kindFilter === "all" || c.participant?.kind === kindFilter)
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

  const { name: activeName, context: activeContext } = participantInfo(activeConv, t);

  return (
    <div className="flex w-full flex-1 min-h-0 gap-4">
      {/* Chap panel — suhbatlar ro'yxati. Mobilda (md dan past) faqat
          suhbat tanlanmaganda ko'rinadi — tanlangach o'ng panel to'liq
          ekranga chiqadi (list/detail patterni). */}
      <div
        className={`${activeId ? "hidden md:flex" : "flex"} flex-col w-full md:max-w-80 shrink-0 bg-white rounded-2xl border border-slate-200 overflow-hidden`}
      >
        <div className="p-3 border-b border-slate-100">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
          />
          <div className="flex items-center gap-1 mt-2 p-1 rounded-xl bg-slate-100">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setKindFilter(f.value)}
                className={`flex-1 h-8 rounded-lg text-xs font-medium cursor-pointer duration-150 ${
                  kindFilter === f.value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1">
          {loadingList ? (
            <div className="flex items-center justify-center py-10">
              <Loading />
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center py-10 px-4">
              <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                <HiOutlineChatBubbleLeftRight size={20} />
              </div>
              <p className="text-sm text-slate-400">{t("chat.emptyList")}</p>
            </div>
          ) : (
            sortedConversations.map((conv) => (
              <ConversationItem
                key={conv._id}
                conv={conv}
                active={conv._id === activeId}
                onClick={() => openConversation(conv)}
                t={t}
              />
            ))
          )}
        </div>
      </div>

      {/* O'ng panel — tanlangan suhbat. Mobilda faqat suhbat tanlanganda
          ko'rinadi (list/detail patterni), orqaga qaytish tugmasi header'da. */}
      <div
        className={`${!activeId ? "hidden md:flex" : "flex"} flex-col flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden`}
      >
        {!activeId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
              <HiOutlineChatBubbleLeftRight size={26} />
            </div>
            <p className="text-sm">{t("chat.selectConversation")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="md:hidden -ml-1 shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <HiArrowLeft size={18} />
              </button>
              <Avatar user={{ name: activeName }} size={36} />
              <div className="flex flex-col min-w-0 gap-0.5">
                <p className="text-sm font-semibold text-slate-800 truncate">{activeName}</p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <ParticipantBadge participant={activeConv?.participant} />
                  {activeContext && <span className="text-[11px] text-slate-500 truncate">{activeContext}</span>}
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5 bg-slate-50/60"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-10">
                  <Loading />
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg._id} msg={msg} t={t} />)
              )}
            </div>

            <div className="flex items-end gap-2 p-3 border-t border-slate-100 shrink-0 bg-white">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={submitImage}
              />
              <IconButton
                type="button"
                variant="outlined"
                color="slate"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                title={t("chat.attachImage")}
              >
                <HiPhoto size={18} />
              </IconButton>

              <div ref={greetingRef} className="relative shrink-0">
                <IconButton
                  type="button"
                  variant="outlined"
                  color="slate"
                  onClick={() => setGreetingOpen((v) => !v)}
                  disabled={sendingGreeting}
                  loading={sendingGreeting}
                  title={t("chat.greeting")}
                >
                  <HiOutlineLanguage size={18} />
                </IconButton>
                {greetingOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-44 bg-white rounded-xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)] border border-slate-100 py-1.5 z-10 overflow-hidden">
                    <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {t("chat.greetingChooseLang")}
                    </p>
                    {GREETING_LANGS.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => submitGreeting(lang.value)}
                        className="w-full text-left px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <RichComposer
                ref={composerRef}
                onSend={submitText}
                onSendHtml={submitHtml}
                disabled={sending}
                placeholder={t("chat.typeMessage")}
              />
              <IconButton
                type="button"
                color="blue"
                variant="filled"
                onClick={() => composerRef.current?.submit()}
                disabled={sending}
                loading={sending}
                title={t("chat.send")}
              >
                <HiPaperAirplane size={16} />
              </IconButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
