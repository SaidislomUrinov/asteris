import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getTashkentNow, toMinutes } from "../../utils/schedule";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_START = 0;
const DAY_END = 24 * 60 - 1;

// Jadval diapazoni guruhlarga qarab qisqaradi — bo'sh soatlarni ko'rsatib
// joy isrof qilmaslik uchun. Guruh bo'lmasa shu standart oraliq ko'rinadi.
const FALLBACK_FROM = 8 * 60;
const FALLBACK_TO = 20 * 60;

// Blok balandligi = davomiylik. Juda qisqa dars ham o'qilishi uchun minimal
// balandlik bor, aks holda 20 daqiqalik dars matnsiz chiziqqa aylanadi.
const MIN_BLOCK_PX = 34;
// Shu balandlikdan pastda blok ichiga faqat bitta qator sig'adi.
const ONE_LINE_PX = 56;
const TWO_LINE_PX = 82;

// Fan (label) bo'yicha barqaror rang — bir fan butun jadvalda bir xil rangda
// ko'rinadi, shuning uchun xona bandligi bir qarashda o'qiladi.
const PALETTE = [
  { block: "bg-blue-50 border-blue-200", accent: "bg-blue-500", text: "text-blue-950", sub: "text-blue-700/80", dot: "bg-blue-500" },
  { block: "bg-violet-50 border-violet-200", accent: "bg-violet-500", text: "text-violet-950", sub: "text-violet-700/80", dot: "bg-violet-500" },
  { block: "bg-emerald-50 border-emerald-200", accent: "bg-emerald-500", text: "text-emerald-950", sub: "text-emerald-700/80", dot: "bg-emerald-500" },
  { block: "bg-amber-50 border-amber-200", accent: "bg-amber-500", text: "text-amber-950", sub: "text-amber-700/80", dot: "bg-amber-500" },
  { block: "bg-rose-50 border-rose-200", accent: "bg-rose-500", text: "text-rose-950", sub: "text-rose-700/80", dot: "bg-rose-500" },
  { block: "bg-cyan-50 border-cyan-200", accent: "bg-cyan-500", text: "text-cyan-950", sub: "text-cyan-700/80", dot: "bg-cyan-500" },
  { block: "bg-indigo-50 border-indigo-200", accent: "bg-indigo-500", text: "text-indigo-950", sub: "text-indigo-700/80", dot: "bg-indigo-500" },
  { block: "bg-teal-50 border-teal-200", accent: "bg-teal-500", text: "text-teal-950", sub: "text-teal-700/80", dot: "bg-teal-500" },
];

// Bitta kun uchun band bloklar orasidagi bo'sh oraliqlar — bo'sh joyga
// bosilganda (GroupScheduleDialog) qaysi oraliqqa tushgani shu orqali topiladi.
function buildFreeGaps(dayGroups, from, to) {
  const gaps = [];
  let cursor = from;
  for (const g of dayGroups) {
    if (g.startMin > cursor) gaps.push({ start: cursor, end: g.startMin });
    cursor = Math.max(cursor, g.endMin);
  }
  if (cursor < to) gaps.push({ start: cursor, end: to });
  return gaps;
}

// Ustma-ust tushgan darslar yonma-yon joylashadi (bitta xonada bunday
// bo'lmasligi kerak, lekin pending guruhlar konfliktini KO'RSATISH kerak —
// yashirib qo'yish administratorni chalg'itadi).
function assignLanes(dayGroups) {
  const laneEnds = [];
  const placed = dayGroups.map((g) => {
    let lane = laneEnds.findIndex((end) => end <= g.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(g.endMin);
    } else {
      laneEnds[lane] = g.endMin;
    }
    return { ...g, lane };
  });

  // Har blokning kengligi o'z klasteridagi lane soniga qarab hisoblanadi,
  // butun kun bo'yicha emas — aks holda bitta konflikt tufayli kunning
  // hamma darslari ikki barobar torayib ketardi.
  let clusterStart = 0;
  let clusterEnd = -Infinity;
  const clusters = [];
  placed.forEach((g, i) => {
    if (g.startMin >= clusterEnd && i > clusterStart) {
      clusters.push([clusterStart, i]);
      clusterStart = i;
    }
    clusterEnd = Math.max(clusterEnd, g.endMin);
  });
  if (placed.length) clusters.push([clusterStart, placed.length]);

  for (const [s, e] of clusters) {
    const lanes = Math.max(...placed.slice(s, e).map((g) => g.lane)) + 1;
    for (let i = s; i < e; i++) placed[i].laneCount = lanes;
  }
  return placed;
}

