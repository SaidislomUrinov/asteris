import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiCheck, HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import Button from "../../ui/Button";
import NewsDialog from "./NewsDialog";
import useNewsSync from "../../hooks/useNewsSync";
import useClosingValue from "../../hooks/useClosingValue";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useIsBlockingModalOpen } from "../../utils/blockingModal";
import { isAnyDialogOpen } from "../../utils/dialogState";
import { markAllNewsRead, markNewsRead } from "../../contexts/news";

// Ilova ochilgandan (yoki birinchi jonli yangilik kelgandan) keyin kutish.
const OPEN_DELAY_MS = 3000;
// Boshqa (oddiy) Dialog ochiq bo'lsa — yopilishini shu oraliqda tekshiramiz.
const RETRY_MS = 1000;
// Nuqtalar shundan ko'p bo'lsa sig'maydi — faqat "3 / 14" hisoblagich qoladi.
const MAX_DOTS = 12;

/**
 * O'qilmagan yangiliklar oynasi (API_CONTRACT_news.md §5 "Popup").
 * App.jsx'da autentifikatsiyadan keyingi layout ichida BIR marta mount
 * qilinadi — login sahifasida umuman render bo'lmaydi. Store sinxronini
 * (`useNewsSync`) ham shu komponent yuritadi.
 *
 * Sessiya modeli: oyna ochilganda navbat "sessiya" ro'yxatiga olinadi.
 * O'qilgan slaydlar oyna yopilguncha sessiyada qoladi — "Oldingi" bilan
 * ularga qaytish mumkin; jonli kelganlar sessiya oxiriga qo'shiladi.
 */
