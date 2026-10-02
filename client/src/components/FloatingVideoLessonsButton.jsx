import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { HiPlayCircle } from "react-icons/hi2";
import VideoLessonsModal from "./VideoLessonsModal";
import useMediaQuery from "../hooks/useMediaQuery";
import useTutorialVideo from "../hooks/useTutorialVideo";
import { resolveSectionKey, resolveSectionTitleKey } from "../utils/navSections";

const STORAGE_KEY = "wenet:videoButtonPos"; // { side, bottomPct } — bottomPct 0..1, viewportga nisbatan
const BTN_SIZE = 52; // px — collapsed holatdagi doiraviy tugma o'lchami
const EDGE_GAP = 10; // chekkadan doimiy masofa — tugma HAR DOIM shu masofada "qadalib" turadi
const DRAG_THRESHOLD = 6; // px — click/drag ajratish chegarasi
// Mobilda pastki tab-bar (`MobileTabBar.jsx`, h-16=64px + safe-area) tugmani
// yashirib/bosib qo'ymasligi uchun pastdan qo'shimcha bo'sh joy.
const TABBAR_CLEARANCE = 64;
// Tailwind `lg` — shu kenglikdan pastda mobil tab-bar ko'rinadi.
const MOBILE_QUERY = "(max-width: 1023px)";

// `ChatWidget.jsx` o'ng-past burchakda qat'iy joylashgan. Desktopda
// right:16px/bottom:16px, o'lcham 56px. Mobilda esa tab-bar ostida
// qolmasligi uchun pastroq: bottom:calc(4.5rem + safe-area) — shuning
// uchun bu tugma HECH QACHON o'sha zonaning ustiga tushmasligi uchun
// chegara ham mobil/desktop uchun ALOHIDA hisoblanadi (avval faqat
// desktop qiymati bilan hisoblanardi — mobilda ikkisi ustma-ust tushardi).
const CHAT_WIDGET_GAP = 16; // desktopdagi chat bottom
const CHAT_WIDGET_MOBILE_GAP = EDGE_GAP + TABBAR_CLEARANCE; // mobildagi chat bottom bazasi (~4.5rem) bilan mos
const CHAT_WIDGET_SIZE = 56;
const CHAT_WIDGET_CLEARANCE = 12; // chat tugmasi bilan orasidagi qo'shimcha bo'shliq

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const bottomGap = (isMobile, side) => {
  const base = EDGE_GAP + (isMobile ? TABBAR_CLEARANCE : 0);
  // Chap chekkada chat tugmasi bilan to'qnashuv xavfi yo'q.
  if (side !== "right") return base;
  const chatGap = isMobile ? CHAT_WIDGET_MOBILE_GAP : CHAT_WIDGET_GAP;
  const chatTop = chatGap + CHAT_WIDGET_SIZE + CHAT_WIDGET_CLEARANCE;
  return Math.max(base, chatTop);
};
const clampBottom = (bottom, isMobile, side) =>
  clamp(bottom, bottomGap(isMobile, side), window.innerHeight - BTN_SIZE - EDGE_GAP);
// Faol surish paytida (side hali noma'lum, erkin harakat) chat zonasi
// cheklovisiz — faqat tugma dam olishga "qadalganda" (pointer up/resize/
// boshlang'ich) chat bilan to'qnashuv oldini olish qo'llaniladi.
const clampBottomFree = (bottom, isMobile) =>
  clamp(bottom, EDGE_GAP + (isMobile ? TABBAR_CLEARANCE : 0), window.innerHeight - BTN_SIZE - EDGE_GAP);

const defaultPos = (isMobile) => ({ side: "right", bottom: bottomGap(isMobile, "right") });

