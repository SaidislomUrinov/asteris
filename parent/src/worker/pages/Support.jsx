import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiLifebuoy, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { ErrorState } from "../../components/States";
import { cn } from "../../utils/cn";
import { useWorker } from "../useWorker";
import { asErr } from "../utils";
import { isMineSender } from "../constants";
import { PageBack } from "../components/PageBack";
import { useSupportChat } from "../support/useSupportChat";
import { useViewportBox } from "../support/useViewportBox";
import { chatDayKey } from "../support/chatUtils";
import { ChatBubble } from "../support/ChatBubble";
import { ChatDayDivider } from "../support/ChatDayDivider";
import { ChatComposer } from "../support/ChatComposer";
import { ChatSkeleton } from "../support/ChatSkeleton";
import { ImageViewer } from "../support/ImageViewer";

const NEAR_BOTTOM = 80; // px — shundan yaqin bo'lsa yangi xabarda pastga suriladi
const NEAR_TOP = 80; // px — eski xabarlarni yuklash chegarasi

// Yordam chati — `/support` (API_CONTRACT_qr_card_send_and_worker_chat.md §B.2).
// To'liq ekran: tab bar yashirin (WorkerShell), konteyner `visualViewport`
// bo'yicha — Telegram klaviaturasi ochilganda yozish maydoni ko'rinib turadi.
export const Support = () => {
  const { t } = useTranslation();
  const { connected, chatUnread } = useWorker();
  const chat = useSupportChat();
  const { messages, loading, error, conversation, hasMore, loadingMore, loadMore, markRead } = chat;
  const box = useViewportBox();
  const [viewer, setViewer] = useState(null);

  const listRef = useRef(null);
  const stick = useRef(true);
  const prepend = useRef(null);
  const lastId = useRef(null);

  // Orqa sahifa skroll qilinmasin (iOS'da klaviatura sahifani surib yuboradi).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Xabarlar o'zgarganda: eski xabarlar qo'shilgan bo'lsa — joy saqlanadi;
  // yangi xabar (pastda) — pastga yaqin bo'lsak yoki o'zimiz yozgan bo'lsak suriladi.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prepend.current) {
      el.scrollTop = el.scrollHeight - prepend.current.height + prepend.current.top;
      prepend.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const isNew = last && String(last._id) !== lastId.current;
    lastId.current = last ? String(last._id) : null;
    if (stick.current || (isNew && isMineSender(last))) toBottom();
  }, [messages, loading, toBottom]);

  // Klaviatura ochilib-yopilganda oxirgi xabar ko'rinib tursin.
  useLayoutEffect(() => {
    if (stick.current) toBottom();
  }, [box.height, toBottom]);

  const onScroll = async () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    if (el.scrollTop < NEAR_TOP && hasMore && !loadingMore && !loading) {
      prepend.current = { height: el.scrollHeight, top: el.scrollTop };
      const added = await loadMore();
      if (!added) prepend.current = null;
    }
  };

  // Sahifa ochiq turganda kelgan javoblar darhol o'qilgan deb belgilanadi.
  const pendingRead = !loading && (chatUnread > 0 || (conversation?.clientUnreadCount || 0) > 0);
  useEffect(() => {
    if (!pendingRead) return undefined;
    const id = setTimeout(markRead, 300);
    return () => clearTimeout(id);
  }, [pendingRead, messages.length, markRead]);

  const closeViewer = useCallback(() => setViewer(null), []);

  let body;
  if (loading) body = <ChatSkeleton />;
  else if (error && !messages.length) body = <ErrorState error={asErr(error)} onRetry={() => chat.reload()} />;
  else if (!messages.length) {
    body = (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
        <span className="w-16 h-16 rounded-full bg-accent/10 text-accent grid place-items-center mb-1">
          <HiOutlineChatBubbleLeftRight className="w-8 h-8" />
        </span>
        <h2 className="text-[17px] font-extrabold text-ink leading-tight">{t("worker.support.emptyTitle")}</h2>
        <p className="text-[14px] leading-snug text-hint max-w-[260px]">{t("worker.support.emptyText")}</p>
      </div>
    );
  } else {
    body = messages.map((m, i) => {
      const day = chatDayKey(m.createdAt);
      const showDay = i === 0 || chatDayKey(messages[i - 1].createdAt) !== day;
      return (
        <Fragment key={m._id}>
          {showDay && <ChatDayDivider day={day} />}
          <ChatBubble message={m} onOpenImage={setViewer} />
        </Fragment>
      );
    });
  }

  // z-40: ilova yuqori paneli (Top, z-30) ustida — chat butun ekranni egallaydi;
  // rasm ko'rish oynasi (z-60) va sheet'lar (z-50) undan yuqorida qoladi.
  return (
    <div className="fixed inset-x-0 z-40 bg-bg" style={{ top: box.top, height: box.height }}>
      <div className="w-full max-w-lg h-full mx-auto flex flex-col">
        <header
          className="shrink-0 flex items-center gap-2 px-3 pb-2 border-b border-line/70 bg-card"
          style={{ paddingTop: box.keyboard ? "10px" : "calc(10px + env(safe-area-inset-top))" }}
        >
          <PageBack />
          <span className="w-9 h-9 rounded-full bg-accent/10 text-accent grid place-items-center shrink-0">
            <HiLifebuoy className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-extrabold text-ink leading-tight truncate">{t("worker.support.title")}</h1>
            <div className={cn("flex items-center gap-1.5 text-[11.5px] leading-tight truncate", connected ? "text-hint" : "text-warn")}>
              <i className={cn("w-1.5 h-1.5 rounded-full shrink-0", connected ? "bg-ok" : "bg-warn")} />
              <span className="truncate">{t(connected ? "worker.support.subtitle" : "worker.support.offline")}</span>
            </div>
          </div>
        </header>

        <div
          ref={listRef}
          onScroll={onScroll}
          onLoadCapture={() => stick.current && toBottom()}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 flex flex-col gap-1"
        >
          {loadingMore && <div className="self-center text-[12px] text-hint py-1">{t("worker.support.loadingOlder")}</div>}
          {body}
        </div>

        <ChatComposer sending={chat.sending} onSendText={chat.sendText} onSendImage={chat.sendImage} keyboard={box.keyboard} />
      </div>
      {viewer && <ImageViewer src={viewer} onClose={closeViewer} />}
    </div>
  );
};
