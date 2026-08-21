import { toMinutes } from "../../utils/schedule";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Guruh holati — kartadagi rang, badge va tartiblash shu qiymatlarga bog'liq.
// Rooms'dagi ROOM_STATE bilan bir xil g'oya, lekin guruh o'z status'iga
// (pending/active/finished) ham ega, shuning uchun holatlar ko'proq.
export const GROUP_STATE = {
  LIVE: "live", // hozir dars ketyapti
  UPCOMING: "upcoming", // bugun, SOON_MIN ichida boshlanadi
  ACTIVE: "active", // start berilgan, lekin hozir dars emas
  PENDING: "pending", // yig'ilmoqda (hali start berilmagan)
  FINISHED: "finished", // yakunlangan
};

const SOON_MIN = 60;

/**
 * Guruhning JONLI holati — hozirgi dars progressi va keyingi dars.
 * Yangi endpoint kerak emas: `days`/`startTime`/`endTime`/`status` allaqachon
 * `GET /api/groups` javobida bor.
 *
 * @param {Object} group
 * @param {{day: string, time: string}} now - getTashkentNow() natijasi
 */
export function buildGroupLive(group, now) {
  if (group.status === "finished") return { state: GROUP_STATE.FINISHED, current: null, next: null };

  const hasSchedule = group.days?.length && group.startTime && group.endTime;
  if (!hasSchedule) {
    return {
      state: group.status === "pending" ? GROUP_STATE.PENDING : GROUP_STATE.ACTIVE,
      current: null,
      next: null,
    };
  }

  const nowMin = toMinutes(now.time);
  const startMin = toMinutes(group.startTime);
  const endMin = toMinutes(group.endTime);
  const isToday = group.days.includes(now.day);

  // Dars vaqti faqat "active" guruhlar uchun jonli hisoblanadi — pending
  // guruhda jadval bor bo'lsa ham hali dars boshlanmagan.
  if (group.status === "active" && isToday && nowMin >= startMin && nowMin <= endMin) {
    return {
      state: GROUP_STATE.LIVE,
      current: {
        progress: Math.min(100, Math.max(0, ((nowMin - startMin) / (endMin - startMin)) * 100)),
        remainingMin: Math.max(0, endMin - nowMin),
      },
      next: null,
    };
  }

  const next = findNext(group.days, startMin, nowMin, now.day);
  const soon =
    group.status === "active" && isToday && startMin > nowMin && startMin - nowMin <= SOON_MIN;

  return {
    state: soon
      ? GROUP_STATE.UPCOMING
      : group.status === "pending"
        ? GROUP_STATE.PENDING
        : GROUP_STATE.ACTIVE,
    current: null,
    next,
  };
}

// Keyingi dars: bugun kechroq bo'lsa bugun, aks holda keyingi dars kuni.
function findNext(days, startMin, nowMin, today) {
  const todayIndex = DAYS.indexOf(today);
  if (todayIndex < 0) return null;
  if (days.includes(today) && startMin > nowMin) return { day: null };
  for (let offset = 1; offset <= 7; offset++) {
    const day = DAYS[(todayIndex + offset) % 7];
    if (days.includes(day)) return { day };
  }
  return null;
}

// Kartalar tartibi: jonli dars birinchi.
export const STATE_ORDER = {
  [GROUP_STATE.LIVE]: 0,
  [GROUP_STATE.UPCOMING]: 1,
  [GROUP_STATE.ACTIVE]: 2,
  [GROUP_STATE.PENDING]: 3,
  [GROUP_STATE.FINISHED]: 4,
};
