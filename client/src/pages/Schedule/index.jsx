import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  HiArrowPath,
  HiArrowUturnLeft,
  HiCheck,
  HiCheckCircle,
  HiClock,
  HiCursorArrowRays,
  HiHome,
  HiUserGroup,
  HiXMark,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Select from "../../ui/Select";
import TimeInput from "../../ui/TimeInput";
import Dialog from "../../ui/Dialog";
import ScheduleTimeline from "./ScheduleTimeline";
import useMediaQuery from "../../hooks/useMediaQuery";
import { toHHMM, toMinutes } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_DURATION = 90;
const DURATIONS = [45, 60, 75, 90, 105, 120];

// Guruhning DB'dagi hozirgi jadvalidan joylashuv yasaydi. Jadvali to'liq
// bo'lmagan guruhlar (xona/kun/vaqt yo'q) joylashtirilmagan bo'lib qoladi.
const seedPlacements = (groups) => {
  const out = {};
  for (const g of groups) {
    const o = g.original;
    if (!o?.room || !o.days?.length || !o.startTime || !o.endTime) continue;
    out[g._id] = { roomId: o.room, days: o.days, startTime: o.startTime, endTime: o.endTime };
  }
  return out;
};

// Bitta joylashuv shu xonada boshqa dars bilan kesishadimi.
const findClash = (placements, { groupId, roomId, days, start, end }) => {
  for (const [gid, p] of Object.entries(placements)) {
    if (gid === groupId || p.roomId !== roomId) continue;
    if (!p.days.some((d) => days.includes(d))) continue;
    if (toMinutes(p.startTime) < end && start < toMinutes(p.endTime)) return { gid, ...p };
  }
  return null;
};

/**
 * "Jadval" — haftalik xona bandligi ish maydoni.
 *
 * Sahifa ochilganda barcha guruhlar **hozirgi jadvali bilan joylashgan** holda
 * ko'rinadi (`GET /groups/schedule`). Joylashuvlar FRONTENDDA (React state)
 * saqlanadi: joylashtirish, surish, almashtirish — hammasi so'rovsiz va darhol.
 * "Qayta tartiblash" ish maydonini bir zumda bo'shatadi (serverga tegmaydi),
 * "Saqlash" esa yakuniy holatni `POST /groups/reschedule/commit` ga yuboradi.
 *
 * Kichik ekranda sahifa FAQAT KO'RISH uchun: tartiblash amallari (joylashtirish,
 * surish, qayta tartiblash, saqlash) berkitiladi — jadval barmoq bilan
 * tasodifan buzilib ketmasin.
 *
 * Batafsil: docs/reschedule-spec.md, API_CONTRACT_group_reschedule.md.
 */