// Tugma HAR DOIM biror chekkaga "qadalgan" holda dam oladi (suriladigan payt
// bundan mustasno) — shuning uchun gorizontal masofa alohida saqlanmaydi,
// doim EDGE_GAP. Faqat qaysi chekka (`side`) va pastdan masofa saqlanadi.
const readStoredPos = (isMobile) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPos(isMobile);
    const parsed = JSON.parse(raw);
    // Eski format ({ rightPct, bottomPct }) — chapga qadash funksiyasi
    // qo'shilishidan oldingi versiya. O'ng chekka sifatida talqin qilinadi.
    const side = parsed.side === "left" ? "left" : "right";
    const bottomPct = typeof parsed.bottomPct === "number" ? parsed.bottomPct : null;
    if (bottomPct === null) return defaultPos(isMobile);
    return { side, bottom: clampBottom(bottomPct * window.innerHeight, isMobile, side) };
  } catch {
    return defaultPos(isMobile);
  }
};

const savePos = ({ side, bottom }) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ side, bottomPct: bottom / window.innerHeight }),
    );
  } catch {
    // localStorage yo'q/bloklangan — jim
  }
};

/**
 * Ekranning istalgan joyiga suriladigan, bosilganda video darslik modalini
 * ochadigan doiraviy tugma (docs/API_CONTRACT_floating_video_lessons.md § 3.2).
 * Qo'yib yuborilganda ekranning qaysi tarafiga (chap/o'ng) yaqin bo'lsa,
 * o'sha chekkaga "qadalib" qoladi — suriw paytida esa erkin kuzatib boradi.
 * `data-intro="video-lessons"` — Introduction Engine shu orqali topadi.
 */
