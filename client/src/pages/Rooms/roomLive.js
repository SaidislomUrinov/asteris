import { toMinutes } from "../../utils/schedule";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Xona holati — kartadagi rang, badge va tartiblash shu qiymatlarga bog'liq.
export const ROOM_STATE = {
  ACTIVE: "active", // hozir dars ketyapti
  UPCOMING: "upcoming", // yaqin orada (SOON_MIN ichida) dars boshlanadi
  AVAILABLE: "available", // bo'sh
  MAINTENANCE: "maintenance", // room.status === "inactive"
};

// Shu daqiqadan keyin boshlanadigan dars "yaqin orada" hisoblanadi.
const SOON_MIN = 60;

/**
 * Bitta xonaning JONLI holati — hozirgi dars, keyingi dars, progress.
 *
 * Yangi endpoint qo'shilmadi: sahifa allaqachon `/groups?status=active` ni
 * (band xonani aniqlash uchun) so'raydi va o'sha javobda kun/vaqt/xona bor.
 * Fan va o'qituvchi NOMI guruh DTO'sida yo'q (faqat ObjectId), shuning uchun
 * nomlar mavjud `/subjects` va `/staffs/lookup` lookuplaridan olinadi —
 * RoomDetail.jsx'dagi bilan bir xil naqsh.
 *
 * @param {Object} room
 * @param {Array} roomGroups - shu xonaning faol guruhlari
 * @param {{day: string, time: string}} now - getTashkentNow() natijasi
 * @param {(g: any) => string} labelOf
 * @param {(g: any) => string} teacherOf
 */
export function buildRoomLive(room, roomGroups, now, labelOf, teacherOf) {
  if (room.status === "inactive") {
    return { state: ROOM_STATE.MAINTENANCE, current: null, next: null };
  }

  const nowMin = toMinutes(now.time);
  const todayIndex = DAYS.indexOf(now.day);

  const scheduled = roomGroups
    .filter((g) => g.days?.length && g.startTime && g.endTime)
    .map((g) => ({
      group: g,
      label: labelOf(g),
      teacher: teacherOf(g),
      startMin: toMinutes(g.startTime),
      endMin: toMinutes(g.endTime),
    }))
    .filter((g) => g.endMin > g.startMin);

  const today = scheduled
    .filter((g) => g.group.days.includes(now.day))
    .sort((a, b) => a.startMin - b.startMin);

  const running = today.find((g) => nowMin >= g.startMin && nowMin <= g.endMin);
  if (running) {
    const total = running.endMin - running.startMin;
    return {
      state: ROOM_STATE.ACTIVE,
      current: {
        ...running,
        progress: Math.min(100, Math.max(0, ((nowMin - running.startMin) / total) * 100)),
        remainingMin: Math.max(0, running.endMin - nowMin),
      },
      next: today.find((g) => g.startMin > running.endMin) || findNextDay(scheduled, todayIndex),
    };
  }

  // Bugun keyinroq bo'ladigan eng yaqin dars; bugun qolmagan bo'lsa
  // keyingi kunlardan qidiriladi (kartada "keyingi dars" doim ko'rinsin).
  const laterToday = today.find((g) => g.startMin > nowMin);
  const next = laterToday || findNextDay(scheduled, todayIndex);

  const soon = laterToday && laterToday.startMin - nowMin <= SOON_MIN;
  return {
    state: soon ? ROOM_STATE.UPCOMING : ROOM_STATE.AVAILABLE,
    current: null,
    next: next ? { ...next, startsInMin: laterToday ? laterToday.startMin - nowMin : null } : null,
  };
}

// Bugundan keyingi 6 kun ichidagi eng yaqin darsni topadi (hafta aylanadi).
function findNextDay(scheduled, todayIndex) {
  if (todayIndex < 0) return null;
  for (let offset = 1; offset <= 6; offset++) {
    const day = DAYS[(todayIndex + offset) % 7];
    const dayGroups = scheduled
      .filter((g) => g.group.days.includes(day))
      .sort((a, b) => a.startMin - b.startMin);
    if (dayGroups.length) return { ...dayGroups[0], day };
  }
  return null;
}

// Kartalar tartibi: hozir dars ketayotgan xonalar birinchi, keyin yaqin
// orada boshlanadiganlar — administrator jonli faoliyatni birinchi ko'radi.
export const STATE_ORDER = {
  [ROOM_STATE.ACTIVE]: 0,
  [ROOM_STATE.UPCOMING]: 1,
  [ROOM_STATE.AVAILABLE]: 2,
  [ROOM_STATE.MAINTENANCE]: 3,
};
