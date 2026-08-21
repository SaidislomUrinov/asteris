import { useTranslation } from "react-i18next";
import {
  HiBuildingOffice2,
  HiHome,
  HiOutlineClock,
  HiUserGroup,
  HiUsers,
  HiWrenchScrewdriver,
} from "react-icons/hi2";
import { ROOM_STATE } from "./roomLive";
import { formatRemaining } from "../../utils/schedule";

// Holat → rang. Karta HECH QACHON to'liq rangga bo'yalmaydi: rang faqat
// chap chekka chizig'i, badge va progress barда ishlatiladi — shu tufayli
// gridda o'nlab karta yonma-yon turganda ham ko'z charchamaydi.
const STATE_STYLE = {
  [ROOM_STATE.ACTIVE]: {
    edge: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
    dot: "bg-blue-500",
    icon: "bg-blue-50 text-blue-600",
    bar: "bg-blue-500",
    labelKey: "room.stateActive",
  },
  [ROOM_STATE.UPCOMING]: {
    edge: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
    dot: "bg-amber-500",
    icon: "bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
    labelKey: "room.stateUpcoming",
  },
  [ROOM_STATE.AVAILABLE]: {
    edge: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
    icon: "bg-slate-100 text-slate-400",
    bar: "bg-emerald-500",
    labelKey: "room.stateAvailable",
  },
  [ROOM_STATE.MAINTENANCE]: {
    edge: "bg-red-400",
    badge: "bg-red-50 text-red-700 ring-red-100",
    dot: "bg-red-500",
    icon: "bg-red-50 text-red-500",
    bar: "bg-red-500",
    labelKey: "room.stateMaintenance",
  },
};

function Stat({ icon, value, label }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-slate-900 font-semibold text-[15px] leading-none">
        <span className="text-slate-300 text-sm shrink-0">{icon}</span>
        {value}
      </span>
      <span className="text-[11px] text-slate-400 truncate">{label}</span>
    </div>
  );
}

/**
 * Xona kartasi — jonli sinf faoliyatiga urg'u beradi.
 *
 * @param {Object} props
 * @param {Object} props.room
 * @param {string} [props.centerName]
 * @param {number} props.groupsCount
 * @param {number} props.studentsCount
 * @param {{state: string, current: Object|null, next: Object|null}} props.live - buildRoomLive() natijasi
 * @param {() => void} [props.onClick]
 */
function RoomCard({ room, centerName, groupsCount, studentsCount, live, onClick }) {
  const { t } = useTranslation();
  const s = STATE_STYLE[live.state] || STATE_STYLE[ROOM_STATE.AVAILABLE];
  const { current, next } = live;
  const isMaintenance = live.state === ROOM_STATE.MAINTENANCE;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col h-full w-full overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] hover:border-slate-300 ${
        isMaintenance ? "opacity-75" : ""
      }`}
    >
      {/* Holat chizig'i — kartani bo'yamasdan holatni bir qarashda bildiradi */}
      <span className={`absolute inset-y-0 left-0 w-1 ${s.edge}`} />

      <div className="flex flex-col gap-4 p-5 pl-6 flex-1">
        {/* Sarlavha: nom + filial + holat badge */}
        <div className="flex items-start gap-3 pr-9">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg ${s.icon}`}
          >
            {isMaintenance ? <HiWrenchScrewdriver /> : <HiHome />}
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight text-slate-900 truncate">{room.name}</h3>
            <span className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <HiBuildingOffice2 className="shrink-0" />
              {centerName || "—"}
            </span>
          </div>
        </div>

        <span
          className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${s.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {t(s.labelKey)}
        </span>

        {/* Jonli qism — kartaning eng muhim bloki */}
        {current ? (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 truncate">{current.label}</span>
              <span className="shrink-0 text-xs font-jet tabular-nums text-blue-600 font-semibold">
                {formatRemaining(t, current.remainingMin)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.bar} transition-[width] duration-500`}
                style={{ width: `${current.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="truncate">{current.teacher || t("group.noTeacher")}</span>
              <span className="shrink-0 font-jet tabular-nums">
                {current.group.startTime}–{current.group.endTime}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50/60 border border-slate-100 text-xs">
            <HiOutlineClock className="shrink-0 text-slate-300 text-base" />
            {next ? (
              <span className="flex items-center gap-1.5 min-w-0 text-slate-500">
                <span className="truncate">{next.label}</span>
                <span className="shrink-0 font-jet tabular-nums text-slate-700 font-semibold">
                  {next.day ? `${t(`group.dayShort.${next.day}`)} ` : ""}
                  {next.group.startTime}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">{t("room.noUpcoming")}</span>
            )}
          </div>
        )}

        {/* Statik ko'rsatkichlar — pastda, ikkilamchi darajada */}
        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-slate-100">
          <Stat icon={<HiUserGroup />} value={groupsCount} label={t("room.groupsCount")} />
          <Stat icon={<HiUsers />} value={studentsCount} label={t("room.studentsCount")} />
          <Stat
            icon={<HiUsers />}
            value={room.capacity != null ? room.capacity : "—"}
            label={t("room.capacity")}
          />
        </div>
      </div>
    </div>
  );
}

export default RoomCard;
