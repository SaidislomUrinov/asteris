import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  HiArrowPath,
  HiArrowUturnLeft,
  HiBuildingOffice2,
  HiCheck,
  HiCheckCircle,
  HiChevronRight,
  HiCursorArrowRays,
  HiHome,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import TimeInput from "../../ui/TimeInput";
import Dialog from "../../ui/Dialog";
import ScheduleTimeline from "./ScheduleTimeline";
import useMediaQuery from "../../hooks/useMediaQuery";
import { toHHMM, toMinutes } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { useSocketEvent } from "../../hooks/useSocketEvent";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_DURATION = 90;

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
 * saqlanadi: joylashtirish, surish, almashtirish — hammasi darhol va uzilishsiz.
 *
 * **Avto-saqlash:** "Saqlash" tugmasi YO'Q. Har bir o'zgarish (joylashtirish,
 * surish, cho'zish, xonaga ko'chirish, slotdan olish, "Qayta tartiblash")
 * debounce bilan `POST /groups/reschedule/commit` (`mode: "full"`) ga yuboriladi.
 * `mode: "full"` — jadvalda qolmagan guruhlarning xona/kun/vaqti serverda
 * TOZALANADI, ya'ni ular Guruhlar sahifasida "Kun/vaqt belgilanmagan" holatiga
 * qaytadi. Pastki paneldagi indikator saqlash holatini ko'rsatib turadi.
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
  // Har bir joylashuv o'zgarishidan OLDINGI holat shu yerga to'planadi (Ctrl+Z
  // uchun) — cheksiz o'smasin deb oxirgi 50 tasi saqlanadi.
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  // Hozir saqlanayotgan guruhlar — RoomDetail.jsx:47 bilan bir xil naqsh,
  // blok kutish holatida ko'rinadi.
  const [savingIds, setSavingIds] = useState([]);
  // O'z saqlashimiz `group:changed` bo'lib qaytadi — o'zimizni qayta
  // yuklamaslik uchun shu bayroq. Ketma-ket bir nechta guruh saqlanayotganda
  // (swap, ko'p guruhni joylashtirish) bayroq faqat OXIRGI saqlash tugab,
  // grace vaqti o'tgachgina tushadi — shuning uchun uchta ref:
  //   pendingSaves — hozir uchayotgan PATCH'lar soni,
  //   graceTimer   — oxirgi PATCH'dan keyingi kutish taymeri,
  //   selfSaveRef  — natijaviy "hozir o'zimiz saqlayapmiz" holati.
  const selfSaveRef = useRef(false);
  const pendingSaves = useRef(0);
  const graceTimer = useRef(null);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [roomId, setRoomId] = useState("");
  // Kunlar tanlanmaydi — bosilgan kundan har doim avto naqsh (Du·Cho·Ju /
  // Se·Pa·Sha) olinadi, davomiylik esa doim standart qiymatda qoladi —
  // ikkalasini ham qo'lda o'zgartiradigan boshqaruv olib tashlangan.
  const duration = DEFAULT_DURATION;
  const [cursor, setCursor] = useState(null); // tanlangan guruh kursor bilan yuradi

  const [resetOpen, setResetOpen] = useState(false);
  // "Qayta tartiblash" ketma-ket PATCH yuborayotganda: { done, total }. Modal
  // shu paytda yopilmaydi (non-dismissible).
  const [resetProgress, setResetProgress] = useState(null);
  // Modal holati: { block, day, mode: "swap" | "edit", clash }. "swap" — guruh
  // tanlangan holda blokka bosilsa, "edit" — blokdagi qalam ikonidan.
  const [blockAction, setBlockAction] = useState(null);
  // Jadvaldagi blok sudralmoqda: { label, span, x, y } — xona kartalari
  // "tashlash mumkin" holatiga o'tadi va dars kursor bilan birga yuradi.
  const [blockDrag, setBlockDrag] = useState(null);
  // Chapdan guruh sudralmoqda — xonaga tashlansa o'sha xona ochiladi,
  // jadvalga tashlansa darsning o'zi joylashadi.
  const [carrying, setCarrying] = useState(false);

  // `opts.silent` — socketdan kelgan sinxronizatsiya: skeleton ko'rsatilmaydi,
  // ochiq turgan xona va tarix saqlanib qoladi (ish jarayoni uzilmasin).
  const boot = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    try {
      if (!silent) setLoading(true);
      const res = await api.get("/groups/schedule");
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
      setPlacements(seedPlacements(payload.groups));
      if (!silent) setHistory([]);
      // Agar `?roomId=` orqali kelingan bo'lsa (Xona detail'dagi "Tahrirlash"
      // tugmasi) va shu xona ro'yxatda bo'lsa — o'sha ochiladi. Aks holda
      // birinchi xona darhol ochilib turadi — bo'sh ekran ko'rinmasin.
      const fallback = () => {
        const hasInitialRoom = payload.rooms.some((r) => r._id === initialRoomId);
        return hasInitialRoom ? initialRoomId : payload.rooms[0]?._id || "";
      };
      setRoomId((current) =>
        current && payload.rooms.some((r) => r._id === current) ? current : fallback(),
      );
    } catch (error) {
      if (!silent) errorMsg(error.message);
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(boot, 0);
    return () => clearTimeout(id);
  }, [boot]);

  // Boshqa tab/xodim guruh jadvalini o'zgartirsa (masalan xona detalidan
  // sudrab), shu sahifa darhol yangilanadi. Avto-saqlash tufayli mahalliy
  // holat doim server bilan bir xil, shuning uchun qayta yuklash xavfsiz —
  // faqat O'Z saqlashimiz qaytib kelganda (`selfSaveRef`) e'tiborsiz
  // qoldiriladi, aks holda har surishdan keyin jadval sakrab ketardi.
  useSocketEvent("group:changed", (payload) => {
    if (payload?.action === "telegram") return; // jadvalga ta'sir qilmaydi
    if (selfSaveRef.current || pendingSaves.current > 0) return;
    boot({ silent: true });
  });

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

  // Joylashuvni o'zgartirishdan oldin joriy holatni tarixga yozadi —
  // barcha mutatsion amallar (`put`, `resizeLesson`, `unplace`,
  // `unplaceDay`, `swap`, `resetBoard`) shu yerdan foydalanadi.
  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), placements]);
  }, [placements]);

  // Ctrl+Z (yoki Cmd+Z) — oxirgi amalni bitta qadam ortga qaytaradi.
  // Faqat tartiblash rejimida (katta ekran) ishlaydi.
  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setPlacements(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, undo]);

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

  // "Qayta tartiblash" faqat ochiq filialga tegadi — tugma va tasdiq oynasi
  // ham aynan shu filialdagi darslar sonini ko'rsatadi.
  const centerAssignedCount = useMemo(() => {
    if (!data) return 0;
    return Object.values(placements).filter((p) => {
      const room = data.rooms.find((r) => r._id === p.roomId);
      return room && room.center === activeCenter;
    }).length;
  }, [data, placements, activeCenter]);

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

  // ─── Saqlash ─────────────────────────────────────────────────────────────
  // Bitta guruhni saqlaydi — RoomDetail.jsx:100-148 bilan bir xil naqsh:
  // optimistik `setPlacements` → `PATCH /groups/:id/schedule` → xato bo'lsa
  // rollback. `next` — placements state'iga yoziladigan yangi qiymat, `null`
  // bo'lsa guruh jadvaldan butunlay olib tashlanadi (state'dan o'chiriladi).
  // `prev` — o'zgarishdan OLDINGI qiymat (rollback nishoni), yo'q bo'lsa
  // guruh avval joylashmagan degani. `opts.silent` — ko'p qadamli amallarda
  // (swap, "Qayta tartiblash") oraliq muvaffaqiyat/xato xabarlarini
  // bostiradi — yakuniy xabarni chaqiruvchi o'zi ko'rsatadi.
  const saveGroup = useCallback(
    async (groupId, next, prev, opts = {}) => {
      const id = String(groupId);
      const body = next
        ? { roomId: next.roomId, days: next.days, startTime: next.startTime, endTime: next.endTime }
        : { roomId: null, days: [], startTime: "", endTime: "" };

      setSavingIds((list) => [...list, id]);
      pendingSaves.current += 1;
      selfSaveRef.current = true;
      clearTimeout(graceTimer.current);
      setPlacements((p) => {
        const copy = { ...p };
        if (next) copy[id] = next;
        else delete copy[id];
        return copy;
      });

      const rollback = () =>
        setPlacements((p) => {
          const copy = { ...p };
          if (prev) copy[id] = prev;
          else delete copy[id];
          return copy;
        });

      try {
        const res = await api.patch(`/groups/${id}/schedule`, body);
        const { ok, msg, conflict } = res.data;
        if (!ok) {
          rollback();
          if (!opts.silent) errorMsg(conflictMsg(conflict, msg));
          return { ok: false, msg, conflict };
        }
        if (!opts.silent) successMsg(msg);
        return { ok: true, msg };
      } catch (error) {
        rollback();
        if (!opts.silent) errorMsg(error.message);
        return { ok: false, msg: error.message };
      } finally {
        setSavingIds((list) => list.filter((x) => x !== id));
        pendingSaves.current = Math.max(0, pendingSaves.current - 1);
        // Bayroq faqat BARCHA saqlashlar tugagach va grace vaqti o'tgachgina
        // tushadi. Aks holda ketma-ket saqlashda birinchi PATCH'ning taymeri
        // ikkinchisi uchayotganda ishga tushib, o'z eventimizdan qayta boot
        // bo'lardi — jadval ish ustida "yangilanib" ketardi.
        if (pendingSaves.current === 0) {
          clearTimeout(graceTimer.current);
          graceTimer.current = setTimeout(() => {
            selfSaveRef.current = false;
          }, 1500);
        }
      }
    },
    [conflictMsg],
  );

  // ─── Joylashuv amallari ──────────────────────────────────────────────────

  // `targetRoomId` — odatda ochiq turgan xona; boshqa xonaga ko'chirishda
  // (blok xona kartasiga tashlanganda) aynan o'sha xona uzatiladi.
  const put = (groupId, targetDays, start, end, targetRoomId = roomId, opts) => {
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
    pushHistory();
    const prev = placements[groupId];
    const next = {
      roomId: targetRoomId,
      days: targetDays,
      startTime: toHHMM(start),
      endTime: toHHMM(end),
    };
    saveGroup(groupId, next, prev, opts);
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
      { silent: true },
    );
    if (ok !== true) return;
    successMsg(t("group.rescheduleRoomMoved", { label: block.label, room: room.name }));
  };

  // Blok cho'zildi: cho'zilgan darsning yangi vaqti + unga qarab surilgan
  // qo'shni darslar bitta o'zgarish sifatida qo'llanadi. Kesishuv tekshiruvi
  // shart emas — joylashuvni timeline to'qnashuvsiz hisoblab beradi.
  const resizeLesson = (changes) => {
    pushHistory();
    // Bir necha dars bitta cho'zishdan (o'ziniki + surilgan qo'shnilar)
    // o'zgarishi mumkin — har biri o'z PATCH'ini olib alohida saqlanadi.
    for (const c of changes) {
      const prev = placements[c.id];
      if (!prev) continue;
      const next = { ...prev, startTime: c.startTime, endTime: c.endTime };
      saveGroup(c.id, next, prev);
    }
  };

  // Joylashtirilgan darsning kunlarini o'zgartirish (kun qo'shish/olib tashlash).
  const toggleBlockDay = (block, day) => {
    const next = block.days.includes(day)
      ? block.days.filter((d) => d !== day)
      : [...block.days, day];
    if (!next.length) return;
    if (put(block.id, next, toMinutes(block.startTime), toMinutes(block.endTime)) !== true) return;
    setBlockAction((prev) => (prev ? { ...prev, block: { ...prev.block, days: next } } : prev));
  };

  // Guruhni jadvaldan butunlay olib tashlaydi — server ham
  // `{ roomId: null, days: [], startTime: "", endTime: "" }` bilan tozalanadi.
  const unplace = (groupId) => {
    pushHistory();
    const prev = placements[groupId];
    saveGroup(groupId, null, prev);
  };

  // Faqat bitta kunni (bosilgan slotni) olib tashlaydi. Oxirgi kun bo'lsa
  // dars butunlay joyidan olinadi (yuqoridagi `unplace` bilan bir xil).
  const unplaceDay = (groupId, day) => {
    pushHistory();
    const prev = placements[groupId];
    if (!prev) return;
    const days = prev.days.filter((d) => d !== day);
    if (!days.length) return saveGroup(groupId, null, prev);
    saveGroup(groupId, { ...prev, days }, prev);
  };

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
  // Bitta so'rov yetmaydi (API_CONTRACT 3.2): A vaqtincha bo'shatiladi → B A
  // ning eski joyiga qo'yiladi → A B ning eski joyiga qo'yiladi. Oraliq
  // qadamda xato bo'lsa — oldingi qadamlar kompensatsion PATCH bilan
  // qaytariladi.
  const swap = async () => {
    const { block } = blockAction;
    const start = toMinutes(block.startTime);
    const groupAId = block.id;
    const groupBId = selectedGroup._id;
    const prevA = placements[groupAId];
    const prevB = placements[groupBId];
    const bNext = {
      roomId,
      days: block.days,
      startTime: block.startTime,
      endTime: toHHMM(start + duration),
    };
    const aNext = prevB
      ? { roomId: prevB.roomId, days: prevB.days, startTime: prevB.startTime, endTime: prevB.endTime }
      : null;

    pushHistory();
    setSelectedGroup(null);
    setBlockAction(null);

    // 1) A vaqtincha bo'shatiladi.
    const step1 = await saveGroup(groupAId, null, prevA, { silent: true });
    if (!step1.ok) return errorMsg(conflictMsg(step1.conflict, step1.msg));

    // 2) B — A ning eski slotiga.
    const step2 = await saveGroup(groupBId, bNext, prevB, { silent: true });
    if (!step2.ok) {
      await saveGroup(groupAId, prevA || null, null, { silent: true }); // A ni qaytarish
      return errorMsg(conflictMsg(step2.conflict, step2.msg));
    }

    // 3) A — B ning eski slotiga.
    const step3 = await saveGroup(groupAId, aNext, null, { silent: true });
    if (!step3.ok) {
      await saveGroup(groupBId, prevB || null, bNext, { silent: true }); // B ni qaytarish
      await saveGroup(groupAId, prevA || null, null, { silent: true }); // A ni qaytarish
      return errorMsg(conflictMsg(step3.conflict, step3.msg));
    }

    successMsg(t("group.rescheduleSwapDone", { from: block.label, to: selectedGroup.label }));
  };

  // "Qayta tartiblash" — tasdiqdan keyin FAQAT ochiq turgan filialning har
  // bir guruhi uchun ALOHIDA `PATCH { roomId: null, ... }` yuboriladi (bulk
  // so'rov yo'q). Boshqa filiallarning joylashuvlariga tegilmaydi. Atomar
  // emas — ba'zi guruhlar saqlanib, ba'zilari xato bersa ham qolganlari
  // bazada saqlanib qoladi, xato bergan guruhlar toastda ro'yxatlanadi.
  const resetBoard = async () => {
    const entries = Object.entries(placements).filter(([, p]) => {
      const room = data?.rooms.find((r) => r._id === p.roomId);
      return room && room.center === activeCenter;
    });
    if (!entries.length) return setResetOpen(false);

    pushHistory();
    setSelectedGroup(null);
    setResetProgress({ done: 0, total: entries.length });
    const failedLabels = [];
    for (const [gid, prev] of entries) {
      const res = await saveGroup(gid, null, prev, { silent: true });
      if (!res.ok) failedLabels.push(labelOf(gid));
      setResetProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setResetProgress(null);
    setResetOpen(false);
    if (failedLabels.length) {
      errorMsg(t("group.rescheduleResetFailed", { list: failedLabels.join(", ") }));
    }
  };

  if (loading) return <ScheduleSkeleton />;
  if (!data) return null;

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
          {/* Filial bir nechta bo'lsa panel aynan shu ierarxiyani nomlaydi —
              chapdagi ustun nima ekani sarlavhadanoq ko'rinib tursin. */}
          <Panel
            title={roomSections.length > 1 ? t("schedule.branchesAndRooms") : t("room.title")}
            count={rooms.length}
            scrollX
            compact
          >
            {rooms.length === 0 ? (
              <p className="px-3 py-2 rounded-lg bg-slate-50 text-xs text-slate-400">
                {t("room.empty")}
              </p>
            ) : (
              /* Xonalar FILIAL bo'limlariga ajratilgan — sarlavha qayerdan
                 qaysi filial boshlanishini ko'rsatib turadi. Filial bitta
                 bo'lsa sarlavha chizilmaydi (ortiqcha shovqin). */
              roomSections.map((sec) => {
                // Filiali bitta bo'lsa akkordeon keraksiz — xonalar ochiq
                // turadi. Aks holda ochiq bo'lim = ish maydonidagi xonaning
                // filiali (alohida state kerak emas, ikkalasi doim mos).
                const single = roomSections.length === 1;
                const open = single || activeCenter === sec.id;
                return (
                /* Butun bo'lim (sarlavha + xonalar) BITTA slate konteynerda —
                   qaysi filial ochiqligi bir qarashda ko'rinadi. Mobilda
                   `contents` bilan o'rovchi layoutdan chiqib ketadi: u yerda
                   panel gorizontal tasma, akkordeon ishlatilmaydi. */
                <div
                  key={sec.id}
                  className={`max-lg:contents lg:flex lg:flex-col lg:gap-1.5 lg:p-1.5 lg:rounded-xl lg:transition-colors lg:duration-300 ${
                    open && !single ? "lg:bg-slate-100 lg:ring-1 lg:ring-slate-200/70" : ""
                  }`}
                >
                  {!single && (
                    <button
                      type="button"
                      // Filialga bosilsa uning xonalari ochiladi, oldingisi
                      // yopiladi. Ish maydoni ham shu filialning birinchi
                      // xonasiga o'tadi — panel bilan jadval mos bo'lib qolsin.
                      onClick={() => setRoomId(sec.rooms[0]?._id || "")}
                      // Yopiq holatda — oq karta (bosiladigan qator ekani
                      // ko'rinib tursin), ochiq holatda esa slate konteyner
                      // ustidagi sarlavha bo'lib qoladi.
                      className={`flex items-center gap-2 px-2 h-11 shrink-0 rounded-[10px] text-left cursor-pointer transition-colors duration-300 max-lg:self-center ${
                        open
                          ? "text-slate-900"
                          : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <HiBuildingOffice2
                        className={`shrink-0 text-[17px] transition-colors duration-300 ${
                          open ? "text-blue-500" : "text-slate-400"
                        }`}
                      />
                      <span className="flex-1 text-[13px] font-semibold truncate">{sec.name}</span>
                      <span
                        className={`shrink-0 min-w-5 px-1.5 h-5 flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
                          open ? "bg-white text-slate-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {sec.rooms.length}
                      </span>
                      <HiChevronRight
                        className={`shrink-0 text-[13px] transition-transform duration-300 ${
                          open ? "rotate-90 text-slate-400" : "text-slate-300"
                        }`}
                      />
                    </button>
                  )}
                  {/* Ochilish/yopilish animatsiyasi: grid qatori `0fr → 1fr`
                      bo'ladi, shu sabab kontent balandligini oldindan bilish
                      shart emas. Xonalar DOM'da doim turadi — aks holda
                      yopilish animatsiyasi ko'rinmasdi. */}
                  <div
                    className={`max-lg:contents lg:grid lg:transition-[grid-template-rows] lg:duration-300 lg:ease-out ${
                      open ? "lg:grid-rows-[1fr]" : "lg:grid-rows-[0fr]"
                    }`}
                  >
                    <div className="max-lg:contents lg:min-h-0 lg:overflow-hidden">
                      <div className="max-lg:contents lg:flex lg:flex-col lg:gap-1.5">
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
                    // Slate konteyner ichida xonalar OQ karta bo'lib turadi —
                    // "filial → xonalari" bolalik munosabati shundan ko'rinadi.
                    className={`group relative flex items-center gap-2 h-11 shrink-0 pl-2.5 pr-2 rounded-[10px] text-left cursor-pointer transition-colors duration-150 ${
                      on
                        ? "bg-blue-500 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50 max-lg:border max-lg:border-slate-200"
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
                      </div>
                    </div>
                  </div>
                </div>
                );
              })
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
          {/* Ish maydoni */}
          <div className="flex-1 min-h-0">
            {!step1 ? (
              <Guide step={1} t={t} />
            ) : (
              <ScheduleTimeline
                blocks={blocks}
                duration={duration}
                overrideDays={[]}
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

          {/* Pastki panel — ish maydonining pastki chetida, ajratuvchi chiziq bilan. */}
          <div className="hidden lg:flex items-center justify-end gap-3 -mx-4 -mb-4 px-4 py-3 border-t border-slate-200 rounded-b-2xl bg-slate-50/70">
            <IconButton
              variant="outlined"
              color="black"
              title={`${t("schedule.undo")} (Ctrl+Z)`}
              disabled={!history.length}
              onClick={undo}
            >
              <HiArrowUturnLeft />
            </IconButton>
            <Button
              variant="outlined"
              color="orange"
              className="gap-1.5"
              disabled={!centerAssignedCount}
              onClick={() => setResetOpen(true)}
            >
              <HiArrowPath className="text-base" />
              {t("schedule.reset")}
            </Button>
            <SaveStatus saving={savingIds.length > 0} count={assignedCount} t={t} />
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
                {t("group.rescheduleUnplaceOne")}
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

      {/* Qayta tartiblash — tasdiqdan keyin ochiq filialning har bir guruhi
          uchun alohida PATCH yuboriladi. Jarayon davomida modal yopilmaydi
          (non-dismissible) — faqat tugagach. */}
      <Dialog
        open={resetOpen}
        onClose={() => {
          if (!resetProgress) setResetOpen(false);
        }}
        title={t("schedule.reset")}
        actions={
          <>
            <Button
              color="black"
              variant="text"
              disabled={!!resetProgress}
              onClick={() => setResetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button color="orange" disabled={!!resetProgress} onClick={resetBoard}>
              {resetProgress
                ? t("group.rescheduleResetProgress", resetProgress)
                : t("schedule.reset")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5 text-sm text-slate-600">
          <p className="leading-relaxed">
            {t("group.rescheduleResetConfirm", { count: centerAssignedCount })}
          </p>
          {centerAssignedCount > 0 && !resetProgress && (
            <p className="px-3 py-2.5 rounded-xl bg-red-50 text-red-700 font-medium leading-relaxed">
              {t("group.rescheduleWillClear", { count: centerAssignedCount })}
            </p>
          )}
        </div>
      </Dialog>

    </div>
  );
}

// Saqlash indikatori — endi guruh darajasida (`savingIds`): kamida bitta
// guruh saqlanayotganda spinner, aks holda bosilgan darslar soni ko'rinadi.
// Server-keng "saved"/"error" holati yo'q — har amal o'z xatosini alohida
// toast bilan bildiradi.
function SaveStatus({ saving, count, t }) {
  const icon = saving ? (
    <HiArrowPath className="text-base animate-spin" />
  ) : (
    <HiCheckCircle className="text-base" />
  );
  const label = t(saving ? "schedule.saving" : "schedule.autoSave");
  return (
    <div
      className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm font-medium bg-slate-100 text-slate-500"
      aria-live="polite"
    >
      {icon}
      {label}
      <span className="px-1.5 rounded-full bg-black/5 text-xs tabular-nums">{count}</span>
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
        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500 truncate">
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
