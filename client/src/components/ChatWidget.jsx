import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChatBubbleLeftRight, HiLifebuoy, HiPaperAirplane, HiPhoto, HiXMark } from "react-icons/hi2";
import { toast } from "sonner";
import { API } from "../utils/fetching";
import Avatar from "../ui/Avatar";
import IconButton from "../ui/IconButton";
import Loading from "../ui/Loading";

// Qo'llab-quvvatlash chati — panel. Ochish tugmasi yo'q: Top'dagi Yordam
// menyusi (`HelpMenu`) ochadi va `useChat` holatini (o'qilmaganlar soni
// "?" belgisida ko'rinishi uchun) o'zida saqlab shu yerga uzatadi.
// Desktopda header ostida o'ng tomonda, mobilda to'liq ekran.
function ChatWidget({ open, onClose, chat }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const {
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
  } = chat;

  // Chat ochilganda o'qilgan deb belgilanadi.
  useEffect(() => {
    if (open && unreadCount > 0) markRead();
  }, [open, unreadCount, markRead]);

  // Yangi xabar kelganda pastga scroll qilinadi.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const value = text;
    setText("");
    const res = await sendText(value);
    if (!res) {
      setText(value);
      toast.error(t("chat.sendError"));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const res = await sendImage(file);
    if (!res) toast.error(t("chat.sendError"));
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 40) loadMore();
  };

  if (!open) return null;

  return (
    <div className="fixed z-[25] isolate right-4 top-17">
      {open && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-night-900 flex flex-col sm:static sm:inset-auto sm:z-auto sm:w-[min(92vw,380px)] sm:h-[min(72vh,540px)] sm:rounded-2xl sm:shadow-[0_24px_60px_-12px_rgba(15,23,42,0.25)] dark:sm:shadow-none sm:border sm:border-slate-100 dark:sm:border-night-700 overflow-hidden">
          {/* Sarlavha — mobilda to'liq ekran, shuning uchun notch/status-bar
              ostida qolmasligi uchun xavfsiz zona bilan. */}
          <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3.5 border-b border-slate-100 dark:border-night-700 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0 w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <HiLifebuoy size={18} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t("chat.title")}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{t("chat.subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-full bg-slate-50 dark:bg-night-800 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-night-800 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95 duration-200"
            >
              <HiXMark size={17} />
            </button>
          </div>

          {/* Xabarlar */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5 bg-slate-50/60 dark:bg-night-800/60"
          >
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <Loading />
              </div>
            )}
            {!loading && loadingMore && (
              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-1">{t("common.loading")}</div>
            )}
            {!loading && messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-500 flex items-center justify-center">
                  <HiChatBubbleLeftRight size={20} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">{t("chat.empty")}</p>
              </div>
            )}
            {!loading &&
              messages.map((m) => <ChatBubble key={m._id} message={m} />)}
          </div>

          {/* Yozish paneli — mobilda pastki xavfsiz zona (home indicator). */}
          <div className="flex items-end gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-night-700 shrink-0 bg-white dark:bg-night-900">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            <IconButton
              type="button"
              variant="outlined"
              color="slate"
              onClick={() => fileRef.current?.click()}
              title={t("chat.attachImage")}
            >
              <HiPhoto size={18} />
            </IconButton>
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              className="flex-1 resize-none max-h-24 min-h-11 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:bg-white dark:focus:bg-night-900 duration-150"
            />
            <IconButton
              type="button"
              color="blue"
              disabled={!text.trim() || sending}
              loading={sending}
              onClick={handleSend}
              title={t("chat.send")}
            >
              <HiPaperAirplane size={16} />
            </IconButton>
          </div>
        </div>
      )}

    </div>
  );
}

// Bir xabar — o'z (client/staff), admin va tizim (avto-javob) xabarlarini
// vizual ajratadi.
function ChatBubble({ message }) {
  const { t } = useTranslation();
  // `system` (avto-javob) ataylab "admin" bilan bir xil ko'rinishda —
  // go'yo admin tarafdan kelganday (maxsus pill emas).
  const isMine = message.sender?.kind === "client" || message.sender?.kind === "staff";

  return (
    <div className={`flex items-end gap-2 max-w-[85%] ${isMine ? "self-end flex-row-reverse" : "self-start"}`}>
      {!isMine && (
        <Avatar user={{ name: message.sender?.name || t("chat.admin") }} size={22} className="mb-0.5" />
      )}
      <div className="flex flex-col min-w-0">
        {!isMine && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1 mb-0.5">{message.sender?.name || t("chat.admin")}</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
            isMine
              ? "bg-blue-500 text-white rounded-br-md"
              : "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-slate-800 dark:text-slate-100 rounded-bl-md"
          }`}
        >
          {message.type === "image" ? (
            <img
              src={message.imageUrl?.startsWith("http") ? message.imageUrl : `${API}${message.imageUrl}`}
              alt=""
              className="max-w-full max-h-48 rounded-lg -mx-0.5 -my-0.5"
            />
          ) : message.format === "html" ? (
            <div
              className={`[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_a]:underline [&_p]:m-0 ${
                isMine ? "[&_blockquote]:border-white/40" : "[&_blockquote]:border-slate-300 [&_a]:text-blue-600"
              }`}
              dangerouslySetInnerHTML={{ __html: message.text }}
            />
          ) : (
            message.text
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatWidget;
