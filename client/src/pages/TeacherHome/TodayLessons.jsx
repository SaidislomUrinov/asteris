import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { HiCalendarDays, HiChevronRight, HiHome, HiUsers } from "react-icons/hi2";
import { groupCode, lessonState } from "./lessonTime";

const CARD = {
  ongoing: "border-blue-200 bg-blue-50/60 hover:bg-blue-50",
  upcoming: "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/60",
  finished: "border-slate-200/70 bg-slate-50/40 opacity-70 hover:opacity-100",
};
const STATUS = {
  ongoing: "bg-blue-600 text-white",
  upcoming: "bg-slate-100 text-slate-600",
  finished: "bg-transparent text-slate-400 ring-1 ring-inset ring-slate-200",
};

/**
 * "Bugungi darslar" — sahifaning asosiy bo'limi. Har dars alohida bosiladigan
 * karta (`/groups/:id`): chapda vaqt, o'rtada fan + guruh ID + o'quvchi/xona,
 * o'ngda holat. Hozir ketayotgan dars ko'k fon va pulslovchi nuqta bilan ajraladi.
 *
 * @param {Object} props
 * @param {Array} props.lessons - `todayLessons` (API vaqt bo'yicha tartiblangan)
 * @param {number} props.mins - hozirgi vaqt, kun boshidan daqiqalarda
 */
function TodayLessons({ lessons, mins }) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">{t("teacherHome.todayLessons")}</h2>
        {lessons.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
            {t("teacherHome.lessonsCount", { count: lessons.length })}
          </span>
        )}
      </header>

      {lessons.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 rounded-xl border border-dashed border-slate-200">
          <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-slate-50 text-lg text-slate-400">
            <HiCalendarDays aria-hidden="true" />
          </span>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium text-slate-700">{t("teacherHome.noLessonsToday")}</p>
            <p className="text-xs text-slate-400">{t("teacherHome.todayEmptyHint")}</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lessons.map((g) => {
            const state = lessonState(g, mins);
            const code = groupCode(g);
            return (
              <li key={g._id}>
                <Link
                  to={`/groups/${g._id}`}
                  className={`group flex items-center gap-3 sm:gap-4 p-3 sm:px-4 rounded-xl border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${CARD[state]}`}
                >
                  {/* Vaqt ustuni */}
                  <div
                    className={`flex flex-col items-start shrink-0 w-14 pr-3 border-r-2 ${
                      state === "ongoing" ? "border-blue-500" : "border-slate-200"
                    }`}
                  >
                    <span
                      className={`font-jet font-semibold text-[15px] leading-none ${
                        state === "ongoing" ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {g.startTime || "—"}
                    </span>
                    <span className="font-jet text-xs text-slate-400 leading-none mt-1.5">
                      {g.endTime || ""}
                    </span>
                  </div>

                  {/* Guruh ma'lumoti */}
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-slate-900 truncate">{g.subject || g.label}</span>
                      {code && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 font-jet text-[11px] font-medium text-slate-500">
                          #{code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <HiUsers className="text-slate-400" aria-hidden="true" />
                        {t("group.studentsShort", { count: g.studentsCount })}
                      </span>
                      {g.room?.name && (
                        <span className="flex items-center gap-1 min-w-0">
                          <HiHome className="text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{g.room.name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Holat */}
                  <span
                    className={`flex items-center gap-1.5 shrink-0 px-2.5 h-7 rounded-full text-xs font-medium ${STATUS[state]}`}
                  >
                    {state === "ongoing" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                    )}
                    {t(`dashboard.lessonStatus.${state}`)}
                  </span>
                  <HiChevronRight
                    className="hidden sm:block shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default TodayLessons;
