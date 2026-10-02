import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineCalendarDays, HiChevronRight } from "react-icons/hi2";
import { Card, Pill } from "./Card";

// "Bugun" — bugungi darslar ro'yxati (qora hero-karta). Home va Child sahifalarida umumiy.
// lessons: [{ entryId, name, startTime, status, student:{ _id, fullName } }]
// showStudent — bir nechta farzand bo'lganda ism ko'rsatiladi (Home).
// tab — dars bosilganda guruh sahifasining qaysi tabi ochilsin.
export const TodayCard = ({ lessons, showStudent = true, tab = "attendance" }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Card className="bg-hero text-hero-fg border-transparent">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-white/10 grid place-items-center"><HiOutlineCalendarDays className="w-4 h-4" /></span>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-hero-fg-mut">{t("home.today")}</div>
        {lessons.length > 0 && <span className="ml-auto text-[11px] font-bold bg-white/12 rounded-full px-2 py-0.5 tabular">{lessons.length}</span>}
      </div>
      {lessons.length === 0 ? (
        <div className="font-bold mt-2.5 text-[15px]">{t("home.noLessonsToday")}</div>
      ) : (
        <div className="mt-2.5 divide-y divide-white/10">
          {lessons.map((l) => (
            <button
              type="button"
              key={l.entryId}
              onClick={() => navigate(`/child/${l.student._id}/group/${l.entryId}/${tab}`)}
              className="w-full text-left flex items-center gap-3 tabular py-2 first:pt-0 last:pb-0 active:opacity-70"
            >
              <span className="font-extrabold shrink-0 w-12 text-[15px]">{l.startTime}</span>
              <span className="min-w-0 flex-1 break-words">
                <span className="block text-sm font-semibold leading-tight font-sans">{l.name}</span>
                {showStudent ? (
                  <span className="block text-xs text-hero-fg-mut mt-0.5 font-sans">{l.student.fullName.split(" ")[0]}</span>
                ) : l.endTime ? (
                  <span className="block text-xs text-hero-fg-mut mt-0.5">{l.startTime}–{l.endTime}</span>
                ) : null}
              </span>
              {l.status === "present" && <Pill tone="ok">{t("att.present")}</Pill>}
              {l.status === "absent" && <Pill tone="bad">{t("att.absent")}</Pill>}
              {l.status === "excused" && <Pill tone="warn">{t("att.excused")}</Pill>}
              <HiChevronRight className="w-4 h-4 text-hero-fg-mut shrink-0" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};
