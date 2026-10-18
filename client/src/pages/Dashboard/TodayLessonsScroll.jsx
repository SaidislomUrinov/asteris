import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiClock, HiHome, HiUser } from "react-icons/hi2";
import { getTashkentNow } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import ShareChip from "../../ui/ShareChip";

const TICK_MS = 30000;
const CARD_WIDTH = 224; // w-56

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Har dars uchun holat + matn: joriy Tashkent vaqti bilan startTime/endTime
// solishtiriladi — tugagan (emerald), bo'layotgan (blue), hali boshlanmagan
// (orange).
const withStatus = (lesson, nowMin) => {
  const start = toMinutes(lesson.startTime);
  const end = toMinutes(lesson.endTime);
  if (nowMin < start) return { ...lesson, status: "upcoming", minutes: start - nowMin };
  if (nowMin <= end) return { ...lesson, status: "ongoing", minutes: nowMin - start };
  return { ...lesson, status: "finished", minutes: nowMin - end };
};

const STATUS_STYLE = {
  ongoing: { border: "border-l-blue-500", chip: "bg-blue-500 text-white", icon: "text-blue-500" },
  finished: { border: "border-l-emerald-400", chip: "bg-emerald-500 text-white", icon: "text-emerald-500" },
  upcoming: { border: "border-l-orange-400", chip: "bg-orange-500 text-white", icon: "text-orange-500" },
};