function NewsPopup() {
  useNewsSync();

  const { t } = useTranslation();
  const dp = useDispatch();
  const { pathname } = useLocation();
  const queue = useSelector((e) => e.news.queue);
  const items = useSelector((e) => e.news.items);
  const blocked = useIsBlockingModalOpen();

  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false); // 3s o'tdi, ochishga tayyor
  const [session, setSession] = useState([]); // oyna ochilgandagi (va keyin qo'shilgan) id'lar
  const [index, setIndex] = useState(0);
  // Ichki resursga o'tib yopilganda qolgan o'qilmaganlar shu sahifa
  // sessiyasida qayta avtomatik ochilmaydi (qo'ng'iroq/tabda turaveradi).
  const [snoozed, setSnoozed] = useState([]);

  const snoozedSet = new Set(snoozed);
  const pending = queue.filter((id) => !snoozedSet.has(id));

  // Ochiq oynaning ro'yxati: sessiya + navbatga keyin qo'shilganlar (oxiriga).
  // Effekt bilan state'ga ko'chirilmaydi — hosila qiymat; har bir foydalanuvchi
  // amalida (commit) state'ga yoziladi, shunda o'qilib navbatdan chiqqan
  // slayd ro'yxatdan yo'qolmaydi.
  const sessionSet = new Set(session);
  const list = open
    ? [...session, ...pending.filter((id) => !sessionSet.has(id))].filter((id) => items[id])
    : [];
  const idx = Math.min(index, Math.max(0, list.length - 1));
  const currentId = list[idx];
  const visible = open && list.length > 0;
  const current = visible ? items[currentId] : null;
  const view = useClosingValue(current);
  const queueSet = new Set(queue);
  const isUnread = (id) => queueSet.has(id);
  const unreadInList = list.filter(isUnread);

  // ── 3 soniyalik taymer ────────────────────────────────────────────────
  // Taymer navbat o'zgarganda QAYTA boshlanmaydi (§5.4: birinchi kelgandan 3s).
  const timerRef = useRef(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  });

  const pendingCount = pending.length;
  useEffect(() => {
    if (open || ready || pendingCount === 0 || timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Kutish davomida boshqa tabda o'qib bo'lingan bo'lsa — ochmaymiz.
      if (pendingRef.current.length > 0) setReady(true);
    }, OPEN_DELAY_MS);
  }, [open, ready, pendingCount]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      // StrictMode soxta unmount'idan keyin taymer qayta qo'yilishi uchun.
      timerRef.current = null;
    },
    [],
  );

  // ── Ochish: tayyor + majburiy modal yo'q + boshqa Dialog ochiq emas ──────
  useEffect(() => {
    if (!ready || open || blocked || pathname === "/login") return;
    let interval = null;
    const tryOpen = () => {
      if (isAnyDialogOpen()) return false;
      const ids = pendingRef.current;
      if (ids.length) {
        setSession(ids);
        setIndex(0);
        setOpen(true);
      }
      setReady(false);
      return true;
    };
    const first = setTimeout(() => {
      if (tryOpen()) return;
      interval = setInterval(() => {
        if (tryOpen()) clearInterval(interval);
      }, RETRY_MS);
    }, 0);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [ready, open, blocked, pathname]);

  // ── Amallar ───────────────────────────────────────────────────────────
  const close = () => {
    setOpen(false);
    setSession([]);
    setIndex(0);
  };

  const readCurrent = () => {
    if (currentId && isUnread(currentId)) dp(markNewsRead(currentId, true));
  };

  // Joriydan keyingi (keyin boshidan) birinchi o'qilmagan slayd; yo'q bo'lsa -1.
  const nextUnreadIndex = () => {
    for (let step = 1; step < list.length; step += 1) {
      const j = (idx + step) % list.length;
      if (isUnread(list[j])) return j;
    }
    return -1;
  };

  // X / ESC / tashqariga bosish: joriy o'qildi → keyingi o'qilmagan; qolmasa yopiladi.
  const goNextUnread = () => {
    const j = nextUnreadIndex();
    if (j === -1) return close();
    setSession(list);
    setIndex(j);
  };

  const dismiss = () => {
    if (!visible) return;
    readCurrent();
    goNextUnread();
  };

  // "Keyingi": joriy o'qildi → ketma-ket keyingi slayd (o'qilgan bo'lsa ham);
  // oxirgisida — qolgan o'qilmaganga, u ham bo'lmasa yopiladi.
  const next = () => {
    readCurrent();
    if (idx < list.length - 1) {
      setSession(list);
      setIndex(idx + 1);
      return;
    }
    goNextUnread();
  };

  const prev = () => {
    if (idx === 0) return;
    setSession(list);
    setIndex(idx - 1);
  };

  const readAll = () => {
    dp(markAllNewsRead());
    close();
  };

  // Ichki resurs: joriy o'qildi, oyna yopiladi, qolganlar "kechiktiriladi".
  const onInternalNavigate = () => {
    readCurrent();
    const rest = list.filter((id) => id !== currentId && isUnread(id));
    if (rest.length) setSnoozed((s) => [...s, ...rest]);
    close();
  };

  // Boshqa tab/qurilmada o'qilgan yoki admin o'chirgan yangilik sessiyadan
  // olib tashlanadi. Joriy slayd esa ko'z oldidan sakrab yo'qolmaydi —
  // o'qilgan sifatida qoladi (o'chirilgan bo'lsa `items`dan yo'qoladi va
  // ro'yxat o'zi yangilanadi).
  const dropFromSession = (id) => {
    if (!open || !id || id === currentId) return;
    const rest = list.filter((x) => x !== id);
    const pos = list.indexOf(id);
    if (pos === -1) return;
    if (!rest.length) return close();
    setSession(rest);
    if (pos < idx) setIndex(idx - 1);
  };

  useSocketEvent("news:read", (p) => {
    if (!open) return;
    // "Barchasini o'qildi" boshqa joyda bosildi — oyna vazifasini bajardi.
    if (p?.all) return close();
    // Shu oynada o'qilganlarning aks-sadosi ham keladi — ular sessiyada qoladi.
    if (p?.id && isUnread(p.id)) dropFromSession(p.id);
  });
  useSocketEvent("news:removed", (p) => {
    if (!open || !p?.id) return;
    if (p.id === currentId) {
      const rest = list.filter((x) => x !== p.id);
      if (!rest.length) return close();
      setSession(rest);
      setIndex(Math.min(idx, rest.length - 1));
      return;
    }
    dropFromSession(p.id);
  });

  // Hamma slayd yo'qolgan bo'lsa (masalan admin o'chirdi) oyna yopiq holatga
  // qaytadi — keyingi jonli yangilik yana 3s kutib ochiladi.
  const orphaned = open && list.length === 0;
  useEffect(() => {
    if (!orphaned) return;
    const id = setTimeout(() => {
      setOpen(false);
      setSession([]);
      setIndex(0);
    }, 0);
    return () => clearTimeout(id);
  }, [orphaned]);

  const total = list.length;
  const isLast = idx >= total - 1;
  const noMoreUnread = unreadInList.filter((id) => id !== currentId).length === 0;

  const footer =
    view && total > 0 ? (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 min-w-0">
            {total > 1 && total <= MAX_DOTS && (
              <div className="hidden sm:flex items-center gap-1" aria-hidden="true">
                {list.map((id, i) => (
                  <span
                    key={id}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      i === idx
                        ? "w-5 bg-blue-500"
                        : isUnread(id)
                          ? "w-1.5 bg-slate-300"
                          : "w-1.5 bg-blue-200"
                    }`}
                  />
                ))}
              </div>
            )}
            {total > 1 && (
              <span className="text-[13px] font-semibold text-slate-500 tabular-nums">
                {idx + 1} / {total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {total > 1 && (
              <Button
                color="slate"
                variant="outlined"
                onClick={prev}
                disabled={idx === 0}
                aria-label={t("news.prev")}
                className="!px-3"
              >
                <HiChevronLeft className="text-base" />
                <span className="max-sm:sr-only">{t("news.prev")}</span>
              </Button>
            )}
            <Button color="blue" onClick={next}>
              {isLast && noMoreUnread ? t("news.gotIt") : t("common.next")}
              {!(isLast && noMoreUnread) && <HiChevronRight className="text-base" />}
            </Button>
          </div>
        </div>

        {unreadInList.length >= 2 && (
          <div className="flex justify-center">
            <Button color="slate" variant="text" onClick={readAll} className="gap-1.5 text-xs">
              <HiCheck />
              {t("news.markAllRead")}
            </Button>
          </div>
        )}
      </div>
    ) : null;

  if (!view) return null;

  return (
    <NewsDialog
      open={visible}
      news={view}
      onClose={dismiss}
      footer={footer}
      onInternalNavigate={onInternalNavigate}
    />
  );
}

export default NewsPopup;