/**
 * Xonaning haftalik bandlik jadvali — vaqt gridi (kunlar gorizontal,
 * soatlar vertikal), bloklar davomiylikka mos balandlikda.
 *
 * @param {Object} props
 * @param {Array} props.groups - shu xonadagi (pending/active) guruhlar (days/startTime/endTime/label/teacher bilan)
 * @param {string} [props.currentGroupId] - hozir tahrirlanayotgan guruh (alohida ajratiladi)
 * @param {(day: string, slot: {start:number, end:number}) => void} [props.onFreeSlotClick] - bo'sh joyga bosilganda
 * @param {(group: Object) => void} [props.onGroupClick] - dars blokiga bosilganda
 * @param {boolean} [props.compact] - kichikroq zichlik (dialog ichida)
 */
function WeeklyRoomSchedule({
  groups,
  currentGroupId,
  onFreeSlotClick,
  onGroupClick,
  compact = false,
}) {
  const { t } = useTranslation();
  const columnsRef = useRef({});

  const hourPx = compact ? 62 : 84;
  const pxPerMin = hourPx / 60;
  const gutterPx = compact ? 58 : 70;
  const colMin = compact ? "min-w-[7.5rem]" : "min-w-[9.5rem]";

  const now = getTashkentNow();

  const { fromHour, toHour, byDay, colorOf, subjects, weekBusyMin } = useMemo(() => {
    const scheduled = groups
      .filter((g) => g.days?.length && g.startTime && g.endTime)
      .map((g) => ({ ...g, startMin: toMinutes(g.startTime), endMin: toMinutes(g.endTime) }))
      .filter((g) => g.endMin > g.startMin);

    // Diapazon: eng erta darsdan bir soat oldin, eng kechidan bir soat keyin.
    let min = FALLBACK_FROM;
    let max = FALLBACK_TO;
    if (scheduled.length) {
      min = Math.min(...scheduled.map((g) => g.startMin));
      max = Math.max(...scheduled.map((g) => g.endMin));
    }
    const fromHour = Math.max(0, Math.floor(min / 60) - 1);
    const toHour = Math.min(24, Math.ceil(max / 60) + 1);

    const subjects = [...new Set(scheduled.map((g) => g.label))].sort((a, b) => a.localeCompare(b));
    const colorOf = (label) => PALETTE[Math.max(0, subjects.indexOf(label)) % PALETTE.length];

    const byDay = {};
    let weekBusyMin = 0;
    for (const day of DAYS) {
      const dayGroups = scheduled
        .filter((g) => g.days.includes(day))
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      const busy = dayGroups.reduce((sum, g) => sum + (g.endMin - g.startMin), 0);
      weekBusyMin += busy;
      byDay[day] = {
        blocks: assignLanes(dayGroups),
        gaps: buildFreeGaps(dayGroups, DAY_START, DAY_END),
        busy,
      };
    }

    return { fromHour, toHour, byDay, colorOf, subjects, weekBusyMin };
  }, [groups]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center w-full py-10 text-slate-400 text-sm">
        {t("room.noGroupsYet")}
      </div>
    );
  }

  const rangeStart = fromHour * 60;
  const bodyPx = (toHour - fromHour) * hourPx;
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);

  const fmtDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (!h) return `${m}${t("room.minShort")}`;
    return m ? `${h}${t("room.hourShort")} ${m}${t("room.minShort")}` : `${h}${t("room.hourShort")}`;
  };

  const handleColumnClick = (day, e) => {
    if (!onFreeSlotClick) return;
    const el = columnsRef.current[day];
    if (!el) return;
    const y = e.clientY - el.getBoundingClientRect().top;
    const minute = rangeStart + y / pxPerMin;
    const gap = byDay[day].gaps.find((s) => minute >= s.start && minute < s.end);
    if (!gap) return;

    // Ro'yxat ko'rinishida bo'sh oraliq yaxlit blok edi va boshlanish vaqti
    // doim oraliq boshi bo'lardi. Gridda esa administrator ANIQ qaysi soatga
    // bosgani muhim — bo'sh oraliq boshi (ko'pincha 00:00) emas, bosilgan
    // daqiqa (15 daqiqaga yaxlitlab) boshlanish vaqti bo'ladi.
    const snapped = Math.round(minute / 15) * 15;
    const start = Math.min(Math.max(snapped, gap.start), Math.max(gap.start, gap.end - 15));
    onFreeSlotClick(day, { start, end: gap.end });
  };

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      <div
        className="w-full isolate overflow-auto rounded-xl border border-slate-200 bg-white"
        style={{ maxHeight: compact ? "48vh" : "68vh" }}
      >
        <div className="min-w-max">
          {/* Sarlavha: kunlar + har kunning bandligi */}
          <div className="sticky top-0 z-20 flex bg-white/95 backdrop-blur-sm border-b border-slate-200">
            <div
              className="sticky left-0 z-10 shrink-0 bg-white/95 border-r border-slate-200"
              style={{ width: gutterPx }}
            />
            {DAYS.map((day) => {
              const { blocks, busy } = byDay[day];
              const isToday = now.day === day;
              return (
                <div
                  key={day}
                  className={`flex-1 ${colMin} px-2 py-2 border-l border-slate-100 ${
                    isToday ? "bg-blue-50/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-base font-bold uppercase tracking-wider ${
                        isToday ? "text-blue-700" : "text-slate-600"
                      }`}
                    >
                      {t(`group.dayShort.${day}`)}
                    </span>
                    <span className="text-sm text-slate-400 truncate">
                      {t(`group.day.${day}`)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm">
                    {blocks.length ? (
                      <>
                        <span className="font-semibold text-slate-700">
                          {t("room.lessonCount", { count: blocks.length })}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-jet">{fmtDuration(busy)}</span>
                      </>
                    ) : (
                      <span className="text-emerald-600 font-medium">{t("room.dayFree")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid tanasi */}
          <div className="relative flex">
            {/* Soat ustuni */}
            <div
              className="sticky left-0 z-10 shrink-0 bg-white border-r border-slate-200"
              style={{ width: gutterPx, height: bodyPx }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className={`absolute right-2 text-sm font-jet text-slate-400 tabular-nums ${
                    i === 0 ? "" : "-translate-y-1/2"
                  }`}
                  style={{ top: i * hourPx }}
                >
                  {`${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {/* Kun ustunlari — soat chiziqlari fon gradienti orqali (uzluksiz) */}
            <div
              className="relative flex flex-1"
              style={{
                height: bodyPx,
                backgroundImage: `repeating-linear-gradient(to bottom, rgb(226 232 240) 0 1px, transparent 1px ${hourPx}px), repeating-linear-gradient(to bottom, transparent 0 ${hourPx / 2}px, rgb(241 245 249) ${hourPx / 2}px ${hourPx / 2 + 1}px, transparent ${hourPx / 2 + 1}px ${hourPx}px)`,
              }}
            >
              {DAYS.map((day) => {
                const { blocks } = byDay[day];
                const isToday = now.day === day;
                return (
                  <div
                    key={day}
                    ref={(el) => {
                      columnsRef.current[day] = el;
                    }}
                    onClick={(e) => handleColumnClick(day, e)}
                    className={`relative flex-1 ${colMin} border-l border-slate-100 ${
                      day === "sun" ? "bg-slate-50/60" : ""
                    } ${isToday ? "bg-blue-50/40" : ""} ${
                      onFreeSlotClick ? "cursor-pointer hover:bg-emerald-50/50" : ""
                    }`}
                  >
                    {blocks.map((g) => {
                      const isCurrent = currentGroupId && String(g._id) === String(currentGroupId);
                      const c = isCurrent ? PALETTE[1] : colorOf(g.label);
                      const height = Math.max((g.endMin - g.startMin) * pxPerMin, MIN_BLOCK_PX);
                      const width = 100 / g.laneCount;
                      const isPending = g.status === "pending";

                      return (
                        <button
                          key={g._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGroupClick?.(g);
                          }}
                          title={`${g.label} · ${g.startTime}–${g.endTime}${g.teacher ? ` · ${g.teacher}` : ""}`}
                          className={`absolute overflow-hidden flex text-left rounded-md border transition-opacity duration-150 ${c.block} ${
                            isPending ? "border-dashed" : ""
                          } ${isCurrent ? "ring-2 ring-violet-400 z-10" : ""} ${
                          // Tahrirlash modalida joriy guruh tiniq turadi,
                          // qolganlari xiralashadi (kursor tegsa qaytadi).
                          currentGroupId && !isCurrent ? "opacity-30 hover:opacity-100" : ""
                        } ${
                            onGroupClick ? "cursor-pointer hover:shadow-md hover:z-10" : "cursor-default"
                          }`}
                          style={{
                            top: (g.startMin - rangeStart) * pxPerMin,
                            height: height - 2,
                            left: `calc(${g.lane * width}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                          }}
                        >
                          <span className={`shrink-0 w-1 rounded-l-[3px] ${c.accent}`} />
                          <span className="flex flex-col min-w-0 px-1.5 py-1 leading-tight">
                            <span className={`text-[15px] font-semibold truncate ${c.text}`}>
                              {g.label}
                            </span>
                            {height >= ONE_LINE_PX && (
                              <span className={`text-sm font-jet tabular-nums truncate ${c.sub}`}>
                                {g.startTime}–{g.endTime}
                              </span>
                            )}
                            {height >= TWO_LINE_PX && (
                              <span className={`text-sm truncate ${c.sub}`}>
                                {isCurrent
                                  ? t("group.scheduleCurrentSlot")
                                  : `${g.teacher || t("group.noTeacher")} · ${g.studentsCount}`}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Hozirgi vaqt chizig'i — BITTA marta, butun grid bo'ylab
                  (kun ustunlari ichida emas): shu soatda hafta bo'ylab qaysi
                  darslar ketayotgani bir chiziqda ko'rinadi. Bloklardan
                  ustunroq (z-30), lekin bosishga xalaqit bermaydi. */}
              {(() => {
                const nowMin = toMinutes(now.time);
                if (nowMin < rangeStart || nowMin > toHour * 60) return null;
                return (
                  <div
                    className="absolute inset-x-0 z-30 pointer-events-none"
                    style={{ top: (nowMin - rangeStart) * pxPerMin }}
                  >
                    <div className="h-[1.5px] bg-rose-500" />
                    <div className="absolute left-0 -top-[3px] w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda: fan → rang, va haftalik jami bandlik */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
        {subjects.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colorOf(s).dot}`} />
            {s}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm border border-dashed border-slate-400" />
          {t("group.statusPending")}
        </span>
        <span className="ms-auto font-medium text-slate-600">
          {t("room.weekBusy")}: <span className="font-jet">{fmtDuration(weekBusyMin)}</span>
        </span>
      </div>
    </div>
  );
}

export default WeeklyRoomSchedule;