function LessonCard({ lesson, cardRef, onClick, t, navigate }) {
  const style = STATUS_STYLE[lesson.status];
  const isOngoing = lesson.status === "ongoing";

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(() => navigate(lesson.isIndividual ? `/individual/${lesson._id}` : `/groups/${lesson._id}`))}
      style={{ width: CARD_WIDTH }}
      className={`flex flex-col gap-2 p-3.5 shrink-0 select-none rounded-xl border border-l-4 bg-white dark:bg-night-900 cursor-pointer transition-shadow hover:shadow-md dark:hover:shadow-none ${style.border} ${
        isOngoing ? "border-slate-200 dark:border-night-700 ring-2 ring-blue-100 dark:ring-blue-500/30" : "border-slate-200 dark:border-night-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
          {(lesson.isIndividual && lesson.studentName) || lesson.subjectName}
        </span>
        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.chip}`}>
          {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-night-900 animate-pulse" />}
          {t(`dashboard.lessonStatus.${lesson.status}`)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <HiClock className={style.icon} />
        <span>
          {lesson.startTime}–{lesson.endTime}
        </span>
        {lesson.isIndividual && (
          <ShareChip individual className="ml-auto" title={`${t("individual.badgeTitle")} · ${lesson.subjectName}`} />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <HiUser className={style.icon} />
        <span className="truncate">{lesson.teacherName}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <HiHome className={style.icon} />
        <span className="truncate">{lesson.roomName}</span>
      </div>

      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-100 dark:border-night-700">
        {lesson.status === "ongoing" && t("dashboard.lessonElapsed", { count: lesson.minutes })}
        {lesson.status === "upcoming" && t("dashboard.lessonStartsIn", { count: lesson.minutes })}
        {lesson.status === "finished" && t("dashboard.lessonFinished")}
      </p>
    </div>
  );
}

function TodayLessonsScroll({ center }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const containerRef = useRef(null);
  const cardRefs = useRef({});
  // Kompyuterda ham sichqoncha bilan ushlab tortib scroll qilish uchun —
  // moved > threshold bo'lsa "drag" deb hisoblanadi va shu bosishda karta
  // ustidagi navigate() chaqirilmaydi (aks holda har tortishda guruh
  // sahifasiga o'tib ketaverardi).
  const dragRef = useRef({ down: false, startX: 0, startScrollLeft: 0, moved: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const fetchLessons = useCallback(async () => {
    // Skelet faqat birinchi yuklanishda — socket orqali qayta so'ralganda
    // darslar polosasi joyida qoladi (scroll holati ham yo'qolmaydi).
    try {
      const res = await api.get("/dashboard/today-lessons", { params: { center } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setLessons(data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [center]);

  useEffect(() => {
    const t = setTimeout(fetchLessons, 0);
    return () => clearTimeout(t);
  }, [fetchLessons]);

  // Jadval boshqa joydan (/schedule, xona detali) o'zgartirilsa — bugungi
  // darslar polosasi refresh'siz eskirib qolmasin deb qayta yuklanadi.
  useSocketEvent("group:changed", (payload) => {
    if (payload?.action === "telegram") return; // darslar polosasiga ta'sir qilmaydi
    fetchLessons();
  });

  // Vaqt statik emas — 30 soniyada bir marta holatlarni (tugadi/boshlandi)
  // qayta hisoblash va markazlashtirishni yangilash uchun tick.
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const nowMin = toMinutes(getTashkentNow().time);
  // Tabiiy vaqt tartibi (backend startTime bo'yicha o'sish tartibida
  // qaytaradi) saqlanadi — shunda bo'layotgan dars odatda kun ichida biror
  // joyda turadi va uni haqiqatan markazga scroll qilish mumkin (agar u
  // ro'yxat boshida bo'lsa, chapida joy yo'qligi sabab markazlashtirib
  // bo'lmas edi).
  const withStatuses = lessons.map((l) => withStatus(l, nowMin));

  const focusIndex = withStatuses.findIndex((l) => l.status === "ongoing");
  const centerIndex = focusIndex !== -1 ? focusIndex : withStatuses.findIndex((l) => l.status === "upcoming");

  // Diqqat markazidagi (bo'layotgan, yo'q bo'lsa keyingi) darsni strip
  // markaziga scroll qiladi — konteynerning o'zi emas, faqat shu bitta qator
  // ichida (butun sahifa scroll bo'lmaydi).
  useEffect(() => {
    if (centerIndex < 0) return;
    const container = containerRef.current;
    const card = cardRefs.current[centerIndex];
    if (!container || !card) return;
    // offsetLeft o'zining offsetParent'iga nisbatan hisoblanadi — bu
    // scroll konteynerining o'zi bilan mos kelmasligi mumkin (agar u
    // position:relative bo'lmasa). Shu sabab haqiqiy pozitsiyani
    // getBoundingClientRect orqali, konteynerga nisbatan hisoblaymiz.
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardLeftInContent = cardRect.left - containerRect.left + container.scrollLeft;
    const target = cardLeftInContent + card.clientWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [loading, lessons.length, centerIndex]);

  const handleMouseDown = (e) => {
    const container = containerRef.current;
    if (!container) return;
    dragRef.current = { down: true, startX: e.clientX, startScrollLeft: container.scrollLeft, moved: 0 };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    const drag = dragRef.current;
    if (!drag.down) return;
    const container = containerRef.current;
    if (!container) return;
    const delta = e.clientX - drag.startX;
    drag.moved = Math.max(drag.moved, Math.abs(delta));
    container.scrollLeft = drag.startScrollLeft - delta;
  };

  const endDrag = () => {
    dragRef.current.down = false;
    setIsDragging(false);
  };

  // Tortishdan keyingi "click" — bosish emas, tortish bo'lgani uchun
  // guruh sahifasiga o'tilmaydi (5px chegara — kichik titrash e'tiborsiz).
  const handleCardClick = (go) => {
    if (dragRef.current.moved > 5) return;
    go();
  };

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t("dashboard.todayLessons")}</p>
        <span className="text-xs text-slate-400 dark:text-slate-500">{getTashkentNow().time}</span>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden pb-1 animate-pulse" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{ width: CARD_WIDTH }}
              className="flex flex-col gap-2.5 p-3.5 shrink-0 rounded-xl border border-l-4 border-slate-200 dark:border-night-700"
            >
              <div className="h-4 w-3/4 rounded-md bg-slate-100 dark:bg-night-800" />
              <div className="h-3 w-1/2 rounded-md bg-slate-100 dark:bg-night-800" />
              <div className="h-3 w-2/3 rounded-md bg-slate-100 dark:bg-night-800" />
              <div className="h-3 w-1/3 rounded-md bg-slate-100 dark:bg-night-800" />
            </div>
          ))}
        </div>
      ) : withStatuses.length === 0 ? (
        <div className="flex items-center justify-center flex-1 min-h-32 text-slate-400 dark:text-slate-500 text-sm text-center px-4">
          {t("dashboard.noLessonsToday")}
        </div>
      ) : (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          className={`flex gap-3 overflow-x-auto select-none pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isDragging ? "cursor-grabbing scroll-auto" : "cursor-grab scroll-smooth"
          }`}
        >
          {withStatuses.map((lesson, i) => (
            <LessonCard
              key={lesson._id}
              lesson={lesson}
              cardRef={(el) => (cardRefs.current[i] = el)}
              onClick={handleCardClick}
              t={t}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TodayLessonsScroll;