function Schedule() {
  const { t } = useTranslation();
  const canEdit = useMediaQuery("(min-width: 1024px)"); // Tailwind `lg`
  // `/rooms/:id` dagi "Tahrirlash" tugmasi shu yerga `?roomId=...` bilan
  // yo'naltiradi — boot bo'lganda o'sha xona dastlab ochiq bo'lishi uchun.
  const [searchParams] = useSearchParams();
  const initialRoomId = searchParams.get("roomId") || "";

  const [data, setData] = useState(null); // { groups, rooms }
  const [placements, setPlacements] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [roomId, setRoomId] = useState("");
  // Kunlar OLDINDAN tanlanmaydi — bo'sh bo'lsa bosilgan kundan avto naqsh
  // (Du·Cho·Ju / Se·Pa·Sha) olinadi. To'liq haftalik guruhlar uchun qo'lda
  // tanlash ham mumkin.
  const [overrideDays, setOverrideDays] = useState([]);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [cursor, setCursor] = useState(null); // tanlangan guruh kursor bilan yuradi

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  // Modal holati: { block, day, mode: "swap" | "edit", clash }. "swap" — guruh
  // tanlangan holda blokka bosilsa, "edit" — blokdagi qalam ikonidan.
  const [blockAction, setBlockAction] = useState(null);
  // Jadvaldagi blok sudralmoqda: { label, span, x, y } — xona kartalari
  // "tashlash mumkin" holatiga o'tadi va dars kursor bilan birga yuradi.
  const [blockDrag, setBlockDrag] = useState(null);
  // Chapdan guruh sudralmoqda — xonaga tashlansa o'sha xona ochiladi,
  // jadvalga tashlansa darsning o'zi joylashadi.
  const [carrying, setCarrying] = useState(false);

  const boot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/groups/schedule");
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
      setPlacements(seedPlacements(payload.groups));
      // Agar `?roomId=` orqali kelingan bo'lsa (Xona detail'dagi "Tahrirlash"
      // tugmasi) va shu xona ro'yxatda bo'lsa — o'sha ochiladi. Aks holda
      // birinchi xona darhol ochilib turadi — bo'sh ekran ko'rinmasin.
      const hasInitialRoom = payload.rooms.some((r) => r._id === initialRoomId);
      setRoomId(hasInitialRoom ? initialRoomId : payload.rooms[0]?._id || "");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(boot, 0);
    return () => clearTimeout(id);
  }, [boot]);

  // Tanlangan guruh kursor bilan birga yuradi — qayerga qo'yilayotgani
  // ko'z bilan uzilmasin.
  useEffect(() => {
    if (!selectedGroup) return;
    const move = (e) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [selectedGroup]);

  // Guruh kartasi sudralib xona chipiga tashlansa — o'sha xona ochiladi va
  // guruh tanlangan holida qoladi (keyin jadvalga bosib joylashtiriladi).
  // Jadval ustuniga tashlangan holatni timeline o'zi (`carrying`) hal qiladi.
  useEffect(() => {
    if (!carrying) return;
    const up = (e) => {
      setCarrying(false);
      const room = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-room-id]");
      if (room) setRoomId(room.dataset.roomId);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [carrying]);

  const placedIds = useMemo(() => new Set(Object.keys(placements)), [placements]);

  // Rang joylashtirish tartibi bo'yicha barqaror biriktiriladi.
  const colorOf = useMemo(() => {
    const order = Object.keys(placements);
    return (gid) => Math.max(0, order.indexOf(gid));
  }, [placements]);

  // Ish maydoni QAYSI filialda ekani — ochiq turgan xona bo'yicha. Guruh
  // tanlangan bo'lsa (uni joylashtirish jarayoni) o'sha guruhning filiali
  // ustun keladi.
  const activeCenter = useMemo(() => {
    if (selectedGroup) return selectedGroup.center;
    return data?.rooms.find((r) => r._id === roomId)?.center || "";
  }, [data, roomId, selectedGroup]);

  // Joylashtirilmagan guruhlar — FAQAT joriy filialniki. Boshqa filialning
  // guruhini bu xonalarga qo'yib bo'lmaydi, shuning uchun ro'yxatda ham
  // ko'rinmaydi (filial almashtirilsa ro'yxat o'zi almashadi).
  const unassigned = useMemo(() => {
    if (!data) return [];
    const list = data.groups.filter((g) => !placedIds.has(g._id));
    return activeCenter ? list.filter((g) => g.center === activeCenter) : list;
  }, [data, placedIds, activeCenter]);

  const assignedCount = placedIds.size;

  // Xonalar chapda to'liq ro'yxat bo'lib turadi. Guruh tanlangan bo'lsa faqat
  // shu filialning xonalari ko'rinadi (boshqa filialga qo'yib bo'lmaydi).
  const rooms = useMemo(() => {
    if (!data) return [];
    const list = selectedGroup
      ? data.rooms.filter((r) => r.center === selectedGroup.center)
      : data.rooms;
    return list.map((r) => ({
      ...r,
      count: Object.values(placements).filter((p) => p.roomId === r._id).length,
    }));
  }, [data, selectedGroup, placements]);

  const centerName = useCallback(
    (id) => data?.centers?.find((c) => c._id === id)?.name || "—",
    [data],
  );

  // Xonalar FILIAL bo'yicha bo'limlarga ajratiladi — ro'yxatning qayeridan
  // qaysi filial boshlanishi ko'rinib turadi. Filiali bitta bo'lsa
  // sarlavha keraksiz (`showHeaders`).
  const roomSections = useMemo(() => {
    const order = data?.centers?.map((c) => c._id) || [];
    const byCenter = new Map();
    for (const r of rooms) {
      if (!byCenter.has(r.center)) byCenter.set(r.center, []);
      byCenter.get(r.center).push(r);
    }
    const ids = [...byCenter.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return ids.map((id) => ({ id, name: centerName(id), rooms: byCenter.get(id) }));
  }, [rooms, data, centerName]);

  // Timeline shu XONAGA joylashtirilgan darslarni ko'rsatadi.
  const blocks = useMemo(() => {
    if (!data || !roomId) return [];
    return Object.entries(placements)
      .filter(([, p]) => p.roomId === roomId)
      .map(([gid, p]) => {
        const g = data.groups.find((x) => x._id === gid);
        return {
          id: gid,
          label: g?.label || "?",
          teacher: g?.teacher || "",
          days: p.days,
          startTime: p.startTime,
          endTime: p.endTime,
          colorIndex: colorOf(gid),
        };
      });
  }, [data, placements, roomId, colorOf]);

  const step1 = !!roomId;
  const canPlace = step1 && !!selectedGroup && canEdit;

  // Guruhni tanlash — ham chapdagi kartadan, ham toolbar dropdown'idan.
  // Tanlangan guruh boshqa filialniki bo'lsa, ish maydoni o'sha filialning
  // birinchi xonasiga o'tadi (aks holda bo'sh ekran qolardi).
  const pickGroup = (g) => {
    if (!g) return;
    setSelectedGroup((prev) => (prev?._id === g._id ? null : g));
    const room = data?.rooms.find((r) => r._id === roomId);
    if (room && room.center !== g.center) {
      setRoomId(data.rooms.find((r) => r.center === g.center)?._id || "");
    }
  };

  const labelOf = useCallback(
    (gid) => data?.groups.find((g) => g._id === gid)?.label || "",
    [data],
  );

  // Konflikt xabari — serverdan kelgan `conflict` yoki lokal topilgan clash.
  const conflictMsg = useCallback(
    (conflict, msg) =>
      conflict
        ? t("room.busyAtThisTime", {
            room: conflict.room,
            day: t(`group.day.${conflict.day}`),
            start: conflict.startTime,
            end: conflict.endTime,
            label: conflict.label,
          })
        : msg,
    [t],
  );

  // ─── Joylashuv amallari (hammasi lokal, so'rovsiz) ──────────────────────

  // `targetRoomId` — odatda ochiq turgan xona; boshqa xonaga ko'chirishda
  // (blok xona kartasiga tashlanganda) aynan o'sha xona uzatiladi.
  const put = (groupId, targetDays, start, end, targetRoomId = roomId) => {
    const clash = findClash(placements, {
      groupId,
      roomId: targetRoomId,
      days: targetDays,
      start,
      end,
    });
    if (clash) {
      return errorMsg(
        t("room.busyAtThisTime", {
          room: rooms.find((r) => r._id === targetRoomId)?.name || "",
          day: t(`group.day.${targetDays.find((d) => clash.days.includes(d))}`),
          start: clash.startTime,
          end: clash.endTime,
          label: labelOf(clash.gid),
        }),
      );
    }
    setPlacements((prev) => ({
      ...prev,
      [groupId]: {
        roomId: targetRoomId,
        days: targetDays,
        startTime: toHHMM(start),
        endTime: toHHMM(end),
      },
    }));
    return true;
  };

  const place = (targetDays, start) => {
    if (put(selectedGroup._id, targetDays, start, start + duration) !== true) return;
    // Faqat guruh tozalanadi: xona/kun/davomiylik qoladi, chunki jadval
    // odatda XONA-XONA to'ldiriladi.
    setSelectedGroup(null);
  };

  // Joylashtirilgan blokni surish — vaqti va kun naqshi yangilanadi.
  const move = (block, targetDays, start) => {
    const span = toMinutes(block.endTime) - toMinutes(block.startTime);
    put(block.id, targetDays, start, start + span);
  };

  // Sudralayotgan dars xona kartasi ustiga kelganda o'sha xona darhol ochiladi
  // — dars yangi xonada qayerga tushishi jonli ko'rinadi. Boshqa filialning
  // xonasiga o'tilmaydi (u yerga ko'chirib ham bo'lmaydi).
  const handleRoomHover = useCallback(
    (targetRoomId) => {
      setRoomId((prev) => {
        if (prev === targetRoomId || !data) return prev;
        const room = data.rooms.find((r) => r._id === targetRoomId);
        const group = data.groups.find((g) => g._id === blockDrag?.id);
        if (!room || (group && room.center !== group.center)) return prev;
        return targetRoomId;
      });
    },
    [data, blockDrag],
  );

  // Blok chapdagi xona kartasiga sudralib tashlandi — dars vaqti va kunlari
  // o'zgarmaydi, faqat xonasi almashadi (ish maydoni hover paytida allaqachon
  // o'sha xonaga o'tib bo'lgan).
  const moveToRoom = (block, targetRoomId) => {
    const current = placements[block.id];
    if (!current || current.roomId === targetRoomId) return;
    const room = data.rooms.find((r) => r._id === targetRoomId);
    const group = data.groups.find((g) => g._id === block.id);
    if (!room) return;
    // Boshqa filialning xonasiga ko'chirib bo'lmaydi.
    if (group && room.center !== group.center) return errorMsg(t("group.rescheduleRoomOtherCenter"));
    const ok = put(
      block.id,
      current.days,
      toMinutes(current.startTime),
      toMinutes(current.endTime),
      targetRoomId,
    );
    if (ok !== true) return;
    successMsg(t("group.rescheduleRoomMoved", { label: block.label, room: room.name }));
  };

  // Blok cho'zildi: cho'zilgan darsning yangi vaqti + unga qarab surilgan
  // qo'shni darslar bitta o'zgarish sifatida qo'llanadi. Kesishuv tekshiruvi
  // shart emas — joylashuvni timeline to'qnashuvsiz hisoblab beradi.
  const resizeLesson = (changes) =>
    setPlacements((prev) => {
      const next = { ...prev };
      for (const c of changes) {
        if (next[c.id]) next[c.id] = { ...next[c.id], startTime: c.startTime, endTime: c.endTime };
      }
      return next;
    });

  // Joylashtirilgan darsning kunlarini o'zgartirish (kun qo'shish/olib tashlash).
  const toggleBlockDay = (block, day) => {
    const next = block.days.includes(day)
      ? block.days.filter((d) => d !== day)
      : [...block.days, day];
    if (!next.length) return;
    if (put(block.id, next, toMinutes(block.startTime), toMinutes(block.endTime)) !== true) return;
    setBlockAction((prev) => (prev ? { ...prev, block: { ...prev.block, days: next } } : prev));
  };

  const unplace = (groupId) =>
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });

  // Faqat bitta kunni (bosilgan slotni) olib tashlaydi. Oxirgi kun bo'lsa
  // dars butunlay joyidan olinadi.
  const unplaceDay = (groupId, day) =>
    setPlacements((prev) => {
      const p = prev[groupId];
      if (!p) return prev;
      const days = p.days.filter((d) => d !== day);
      if (!days.length) {
        const next = { ...prev };
        delete next[groupId];
        return next;
      }
      return { ...prev, [groupId]: { ...p, days } };
    });

  // Dars vaqtini modaldan o'zgartirish. Faqat to'g'ri "HH:mm" va start < end
  // bo'lganda qo'llanadi (yozib turganda har harfda urinmasin).
  const setBlockTime = (block, field, value) => {
    const startTime = field === "startTime" ? value : block.startTime;
    const endTime = field === "endTime" ? value : block.endTime;
    setBlockAction((prev) =>
      prev ? { ...prev, block: { ...prev.block, startTime, endTime } } : prev,
    );
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) return;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) return;
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (start >= end) return;
    // To'qnashsa (`put` xato bersa) maydon haqiqiy vaqtga qaytadi — aks holda
    // modalda qo'llanmagan vaqt turib qolardi.
    // Qaytarish MANBASI — `placements`, chunki `block` yozib turganda
    // qo'llanmagan (oraliq) qiymatni ham saqlab turadi.
    if (put(block.id, block.days, start, end) !== true) {
      const real = placements[block.id];
      if (real) {
        setBlockAction((prev) =>
          prev
            ? {
                ...prev,
                block: { ...prev.block, startTime: real.startTime, endTime: real.endTime },
              }
            : prev,
        );
      }
    }
  };

  // Timeline'dagi blokka bosildi — bu FAQAT almashtirish rejimida sodir
  // bo'ladi (guruh tanlangan). Oddiy holatda blokdagi ikonlar ishlatiladi.
  const handleBlockClick = (block, day) => {
    if (!selectedGroup) return;

    // Yangi guruh eski slotning BOSHLANISH vaqtini oladi, lekin o'z
    // davomiyligi bilan — cho'zilgan qism boshqa darsga tegsa, bloklanadi.
    const start = toMinutes(block.startTime);
    const end = start + duration;
    const clash = blocks.find(
      (b) =>
        b.id !== block.id &&
        b.days.some((d) => block.days.includes(d)) &&
        toMinutes(b.startTime) < end &&
        start < toMinutes(b.endTime),
    );
    setBlockAction({ block, day, mode: "swap", clash });
  };

  // Eski guruhni joyidan olib, tanlangan guruhni aynan o'sha slotga qo'yadi.
  const swap = () => {
    const { block } = blockAction;
    const start = toMinutes(block.startTime);
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[block.id];
      next[selectedGroup._id] = {
        roomId,
        days: block.days,
        startTime: block.startTime,
        endTime: toHHMM(start + duration),
      };
      return next;
    });
    successMsg(t("group.rescheduleSwapDone", { from: block.label, to: selectedGroup.label }));
    setSelectedGroup(null);
    setBlockAction(null);
  };

  // "Qayta tartiblash" — ish maydonini butunlay bo'shatadi. FAQAT frontendda:
  // serverga hech narsa yuborilmaydi, DB "Saqlash"gacha tegilmaydi.
  const resetBoard = () => {
    setPlacements({});
    setSelectedGroup(null);
    setOverrideDays([]);
    setResetOpen(false);
  };

  const commit = async () => {
    try {
      setSaving(true);
      const res = await api.post("/groups/reschedule/commit", { mode: "full", placements });
      const { ok, msg, conflict } = res.data;
      if (!ok) throw new Error(conflictMsg(conflict, msg));
      successMsg(msg);
      await boot();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  if (loading) return <ScheduleSkeleton />;
  if (!data) return null;

  const clearedCount = data.groups.filter(
    (g) => !placedIds.has(g._id) && g.original.days?.length && g.original.startTime,
  ).length;

  return (
    <div className={`flex flex-col w-full h-full gap-4 min-h-0 ${carrying ? "select-none" : ""}`}>
      {selectedGroup && cursor && !blockDrag && (
        <CursorChip
          label={selectedGroup.label}
          duration={duration}
          minShort={t("room.minShort")}
          x={cursor.x}
          y={cursor.y}
        />
      )}

      {/* Jadvaldagi dars sudralmoqda — yorliq kursor bilan birga yuradi,
          shu sabab xona kartalari ustida ham "nima ko'chirilyapti" ko'rinadi. */}
      {blockDrag && (
        <CursorChip
          label={blockDrag.label}
          duration={blockDrag.span}
          minShort={t("room.minShort")}
          x={blockDrag.x}
          y={blockDrag.y}
        />
      )}

      {/* Sarlavha */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
          <h1 className="text-lg font-space font-bold text-slate-900 leading-tight">
            {t("nav.schedule")}
          </h1>
          <p className="text-xs text-slate-400">
            {canEdit ? t("schedule.hint") : t("schedule.readOnlyHint")}
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          <Button
            variant="outlined"
            color="orange"
            className="gap-1.5"
            disabled={!assignedCount}
            onClick={() => setResetOpen(true)}
          >
            <HiArrowPath className="text-base" />
            {t("schedule.reset")}
          </Button>
          <Button
            color="emerald"
            className="gap-1.5"
            disabled={!assignedCount}
            onClick={() => setConfirmOpen(true)}
          >
            <HiCheckCircle className="text-base" />
            {t("common.save")}
            <span className="px-1.5 rounded-full bg-white/25 text-xs tabular-nums">
              {assignedCount}
            </span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4 flex-1 min-h-0">
        {/* Chap ustun — Xonalar va Guruhlar TENG ikki panel. Mobilda sahifa
            faqat ko'rish uchun bo'lgani sabab "Joylashtirilmaganlar" paneli
            berkitiladi, xonalar esa ingichka (70px) gorizontal qatorga siqiladi
            — asosiy joyni jadvalning o'zi egallasin. */}
        {/* Avval `lg:grid-rows-2` edi — ya'ni ikkala panel TENG bo'linardi va
            joylashtirilmagan guruhlar paydo bo'lishi bilan xonalar ro'yxati
            yarmigacha qisqarib, faqat 2-3 ta xona ko'rinib qolardi. Endi
            xonalarga kafolatlangan minimal balandlik beriladi (o'zining ichki
            scroll'i bor), pastki panel esa qolgan joyni oladi. */}
        <div
          className={`grid grid-cols-1 gap-3 min-h-0 min-w-0 max-lg:h-[70px] ${
            unassigned.length
              ? "lg:grid-rows-[minmax(15rem,1fr)_minmax(9rem,0.6fr)]"
              : "lg:grid-rows-1"
          }`}
        >
          <Panel title={t("room.title")} count={rooms.length} scrollX compact>
            {rooms.length === 0 ? (
              <p className="px-3 py-2 rounded-lg bg-slate-50 text-xs text-slate-400">
                {t("room.empty")}
              </p>
            ) : (
              /* Xonalar FILIAL bo'limlariga ajratilgan — sarlavha qayerdan
                 qaysi filial boshlanishini ko'rsatib turadi. Filial bitta
                 bo'lsa sarlavha chizilmaydi (ortiqcha shovqin). */
              roomSections.map((sec) => (
                <Fragment key={sec.id}>
                  {roomSections.length > 1 && (
                    <div className="flex items-center gap-2 px-1 pt-1.5 pb-0.5 shrink-0 max-lg:pt-0 max-lg:self-center">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                        {sec.name}
                      </span>
                      <span className="flex-1 h-px bg-slate-100 max-lg:hidden" />
                      <span className="shrink-0 text-[11px] font-semibold text-slate-300 tabular-nums">
                        {sec.rooms.length}
                      </span>
                    </div>
                  )}
                  {sec.rooms.map((r) => {
                const on = roomId === r._id;
                return (
                  <button
                    key={r._id}
                    type="button"
                    data-room-id={r._id}
                    onClick={() => setRoomId(r._id)}
                    // Tanlangan xona to'liq ko'k fon bilan ajraladi, chap
                    // chizig'i oq — qaysi xona ochiqligi bir qarashda ko'rinadi.
                    className={`group relative flex items-center gap-2 h-11 shrink-0 pl-2.5 pr-2 rounded-[10px] text-left cursor-pointer transition-colors duration-150 ${
                      on
                        ? "bg-blue-500 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    } ${(carrying || blockDrag) && !on ? "ring-2 ring-blue-400/70" : ""}`}
                  >
                    <HiHome
                      className={`shrink-0 text-[15px] ${
                        on ? "text-white" : "text-slate-300 group-hover:text-slate-400"
                      }`}
                    />
                    <span
                      className={`flex-1 text-[13px] truncate ${on ? "font-semibold" : "font-medium"}`}
                    >
                      {r.name}
                    </span>
                    {r.count > 0 && (
                      <span
                        className={`shrink-0 min-w-5 px-1.5 h-5 flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                          on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {r.count}
                      </span>
                    )}
                  </button>
                );
              })}
                </Fragment>
              ))
            )}
          </Panel>

          {/* Joylashtirilmagan guruh qolmasa panel butunlay olib tashlanadi —
              Xonalar ro'yxati pastgacha cho'ziladi. `lg:contents` — katta
              ekranda o'rovchi div grid'da ko'rinmaydi, panel ikkinchi qator
              bo'lib qoladi; mobilda esa panel umuman ko'rsatilmaydi. */}
          {unassigned.length > 0 && (
          <div className="hidden lg:contents">
          <Panel title={t("group.rescheduleUnplaced")} count={unassigned.length}>
            {
              unassigned.map((g) => {
                const on = selectedGroup?._id === g._id;
                return (
                  <button
                    key={g._id}
                    type="button"
                    disabled={!canEdit}
                    // Bosish ham, ushlab sudrash ham bir xil boshlanadi:
                    // `mousedown` guruhni "qo'lga oladi", `mouseup` esa qayerga
                    // tashlanganiga qarab xonani ochadi yoki darsni joylashtiradi.
                    onMouseDown={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      if (on) return setSelectedGroup(null);
                      pickGroup(g);
                      setCarrying(true);
                    }}
                    // Ikki qatorli ixcham karta: nomi, ostida ikkinchi darajali
                    // uslubda "o'qituvchi · o'quvchilar soni".
                    className={`relative flex flex-col justify-center gap-px px-2.5 py-1.5 rounded-[10px] border text-left transition-colors duration-150 disabled:cursor-default max-lg:shrink-0 lg:enabled:cursor-grab ${
                      on
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-slate-200/70 enabled:hover:border-slate-300 enabled:hover:bg-slate-50"
                    }`}
                  >
                    {on && (
                      <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-blue-500" />
                    )}
                    <span
                      className={`text-[13px] font-semibold truncate leading-snug ${on ? "text-blue-900" : "text-slate-800"}`}
                    >
                      {g.label}
                    </span>
                    <span
                      className={`text-[11px] truncate leading-snug ${on ? "text-blue-700/70" : "text-slate-400"}`}
                    >
                      {g.teacher || t("group.noTeacher")}
                      <span className="px-1">•</span>
                      {t("group.studentsShort", { count: g.studentsCount })}
                    </span>
                  </button>
                );
              })
            }
          </Panel>
          </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-h-0 min-w-0 max-lg:min-h-[34rem]">
          {/* Toolbar — barcha sozlamalar bitta panelda, chapdan o'ngga tabiiy
              tartibda: Xona → Guruh → Kunlar → Davomiylik. Raqamli bosqichlar
              o'rniga tartib va tipografiya yo'l ko'rsatadi. */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3 p-2.5 rounded-2xl border border-slate-200/70 bg-slate-50/50">
            <Field label={t("group.room")} className="w-full max-w-[13rem] lg:w-[11.5rem]">
              <Select
                variant="white"
                icon={<HiHome className="text-[15px]" />}
                value={roomId}
                onChange={setRoomId}
                placeholder={t("group.rescheduleStepRoomEmpty")}
                options={rooms.map((r) => ({ value: r._id, label: r.name }))}
              />
            </Field>

            <div className="hidden lg:flex items-end gap-x-3 gap-y-3 flex-wrap">
              {/* Joylashtiriladigan guruh qolmagan bo'lsa maydon ham keraksiz. */}
              {unassigned.length > 0 && (
                <>
                  <Divider />
                  <Field label={t("group.rescheduleStepGroup")} className="w-[12.5rem]">
                    <Select
                      variant="white"
                      icon={<HiUserGroup className="text-[15px]" />}
                      value={selectedGroup?._id || ""}
                      onChange={(v) => pickGroup(unassigned.find((g) => g._id === v))}
                      placeholder={t("group.rescheduleStepGroupEmpty")}
                      options={unassigned.map((g) => ({ value: g._id, label: g.label }))}
                    />
                  </Field>
                </>
              )}

              <Divider />

              {/* Kunlar OLDINDAN tanlanmaydi — bo'sh bo'lsa bosilgan kundan
                  avto naqsh olinadi. To'liq haftalik guruhlar uchun qo'lda
                  belgilash ham mumkin. */}
              <Field
                label={t("group.days")}
                hint={overrideDays.length ? null : t("group.rescheduleDaysAuto")}
              >
                <div className="flex items-center gap-1.5">
                  {DAYS.map((d) => {
                    const on = overrideDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        title={t("group.rescheduleDaysAutoHint")}
                        onClick={() =>
                          setOverrideDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                          )
                        }
                        className={`w-9 h-10 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                          on
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                        }`}
                      >
                        {t(`group.dayShort.${d}`)}
                      </button>
                    );
                  })}
                  {overrideDays.length > 0 && (
                    <IconButton
                      variant="ghost"
                      color="black"
                      title={t("group.rescheduleDaysReset")}
                      className="!w-9 !h-10"
                      onClick={() => setOverrideDays([])}
                    >
                      <HiXMark />
                    </IconButton>
                  )}
                </div>
              </Field>

              <Divider />

              <Field label={t("group.rescheduleDuration")} className="w-[7.5rem]">
                <Select
                  variant="white"
                  icon={<HiClock className="text-[15px]" />}
                  value={String(duration)}
                  onChange={(v) => setDuration(Number(v))}
                  options={DURATIONS.map((d) => ({
                    value: String(d),
                    label: `${d} ${t("room.minShort")}`,
                  }))}
                />
              </Field>
            </div>
          </div>

          {/* Ish maydoni */}
          <div className="flex-1 min-h-0">
            {!step1 ? (
              <Guide step={1} t={t} />
            ) : (
              <ScheduleTimeline
                blocks={blocks}
                duration={duration}
                overrideDays={overrideDays}
                canPlace={canPlace}
                readOnly={!canEdit}
                carrying={carrying}
                swapMode={!!selectedGroup}
                onPlace={place}
                onMove={move}
                onBlockClick={handleBlockClick}
                onBlockEdit={(block, day) => setBlockAction({ block, day, mode: "edit" })}
                onBlockDelete={(block, day) => unplaceDay(block.id, day)}
                onBlockRoomChange={moveToRoom}
                onDraggingChange={setBlockDrag}
                onRoomHover={handleRoomHover}
                onResize={resizeLesson}
              />
            )}
          </div>
        </div>
      </div>

      {/* Blokka bosilganda: almashtirish yoki dars sozlamalari */}
      <Dialog
        open={!!blockAction}
        onClose={() => setBlockAction(null)}
        title={
          blockAction?.mode === "swap"
            ? t("group.rescheduleSwapTitle")
            : t("group.rescheduleLessonTitle")
        }
        actions={
          <>
            <Button
              color="black"
              variant="text"
              className="gap-1.5"
              onClick={() => setBlockAction(null)}
            >
              <HiArrowUturnLeft className="text-base" />
              {t("common.back")}
            </Button>
            {blockAction?.mode === "swap" ? (
              <Button color="orange" disabled={!!blockAction?.clash} onClick={swap}>
                {t("group.rescheduleSwapAction")}
              </Button>
            ) : (
              /* Slotdan olish endi blokdagi savat ikonida — bu yerda faqat
                 darsni butunlay joyidan olish qoladi. */
              <Button
                color="red"
                variant="outlined"
                onClick={() => {
                  unplace(blockAction.block.id);
                  setBlockAction(null);
                }}
              >
                {t("group.rescheduleUnplaceAll")}
              </Button>
            )}
          </>
        }
      >
        {blockAction && (
          <div className="flex flex-col gap-2.5 text-sm text-slate-600">
            {blockAction.mode === "swap" ? (
              <>
                <p className="leading-relaxed">
                  {t("group.rescheduleSwapConfirm", {
                    from: blockAction.block.label,
                    to: selectedGroup?.label,
                  })}
                </p>
                <div className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-slate-50 text-xs">
                  <span className="text-slate-500">
                    {rooms.find((r) => r._id === roomId)?.name}
                    <span className="text-slate-300"> · </span>
                    {blockAction.block.days.map((d) => t(`group.dayShort.${d}`)).join(", ")}
                  </span>
                  <span className="font-jet tabular-nums text-slate-800">
                    {blockAction.block.startTime}–
                    {toHHMM(toMinutes(blockAction.block.startTime) + duration)}
                    <span className="text-slate-400">
                      {" "}
                      ({duration} {t("room.minShort")})
                    </span>
                  </span>
                </div>
                {blockAction.clash ? (
                  <p className="px-3 py-2.5 rounded-xl bg-red-50 text-red-700 font-medium leading-relaxed">
                    {t("group.rescheduleSwapClash", { label: blockAction.clash.label })}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t("group.rescheduleSwapNote", { label: blockAction.block.label })}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-900">{blockAction.block.label}</p>
                {/* To'liq darslar bo'ladigan guruhlarga qo'shimcha kun
                    qo'shish/olib tashlash aynan shu yerda bo'ladi. */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400">{t("group.days")}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {DAYS.map((d) => {
                      const on = blockAction.block.days?.includes(d);
                      const only = on && blockAction.block.days.length === 1;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={only}
                          title={only ? t("group.rescheduleDaysMinOne") : ""}
                          onClick={() => toggleBlockDay(blockAction.block, d)}
                          className={`w-9 h-9 rounded-lg border text-xs font-semibold transition-colors duration-150 ${
                            on
                              ? "bg-blue-600 border-blue-600 text-white disabled:opacity-60"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                          }`}
                        >
                          {t(`group.dayShort.${d}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dars soati — kunlar bilan bir qatorda shu yerdan sozlanadi */}
                <div className="grid grid-cols-2 gap-3">
                  <TimeInput
                    label={t("group.startTime")}
                    variant="white"
                    value={blockAction.block.startTime}
                    onChange={(e) =>
                      setBlockTime(blockAction.block, "startTime", e.target.value)
                    }
                  />
                  <TimeInput
                    label={t("group.endTime")}
                    variant="white"
                    value={blockAction.block.endTime}
                    onChange={(e) => setBlockTime(blockAction.block, "endTime", e.target.value)}
                  />
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {t("group.rescheduleUnplaceHint", {
                    day: t(`group.day.${blockAction.day}`),
                  })}
                </p>
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Qayta tartiblash — faqat ish maydoni bo'shaydi, DB tegilmaydi */}
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t("schedule.reset")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setResetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="orange" onClick={resetBoard}>
              {t("schedule.reset")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {t("schedule.resetConfirm", { count: assignedCount })}
        </p>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("common.save")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="emerald" loading={saving} onClick={commit}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <HiCheck className="text-emerald-600 shrink-0" />
            {t("group.rescheduleConfirm", { count: assignedCount })}
          </p>
          {clearedCount > 0 && (
            <p className="px-3 py-2.5 rounded-xl bg-red-50 text-red-700 font-medium leading-relaxed">
              {t("group.rescheduleWillClear", { count: clearedCount })}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

// Chap ustundagi teng panel — sarlavha + soni, ichida scroll bo'ladigan ro'yxat.
// `compact` — mobilda panel 70px'ga siqiladi, shu sabab sarlavha qatori
// berkitiladi va faqat ro'yxatning o'zi qoladi.
function Panel({ title, count, scrollX = false, compact = false, children }) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-h-0 min-w-0 ${
        compact ? "p-2 lg:p-2.5" : "p-2.5"
      }`}
    >
      <div
        className={`items-center justify-between gap-2 px-1 pt-0.5 ${compact ? "hidden lg:flex" : "flex"}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
          {title}
        </p>
        <span className="shrink-0 min-w-5 px-1.5 h-5 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 text-[11px] font-semibold tabular-nums">
          {count}
        </span>
      </div>
      {/* `scrollX` — kichik ekranda ro'yxat chapdan o'ngga suriladi (xonalar
          vertikal joy egallamasin), katta ekranda odatdagi vertikal ro'yxat. */}
      <div
        className={`flex gap-1.5 min-h-0 flex-1 -mx-1 px-1 lg:flex-col lg:items-stretch lg:overflow-x-hidden lg:overflow-y-auto ${
          scrollX ? "max-lg:overflow-x-auto max-lg:overflow-y-hidden" : "flex-col overflow-y-auto"
        } ${compact ? "max-lg:items-center" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

// Toolbar maydoni — yorliq va uning ostidagi boshqaruv.
function Field({ label, hint, className = "", children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-slate-400">
        {label}
        {hint && (
          <span className="px-1.5 rounded-full bg-white border border-slate-200/80 text-[10px] text-slate-400">
            {hint}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

// Toolbar maydonlari orasidagi nozik ajratgich.
function Divider() {
  return <span className="self-end mb-2.5 w-px h-5 bg-slate-200" />;
}

// Tanlangan guruh kursor bilan birga yuradigan yorliq.
function CursorChip({ label, duration, minShort, x, y }) {
  return (
    <div
      className="fixed z-50 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/95 text-white text-xs font-semibold shadow-lg"
      style={{ left: x + 14, top: y + 14 }}
    >
      {label}
      <span className="font-jet tabular-nums text-white/60">
        {duration} {minShort}
      </span>
    </div>
  );
}

// Ish maydonining bo'sh holati — keyingi qadamni aytadi.
function Guide({ step, t }) {
  const items = [
    { n: 1, key: "group.rescheduleStep1" },
    { n: 2, key: "group.rescheduleStep2" },
    { n: 3, key: "group.rescheduleStep3" },
    { n: 4, key: "group.rescheduleStep4" },
  ];
  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full py-12 rounded-xl border border-dashed border-slate-200">
      <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 text-xl">
        <HiCursorArrowRays />
      </span>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {items.map((it) => {
          const active = it.n === step;
          const past = it.n < step;
          return (
            <div
              key={it.n}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-400"
              }`}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 shrink-0 rounded-full text-[11px] font-semibold ${
                  past
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {past ? <HiCheck /> : it.n}
              </span>
              {t(it.key)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Skeleton — spinner o'rniga sahifa tuzilishini oldindan ko'rsatadi.
function ScheduleSkeleton() {
  return (
    <div className="flex flex-col w-full h-full gap-4 min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-9 w-28 rounded-lg bg-slate-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-rows-2 gap-3 max-lg:h-[70px]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`flex-col gap-2 p-2 lg:p-3 rounded-2xl bg-white border border-slate-200/80 ${
                i === 0 ? "flex" : "hidden lg:flex"
              }`}
            >
              <div className="h-4 w-24 rounded bg-slate-100 animate-pulse max-lg:hidden" />
              {Array.from({ length: 4 }).map((__, j) => (
                <div
                  key={j}
                  className={`h-10 shrink-0 rounded-lg bg-slate-100/70 animate-pulse ${
                    j > 0 ? "max-lg:hidden" : ""
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 max-lg:min-h-[34rem]">
          <div className="h-12 w-full rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1 rounded-xl bg-slate-100/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default Schedule;