function FloatingVideoLessonsButton() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const canHover = useMediaQuery("(hover: hover)");
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Saqlangan pozitsiya lazy initializer orqali o'qiladi — mount effektida
  // setState chaqirmaslik uchun (react-hooks/set-state-in-effect).
  const [pos, setPos] = useState(() => readStoredPos(isMobile));
  // Faqat surish paytida ishlatiladi — erkin (chekkaga bog'lanmagan) ekran
  // koordinatasi. Qo'yib yuborilganda `pos`ga (side+bottom) aylantiriladi.
  const [dragPos, setDragPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const dragState = useRef({ startX: 0, startY: 0, originLeft: 0, originBottom: 0, moved: false });

  // Viewport o'zgarganda (resize, desktop<->mobil) tugma pastki tab-bar
  // ostida yoki ekrandan tashqarida qolib ketmasin.
  useEffect(() => {
    const onResize = () => setPos((p) => ({ ...p, bottom: clampBottom(p.bottom, isMobile, p.side) }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile]);

  const sectionKey = resolveSectionKey(pathname);
  const titleKey = resolveSectionTitleKey(pathname);
  const label = titleKey ? t(titleKey) : "";
  const videoUrl = useTutorialVideo(sectionKey);

  const expanded = canHover && hovering;

  const handlePointerDown = (e) => {
    // Tugma dam olayotganda doim EDGE_GAP masofada turadi — surishni shu
    // haqiqiy ekran koordinatasidan boshlaymiz (chap yoki o'ng chekkadan).
    const originLeft =
      pos.side === "left" ? EDGE_GAP : window.innerWidth - EDGE_GAP - BTN_SIZE;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft,
      originBottom: pos.bottom,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (e.buttons === 0 && !dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    if (!dragState.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragState.current.moved = true;
      setDragging(true);
    }

    if (dragState.current.moved) {
      const left = clamp(
        dragState.current.originLeft + dx,
        EDGE_GAP,
        window.innerWidth - BTN_SIZE - EDGE_GAP,
      );
      const bottom = clampBottomFree(dragState.current.originBottom - dy, isMobile);
      setDragPos({ left, bottom });
    }
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (dragState.current.moved && dragPos) {
      // Tugma markazi ekran o'rtasidan qaysi tomonda qolgan bo'lsa, o'sha
      // chekkaga qadaladi — o'rtaga tashlab yuborilsa ham "muallaq" qolmaydi.
      const center = dragPos.left + BTN_SIZE / 2;
      const side = center < window.innerWidth / 2 ? "left" : "right";
      // O'ng chekkaga qadalganda chat tugmasi zonasidan tepada qolishi shart —
      // shu paytgacha erkin suringan bottom endi shu chegaraga qayta siqiladi.
      const next = { side, bottom: clampBottom(dragPos.bottom, isMobile, side) };
      setPos(next);
      savePos(next);
    } else {
      // Bosish — na dragging, na hover kutish shart, modal to'g'ridan-to'g'ri ochiladi.
      setModalOpen(true);
    }
    setDragging(false);
    setDragPos(null);
    dragState.current.moved = false;
  };

  // Shu sahifa uchun darslik biriktirilmagan bo'lsa tugma UMUMAN
  // ko'rsatilmaydi. Avval u har doim turar, bosilganda esa bo'sh modal
  // ("tez orada") ochilardi — foydalanuvchi uchun bu shunchaki ishlamaydigan
  // tugma edi. Barcha hook'lar yuqorida chaqirilgani uchun bu erta qaytish
  // hooklar tartibini buzmaydi.
  if (!videoUrl) return null;

  const showLabel = expanded && !dragging;
  // Dam olayotganda (surilmayotganda) tugma HAR DOIM o'z chekkasiga qadalgan
  // — hover kutilayotgan paytda shu chekka tomon qisman ekrandan chiqib
  // turadi, hover/kengayishda to'liq ko'rinadi.
  const peeking = canHover && !expanded && !dragging;

  const style =
    dragging && dragPos
      ? { left: dragPos.left, bottom: dragPos.bottom }
      : pos.side === "left"
        ? { left: EDGE_GAP, bottom: pos.bottom }
        : { right: EDGE_GAP, bottom: pos.bottom };

  return (
    <>
      {/*
        MUHIM: peek translate/opacity ICHKI div'ga qo'yiladi, tashqi <button>
        (pointer hodisalari shu yerda ushlanadi) hech qachon translate
        olmaydi. Aks holda: hover → translate 0'ga qaytadi → butun hitbox
        kursordan chetga suriladi → pointerleave → qayta peek → kursor яна
        ustida → pointerenter → cheksiz tebranish (aynan shu bug bo'lgan).
        Tashqi box translate qilinmagani uchun kontent kengaysa ham (label
        chiqsa) tugma qadalgan chekkadan UZOQLASHIB o'sadi, kursor tagidagi
        joy hech qachon "qochib" ketmaydi.
      */}
      <button
        type="button"
        data-intro="video-lessons"
        title={label ? `${label} — ${t("common.videoLessons")}` : t("common.videoLessons")}
        style={style}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        className="fixed z-[25] h-13 min-w-13 cursor-pointer touch-none select-none"
      >
        {/* Bu tugma hech qachon sahifaning ASOSIY amali emas — shuning uchun
            dam olayotganda sokin (oq fon, nozik chegara, ko'k ikonka) va
            faqat hover/bosilganda ko'k bo'lib "javob beradi". Avval u
            binafsha to'ldirilgan CTA edi: ilova palitrasidan tashqarida
            (ko'k/slate) va har sahifada ko'zni birinchi bo'lib o'ziga
            tortardi. */}
        <div
          className={`flex items-center h-13 min-w-13 px-3.5 gap-2 rounded-full border shadow-[0_4px_16px_-4px_rgba(15,23,42,0.18)] ${
            dragging ? "" : "transition-all duration-300 ease-out"
          } ${
            expanded || dragging
              ? "bg-blue-500 border-blue-500 text-white"
              : "bg-white border-slate-200 text-blue-500"
          } ${
            peeking
              ? pos.side === "left"
                ? "opacity-70 -translate-x-[42%]"
                : "opacity-70 translate-x-[42%]"
              : "opacity-100 translate-x-0"
          }`}
        >
          <HiPlayCircle className="text-2xl shrink-0" />
          {showLabel && (
            <span className="text-xs font-semibold uppercase whitespace-nowrap pr-0.5">
              {t("common.videoLessons")}
            </span>
          )}
        </div>
      </button>

      <VideoLessonsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sectionKey={sectionKey}
        label={label}
      />
    </>
  );
}

export default FloatingVideoLessonsButton;
