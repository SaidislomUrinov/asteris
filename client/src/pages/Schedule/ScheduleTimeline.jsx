import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencilSquare, HiTrash } from "react-icons/hi2";
import {
  DAY_RANGE_FROM,
  DAY_RANGE_TO,
  DAYS,
  SNAP,
  shiftDays,
  toHHMM,
  toMinutes,
} from "../../utils/schedule";

export const RANGE_FROM = DAY_RANGE_FROM;
export const RANGE_TO = DAY_RANGE_TO;
export { SNAP };

const HOUR_PX = 60;
const PX_PER_MIN = HOUR_PX / 60;
const DRAG_THRESHOLD = 4; // px — bundan kichik siljish "bosish" hisoblanadi

// Guruh rangi — joylashuv tartibida barqaror beriladi, shuning uchun bitta
// guruh timeline'da doim bir xil rangda ko'rinadi.
// eslint-disable-next-line react-refresh/only-export-components
export const BLOCK_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-200", bar: "bg-blue-500", text: "text-blue-950", sub: "text-blue-700/75" },
  { bg: "bg-violet-50", border: "border-violet-200", bar: "bg-violet-500", text: "text-violet-950", sub: "text-violet-700/75" },
  { bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", text: "text-emerald-950", sub: "text-emerald-700/75" },
  { bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", text: "text-amber-950", sub: "text-amber-700/75" },
  { bg: "bg-rose-50", border: "border-rose-200", bar: "bg-rose-500", text: "text-rose-950", sub: "text-rose-700/75" },
  { bg: "bg-cyan-50", border: "border-cyan-200", bar: "bg-cyan-500", text: "text-cyan-950", sub: "text-cyan-700/75" },
  { bg: "bg-indigo-50", border: "border-indigo-200", bar: "bg-indigo-500", text: "text-indigo-950", sub: "text-indigo-700/75" },
  { bg: "bg-teal-50", border: "border-teal-200", bar: "bg-teal-500", text: "text-teal-950", sub: "text-teal-700/75" },
];

// O'quv markazlarida darslar odatda "toq" (Du·Cho·Ju) yoki "juft"
// (Se·Pa·Sha) kunlarda o'tadi — bosilgan kun shu naqshni belgilaydi.
const ODD = ["mon", "wed", "fri"];
const EVEN = ["tue", "thu", "sat"];

/**
 * Blok cho'zilgandan keyingi yakuniy joylashuv.
 *
 * Cho'zilayotgan dars boshqa darslarga tegib ketsa — ular **davomiyligini
 * saqlagan holda** siljiydi (pastga cho'zilsa pastdagilar pastroqqa, tepaga
 * cho'zilsa tepadagilar yuqoriroqqa) va bu zanjir bo'ylab tarqaladi.
 *
 * Sweep: darslar yo'nalish bo'yicha tartiblanadi va har kun uchun "oxirgi band
 * chegara" yuritiladi — chegaradan oldin qolgan dars o'sha chegaraga suriladi.
 * Kesishmagan darslar joyida qoladi (chegara ulardan orqada bo'ladi).
 *
 * @returns {{ map: Map<string, {start:number,end:number}>, valid: boolean }}
 */
const layoutAfterResize = (blocks, id, newStart, newEnd, dir) => {
  const items = blocks.map((b) => {
    const start = b.id === id ? newStart : toMinutes(b.startTime);
    const end = b.id === id ? newEnd : toMinutes(b.endTime);
    return { id: b.id, days: b.days, start, end, span: end - start };
  });

  const map = new Map();
  let valid = newEnd - newStart >= SNAP && newStart >= RANGE_FROM && newEnd <= RANGE_TO;

  if (dir === "down") {
    items.sort((a, b) => a.start - b.start);
    const lastEnd = {};
    for (const it of items) {
      let s = it.start;
      if (it.id !== id) {
        const floor = Math.max(...it.days.map((d) => lastEnd[d] ?? -Infinity));
        if (floor > s) s = floor;
      }
      const e = s + it.span;
      if (e > RANGE_TO) valid = false;
      map.set(it.id, { start: s, end: e });
      for (const d of it.days) lastEnd[d] = Math.max(lastEnd[d] ?? -Infinity, e);
    }
  } else {
    items.sort((a, b) => b.end - a.end);
    const firstStart = {};
    for (const it of items) {
      let e = it.end;
      if (it.id !== id) {
        const ceil = Math.min(...it.days.map((d) => firstStart[d] ?? Infinity));
        if (ceil < e) e = ceil;
      }
      const s = e - it.span;
      if (s < RANGE_FROM) valid = false;
      map.set(it.id, { start: s, end: e });
      for (const d of it.days) firstStart[d] = Math.min(firstStart[d] ?? Infinity, s);
    }
  }

  return { map, valid };
};

const autoDays = (day) => {
  if (ODD.includes(day)) return ODD;
  if (EVEN.includes(day)) return EVEN;
  return ["sun"];
};

/**
 * Haftalik timeline — Google Calendar week view uslubida, lekin xona bandligi
 * uchun. Kunlar gorizontal, soatlar vertikal, blok balandligi davomiylikka teng.
 *
 * Kunlar OLDINDAN tanlanmaydi: bo'sh joyga bosilsa dars shu vaqtga tushadi va
 * kunlar avto naqsh (Du·Cho·Ju / Se·Pa·Sha) bo'yicha to'ldiriladi. `overrideDays`
 * berilgan bo'lsa — aynan o'sha kunlar ishlatiladi (to'liq haftalik guruhlar uchun).
 *
 * Joylashtirilgan bloklarni sichqoncha bilan surish mumkin: vertikal siljish
 * vaqtni, gorizontal siljish esa butun kun naqshini bir xil qadamga suradi.
 * Blok chapdagi XONA kartasiga sudralib tashlansa — dars o'sha xonaga ko'chadi.
 *
 * Blokka bosilganda modal ochilmaydi: blok ustida hover bo'lganda o'zida
 * "tahrirlash" va "slotdan olish" ikonlari chiqadi. Faqat almashtirish
 * rejimida (chapdan guruh tanlangan) blokka bosish = almashtirish.
 *
 * @param {Object} props
 * @param {Array} props.blocks - [{ id, label, teacher, days[], startTime, endTime, colorIndex }]
 * @param {number} props.duration - joylashtiriladigan dars davomiyligi (daqiqa)
 * @param {string[]} props.overrideDays - qo'lda tanlangan kunlar ([] = avto)
 * @param {boolean} props.canPlace - xona va guruh tanlanganmi
 * @param {boolean} props.readOnly - faqat ko'rish (mobil): bosish/surish yo'q
 * @param {boolean} props.carrying - chapdan guruh sudralib kelinmoqda (mouseup = qo'yish)
 * @param {boolean} props.swapMode - guruh tanlangan: blokka bosish = almashtirish
 * @param {(days: string[], startMin: number) => void} props.onPlace
 * @param {(block: Object, days: string[], startMin: number) => void} props.onMove
 * @param {(block: Object, day: string) => void} props.onBlockClick - faqat swapMode'da
 * @param {(block: Object, day: string) => void} props.onBlockEdit
 * @param {(block: Object, day: string) => void} props.onBlockDelete
 * @param {(block: Object, roomId: string) => void} props.onBlockRoomChange
 * @param {(info: {label, span, x, y} | null) => void} props.onDraggingChange
 * @param {(roomId: string) => void} props.onRoomHover
 */
function ScheduleTimeline({
  blocks,
  duration,
  overrideDays,
  canPlace,
  readOnly = false,
  carrying = false,
  swapMode,
  onPlace,
  onMove,
  onBlockClick,
  onBlockEdit,
  onBlockDelete,
  onBlockRoomChange,
  onDraggingChange,
  onRoomHover,
  onResize,
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const colsRef = useRef({});
  const [hover, setHover] = useState(null); // { day, start }
  // Kursor ostidagi guruh — o'sha guruhning BARCHA kunlardagi bloklari tiniq
  // qoladi, qolganlari xiralashadi (bir dars haftada qayerlarda turgani
  // bir qarashda ko'rinsin).
  const [hoverId, setHoverId] = useState(null);
  const [drag, setDrag] = useState(null); // { block, grabDay, grabOffset, day, start, moved }
  // Blok chetidan cho'zish: { id, edge: "top"|"bottom", day, start, end }
  const [resize, setResize] = useState(null);

  const hours = useMemo(() => {
    const list = [];
    for (let h = Math.floor(RANGE_FROM / 60); h <= Math.floor(RANGE_TO / 60); h++) list.push(h);
    return list;
  }, []);

  const bodyPx = (RANGE_TO - RANGE_FROM) * PX_PER_MIN;

  const byDay = useMemo(() => {
    const map = Object.fromEntries(DAYS.map((d) => [d, []]));
    for (const b of blocks) {
      for (const d of b.days) {
        if (map[d]) map[d].push(b);
      }
    }
    return map;
  }, [blocks]);

  // Shu kunda, shu oraliqda band joy bormi. `exceptId` — surilayotgan blokning
  // o'zi hisobga olinmaydi (aks holda har surish "band" bo'lib chiqadi).
  const isBusy = useCallback(
    (day, start, end, exceptId) =>
      byDay[day].some(
        (b) => b.id !== exceptId && toMinutes(b.startTime) < end && start < toMinutes(b.endTime),
      ),
    [byDay],
  );

  // Bosilgan kundan yakuniy kun ro'yxati: avto naqsh yoki qo'lda tanlangan
  // kunlar; band bo'lganlari tashlanadi, bosilgan kun esa har doim qoladi.
  const resolveDays = useCallback(
    (day, start, exceptId) => {
      const end = start + duration;
      if (isBusy(day, start, end, exceptId)) return [];
      const base = overrideDays.length ? overrideDays : autoDays(day);
      const free = base.filter((d) => d === day || !isBusy(d, start, end, exceptId));
      return free.includes(day) ? free : [day, ...free];
    },
    [duration, overrideDays, isBusy],
  );

  const minuteAt = useCallback((day, clientY) => {
    const el = colsRef.current[day];
    if (!el) return null;
    const y = clientY - el.getBoundingClientRect().top;
    const raw = RANGE_FROM + y / PX_PER_MIN;
    return Math.round(raw / SNAP) * SNAP;
  }, []);

  // Kursor ostidagi kun ustuni — surish paytida ustunlar bo'ylab yurish uchun.
  const dayAt = useCallback(
    (clientX) =>
      DAYS.find((d) => {
        const el = colsRef.current[d];
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right;
      }),
    [],
  );

  // Kursor jadvaldan chiqqanida (`outside`) hech qanday ko'chirish ko'rinishi
  // chizilmaydi — blok o'z joyida turaveradi.
  const dragDays = useMemo(() => {
    if (!drag || drag.outside) return [];
    const delta = DAYS.indexOf(drag.day) - DAYS.indexOf(drag.grabDay);
    return shiftDays(drag.block.days, delta) || drag.block.days;
  }, [drag]);

  const dragBusy = useMemo(() => {
    if (!drag || drag.outside) return false;
    const end = drag.start + (toMinutes(drag.block.endTime) - toMinutes(drag.block.startTime));
    return (
      drag.start < RANGE_FROM ||
      end > RANGE_TO ||
      dragDays.some((d) => isBusy(d, drag.start, end, drag.block.id))
    );
  }, [drag, dragDays, isBusy]);

  // Surish sichqoncha oynadan chiqib ketsa ham uzilmasligi uchun window'da.
  useEffect(() => {
    if (!drag) return;

    const move = (e) => {
      // Kursor xona kartasi ustida bo'lsa — o'sha xona darhol ochiladi
      // (dars qayerga tushayotgani jonli ko'rinsin).
      const room = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-room-id]");
      if (room) onRoomHover?.(room.dataset.roomId);

      // Kursor jadvaldan chiqib ketgan (masalan chapdagi xona ro'yxatiga) —
      // ish maydonidagi harakat to'xtaydi: arvoh blok ham, kun belgilanishi
      // ham ko'rinmaydi. Faqat kursordagi yorliq yuradi. Jadvalga qaytilganda
      // harakat o'sha joyidan davom etadi.
      const r = rootRef.current?.getBoundingClientRect();
      const outside =
        !!r &&
        (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
      if (outside) return setDrag((d) => (d ? { ...d, outside, x: e.clientX, y: e.clientY } : d));

      const day = dayAt(e.clientX) || drag.day;
      const raw = minuteAt(day, e.clientY);
      const start = raw == null ? null : Math.round((raw - drag.grabOffset) / SNAP) * SNAP;
      setDrag((d) =>
        d
          ? {
              ...d,
              day,
              start: start ?? d.start,
              outside: false,
              x: e.clientX,
              y: e.clientY,
              moved:
                d.moved ||
                Math.abs(e.clientY - d.originY) > DRAG_THRESHOLD ||
                day !== d.grabDay,
            }
          : d,
      );
    };

    const up = (e) => {
      setDrag(null);
      // Chapdagi xona kartasiga tashlandi — dars o'sha xonaga ko'chadi.
      const room = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-room-id]");
      if (room) return onBlockRoomChange(drag.block, room.dataset.roomId);
      // Jadvaldan tashqarida, xonaga tegmay qo'yib yuborildi — bekor qilinadi.
      if (drag.outside) return;
      // Surilmagan bo'lsa — oddiy bosish. Modal ochilmaydi: faqat almashtirish
      // rejimida ma'noga ega (aks holda blokdagi ikonlar ishlatiladi).
      if (!drag.moved) return swapMode && onBlockClick(drag.block, drag.grabDay);
      if (dragBusy) return;
      onMove(drag.block, dragDays, drag.start);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [
    drag,
    dragDays,
    dragBusy,
    swapMode,
    onMove,
    onBlockClick,
    onBlockRoomChange,
    onRoomHover,
    dayAt,
    minuteAt,
  ]);

  // Cho'zish jarayonidagi jonli natija: cho'zilayotgan blokning yangi vaqti
  // va unga qarab surilgan qo'shni darslar.
  const preview = useMemo(() => {
    if (!resize) return null;
    return layoutAfterResize(
      blocks,
      resize.id,
      resize.start,
      resize.end,
      resize.edge === "bottom" ? "down" : "up",
    );
  }, [resize, blocks]);

  useEffect(() => {
    if (!resize) return;

    const move = (e) => {
      const raw = minuteAt(resize.day, e.clientY);
      if (raw == null) return;
      const m = Math.round(raw / SNAP) * SNAP;
      setResize((r) => {
        if (!r) return r;
        return r.edge === "bottom"
          ? { ...r, end: Math.max(r.start + SNAP, Math.min(RANGE_TO, m)) }
          : { ...r, start: Math.min(r.end - SNAP, Math.max(RANGE_FROM, m)) };
      });
    };

    const up = () => {
      setResize(null);
      if (!preview?.valid) return;
      // Faqat haqiqatan o'zgarganlari yuboriladi.
      const changes = [];
      for (const b of blocks) {
        const v = preview.map.get(b.id);
        if (!v) continue;
        const startTime = toHHMM(v.start);
        const endTime = toHHMM(v.end);
        if (startTime !== b.startTime || endTime !== b.endTime) {
          changes.push({ id: b.id, startTime, endTime });
        }
      }
      if (changes.length) onResize(changes);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [resize, preview, blocks, onResize, minuteAt]);

  const startResize = (block, day, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    setResize({
      id: block.id,
      edge,
      day,
      start: toMinutes(block.startTime),
      end: toMinutes(block.endTime),
    });
    setHover(null);
  };

  // Ota-komponent xona kartalarini "tashlash mumkin" holatida ko'rsatsin va
  // sudralayotgan darsni kursor yonida yorliq bo'lib chizsin.
  useEffect(() => {
    // Yorliq FAQAT jadvaldan chiqilganda (xona tanlash uchun chapga o'tilganda)
    // ko'rinadi — jadval ichida ko'chirish avvalgidek arvoh blok orqali.
    onDraggingChange?.(
      drag?.outside
        ? {
            id: drag.block.id,
            label: drag.block.label,
            span: toMinutes(drag.block.endTime) - toMinutes(drag.block.startTime),
            x: drag.x ?? drag.originX,
            y: drag.y ?? drag.originY,
          }
        : null,
    );
  }, [drag, onDraggingChange]);

  const handleMove = (day, e) => {
    if (drag || resize || !canPlace) return setHover(null);
    const start = minuteAt(day, e.clientY);
    if (start == null || start < RANGE_FROM || start + duration > RANGE_TO) return setHover(null);
    setHover({ day, start });
  };

  const handleClick = (day, e) => {
    if (drag || resize || !canPlace) return;
    const start = minuteAt(day, e.clientY);
    if (start == null) return;
    if (start < RANGE_FROM || start + duration > RANGE_TO) return;
    const days = resolveDays(day, start);
    if (!days.length) return;
    onPlace(days, start);
  };

  const startDrag = (block, day, e) => {
    const raw = minuteAt(day, e.clientY);
    if (raw == null) return;
    setDrag({
      block,
      grabDay: day,
      grabOffset: raw - toMinutes(block.startTime),
      day,
      start: toMinutes(block.startTime),
      originX: e.clientX,
      originY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    });
    setHover(null);
  };

  // Hover'da qaysi kunlarga tushishi — arvoh bloklar shu kunlarda chiziladi.
  const hoverDays = useMemo(
    () => (hover ? resolveDays(hover.day, hover.start) : []),
    [hover, resolveDays],
  );
  const hoverBusy = !!hover && !hoverDays.length;
  const dragSpan = drag ? toMinutes(drag.block.endTime) - toMinutes(drag.block.startTime) : 0;

  return (
    <div
      ref={rootRef}
      className={`w-full h-full isolate overflow-auto rounded-xl border border-slate-200/70 bg-white ${
        drag ? "select-none" : ""
      }`}
    >
      <div className="min-w-max">
        {/* Kun sarlavhalari */}
        {/* Qatlamlar (ichki `isolate` doirasida): kun sarlavhalari 30 →
            soat ustuni 20 → arvoh blok 15 → darslar 10. Shu tartib buzilsa
            gorizontal scroll'da darslar soat ustuni ustidan chiqib qoladi. */}
        <div className="sticky top-0 z-30 flex bg-white/95 backdrop-blur-sm border-b border-slate-200/70">
          <div className="sticky left-0 z-10 shrink-0 w-14 bg-white/95 border-r border-slate-200/70" />
          {DAYS.map((day) => {
            const on = hoverDays.includes(day) || dragDays.includes(day);
            const count = byDay[day].length;
            return (
              <div
                key={day}
                className={`flex-1 min-w-[8rem] px-3 py-2.5 border-l border-slate-300 transition-colors ${
                  on ? "bg-blue-50/60" : ""
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-sm font-semibold ${on ? "text-blue-700" : "text-slate-700"}`}
                  >
                    {t(`group.dayShort.${day}`)}
                  </span>
                  <span className="text-xs text-slate-400 truncate">{t(`group.day.${day}`)}</span>
                </div>
                {count > 0 && (
                  <span className="text-[11px] text-slate-400">
                    {t("room.lessonCount", { count })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative flex">
          {/* Soat ustuni */}
          <div
            className="sticky left-0 z-20 shrink-0 w-14 bg-white border-r border-slate-200/70"
            style={{ height: bodyPx }}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className={`absolute right-2 text-[13px] font-jet font-semibold text-slate-900 tabular-nums ${
                  i === 0 ? "" : "-translate-y-1/2"
                }`}
                style={{ top: i * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Kun ustunlari */}
          <div
            className="flex flex-1"
            style={{
              height: bodyPx,
              backgroundImage: `repeating-linear-gradient(to bottom, rgb(203 213 225) 0 1px, transparent 1px ${HOUR_PX}px)`,
            }}
          >
            {DAYS.map((day) => {
              const target = hoverDays.includes(day);
              const dragTarget = dragDays.includes(day);
              return (
                <div
                  key={day}
                  ref={(el) => {
                    colsRef.current[day] = el;
                  }}
                  onMouseMove={(e) => handleMove(day, e)}
                  onMouseLeave={() => setHover((h) => (h?.day === day ? null : h))}
                  onClick={(e) => handleClick(day, e)}
                  onMouseUp={(e) => carrying && handleClick(day, e)}
                  className={`relative flex-1 min-w-[8rem] border-l border-slate-300 ${
                    target || dragTarget ? "bg-blue-50/25" : ""
                  } ${canPlace && !drag ? "cursor-pointer" : ""}`}
                >
                  {/* Sichqoncha ostidagi "arvoh" bloklar — dars QAYSI kunlarga
                      va qaysi vaqtga tushishini oldindan ko'rsatadi. */}
                  {!drag && hover && (target || (hoverBusy && hover.day === day)) && (
                    <Ghost start={hover.start} duration={duration} busy={hoverBusy} t={t} />
                  )}

                  {/* Surilayotgan blokning yangi joyi */}
                  {drag && !drag.outside && dragTarget && (
                    <Ghost
                      start={drag.start}
                      duration={dragSpan}
                      busy={dragBusy}
                      label={drag.block.label}
                      t={t}
                    />
                  )}

                  {byDay[day].map((b) => {
                    // Cho'zish paytida bloklar preview joylashuvida chiziladi —
                    // qo'shnilar ham real vaqtda siljib turadi.
                    const pv = preview?.map.get(b.id);
                    const s = pv ? pv.start : toMinutes(b.startTime);
                    const e = pv ? pv.end : toMinutes(b.endTime);
                    const c = BLOCK_COLORS[b.colorIndex % BLOCK_COLORS.length];
                    const height = (e - s) * PX_PER_MIN;
                    const dragging = drag?.block.id === b.id && !drag.outside;
                    const resizing = resize?.id === b.id;
                    const dimmed = !drag && !resize && hoverId && hoverId !== b.id;
                    const showActions = !readOnly && !swapMode && !drag && !resize;
                    return (
                      <div
                        key={`${b.id}-${day}`}
                        title={
                          readOnly
                            ? `${b.label} · ${b.startTime}–${b.endTime}`
                            : `${b.label} · ${b.startTime}–${b.endTime} — ${
                                swapMode
                                  ? t("group.rescheduleSwapHint")
                                  : t("group.rescheduleMoveHint")
                              }`
                        }
                        onMouseDown={(ev) => {
                          if (readOnly) return;
                          ev.stopPropagation();
                          ev.preventDefault();
                          startDrag(b, day, ev);
                        }}
                        onClick={(ev) => ev.stopPropagation()}
                        onMouseEnter={() => setHoverId(b.id)}
                        onMouseLeave={() => setHoverId((id) => (id === b.id ? null : id))}
                        style={{
                          top: (s - RANGE_FROM) * PX_PER_MIN,
                          height: height - 3,
                          left: 3,
                          right: 3,
                        }}
                        className={`group absolute z-10 flex overflow-hidden rounded-lg border text-left ${c.bg} ${c.border} shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,opacity] duration-150 ${
                          dragging ? "opacity-40" : dimmed ? "opacity-25" : ""
                        } ${
                          resizing
                            ? preview?.valid
                              ? "ring-2 ring-blue-400"
                              : "ring-2 ring-rose-400"
                            : ""
                        } ${
                          readOnly
                            ? "cursor-default"
                            : drag
                              ? "cursor-grabbing hover:shadow-md"
                              : swapMode
                                ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-amber-400"
                                : "cursor-grab hover:shadow-md"
                        }`}
                      >
                        <span className={`shrink-0 w-1 rounded-l ${c.bar}`} />
                        <span className="flex flex-col min-w-0 px-2 py-1 leading-tight">
                          <span className={`text-xs font-semibold truncate ${c.text}`}>
                            {b.label}
                          </span>
                          {height >= 42 && (
                            <span className={`text-[11px] font-jet tabular-nums truncate ${c.sub}`}>
                              {toHHMM(s)}–{toHHMM(e)}
                            </span>
                          )}
                          {height >= 64 && b.teacher && (
                            <span className={`text-[11px] truncate ${c.sub}`}>{b.teacher}</span>
                          )}
                        </span>

                        {/* Cho'zish tutqichlari — yuqori/quyi chet. Yuqoridan
                            cho'zilsa boshlanish vaqti, pastdan cho'zilsa
                            tugash vaqti o'zgaradi (davomiylik shunga qarab). */}
                        {!readOnly && !swapMode && (
                          <>
                            <ResizeHandle
                              edge="top"
                              active={resizing && resize.edge === "top"}
                              onMouseDown={(ev) => startResize(b, day, "top", ev)}
                            />
                            <ResizeHandle
                              edge="bottom"
                              active={resizing && resize.edge === "bottom"}
                              onMouseDown={(ev) => startResize(b, day, "bottom", ev)}
                            />
                          </>
                        )}

                        {/* Blok amallari — modal o'rniga shu yerda. Faqat hover'da
                            chiqadi, drag boshlanmasligi uchun mousedown to'xtatiladi. */}
                        {showActions && (
                          <span className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
                            <BlockAction
                              title={t("group.rescheduleEditLesson")}
                              onClick={() => onBlockEdit(b, day)}
                            >
                              <HiPencilSquare />
                            </BlockAction>
                            <BlockAction
                              danger
                              title={t("group.rescheduleUnplaceSlot", {
                                day: t(`group.dayShort.${day}`),
                              })}
                              onClick={() => onBlockDelete(b, day)}
                            >
                              <HiTrash />
                            </BlockAction>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Blokning yuqori/quyi cheti — ushlab cho'zish uchun ingichka zona.
function ResizeHandle({ edge, active, onMouseDown }) {
  return (
    <span
      onMouseDown={onMouseDown}
      className={`absolute inset-x-0 h-2 cursor-ns-resize flex items-center justify-center ${
        edge === "top" ? "top-0" : "bottom-0"
      }`}
    >
      <span
        className={`w-7 h-[3px] rounded-full bg-slate-400/60 transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />
    </span>
  );
}

// Blok ustidagi kichik amal tugmasi (tahrirlash / slotdan olish).
function BlockAction({ title, danger, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center justify-center w-5 h-5 rounded-md bg-white/90 border border-slate-200/80 text-[11px] shadow-sm transition-colors duration-150 ${
        danger
          ? "text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white"
          : "text-slate-500 hover:bg-slate-900 hover:border-slate-900 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

// Joylashtirishdan (yoki surishdan) oldingi ko'rinish.
function Ghost({ start, duration, busy, label, t }) {
  return (
    <div
      className={`absolute inset-x-1 z-[15] pointer-events-none rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-0.5 overflow-hidden ${
        busy ? "border-rose-300 bg-rose-50/70" : "border-blue-400 bg-blue-50/70"
      }`}
      style={{ top: (start - RANGE_FROM) * PX_PER_MIN, height: duration * PX_PER_MIN - 3 }}
    >
      {label && !busy && (
        <span className="text-[11px] font-semibold text-blue-800 truncate max-w-full px-1">
          {label}
        </span>
      )}
      <span
        className={`text-[11px] font-jet tabular-nums font-semibold ${
          busy ? "text-rose-600" : "text-blue-700"
        }`}
      >
        {busy ? t("group.rescheduleBusySlot") : `${toHHMM(start)}–${toHHMM(start + duration)}`}
      </span>
    </div>
  );
}

export default ScheduleTimeline;
