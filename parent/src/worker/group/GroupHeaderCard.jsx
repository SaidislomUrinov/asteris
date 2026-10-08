import { useTranslation } from "react-i18next";
import {
  HiOutlineClock, HiOutlineMapPin, HiOutlineUser, HiOutlineUserGroup, HiOutlineUsers, HiOutlinePaperAirplane,
} from "react-icons/hi2";
import { Card, Pill } from "../../components/Card";
import { openTelegramLink } from "../../lib/telegram";
import { groupLabel } from "../utils";
import { DayChips } from "../components/DayChips";
import { MetaLine as Meta } from "../components/MetaLine";

const STATUS_TONE = { active: "ok", pending: "warn", finished: "mut" };

// Guruh detali sarlavha kartasi (details §2): nom + holat, kunlar va vaqt,
// so'ng meta qatorlari (xona, o'qituvchi, yordamchi), pastda o'quvchilar
// soni va Telegram havolasi. Manba: GET /groups/:id; ismlar — GET /staffs/lookup.
export const GroupHeaderCard = ({ group: g, teacherName, assistantName, studentsCount }) => {
  const { t } = useTranslation();
  const count = studentsCount ?? g.studentsCount ?? 0;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[20px] font-extrabold leading-tight tracking-tight break-words min-w-0">{groupLabel(g)}</h2>
        <Pill tone={STATUS_TONE[g.status] || "mut"} className="shrink-0 mt-0.5">{t(`worker.group.status.${g.status}`)}</Pill>
      </div>
      {(g.days?.length > 0 || g.startTime) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <DayChips days={g.days} />
          {g.startTime && (
            <span className="inline-flex items-center gap-1 tabular text-[13px] font-bold">
              <HiOutlineClock className="w-[18px] h-[18px] text-hint" />
              {g.startTime}–{g.endTime || "—"}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 pt-3 border-t border-line/70">
        {g.roomName && <Meta icon={HiOutlineMapPin}>{g.roomName}</Meta>}
        <Meta icon={HiOutlineUser}>
          <span className={teacherName ? "font-bold" : "text-hint"}>{teacherName || t("worker.group.noTeacher")}</span>
        </Meta>
        {g.assistant && (
          <Meta icon={HiOutlineUsers}>
            <span className="text-hint">{t("worker.group.assistant")}: </span>
            <span className="font-bold">{assistantName || "—"}</span>
          </Meta>
        )}
        <Meta icon={HiOutlineUserGroup}>
          <span className="tabular font-bold">{count}{g.maxStudents ? ` / ${g.maxStudents}` : ""}</span>{" "}
          <span className="text-hint">{t("worker.group.studentsLabel")}</span>
        </Meta>
      </div>
      {g.telegramLink && (
        <button
          type="button"
          onClick={() => openTelegramLink(g.telegramLink)}
          className="self-start inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-accent/10 text-accent text-[13px] font-bold active:opacity-70"
        >
          <HiOutlinePaperAirplane className="w-4 h-4" />
          {t("worker.group.telegram")}
        </button>
      )}
    </Card>
  );
};
