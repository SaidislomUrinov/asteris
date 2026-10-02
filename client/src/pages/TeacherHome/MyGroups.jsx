import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { HiClock, HiHome, HiUserGroup, HiUsers } from "react-icons/hi2";
import { groupCode } from "./lessonTime";

// Dastlab shuncha karta ko'rsatiladi — qolgani "Barchasini ko'rish" bilan
// shu joyning o'zida ochiladi (alohida sahifaga o'tkazilmaydi: `/groups`
// ro'yxati o'qituvchida ruxsatga bog'liq).
const INITIAL = 6;
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * "Mening guruhlarim" — o'qituvchining barcha faol va yig'ilayotgan guruhlari
 * ixcham kartalarda: fan, ID, holat, jadval, o'quvchilar soni, xona.
 *
 * @param {Object} props
 * @param {Array} props.groups - API `groups[]`
 */
function MyGroups({ groups }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Faol guruhlar birinchi, keyin yig'ilayotganlar; har birida dars vaqti bo'yicha.
  const sorted = [...groups].sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      (a.startTime || "99").localeCompare(b.startTime || "99"),
  );
  const visible = expanded ? sorted : sorted.slice(0, INITIAL);

  return (
    <section className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">{t("teacherHome.myGroupsTitle")}</h2>
        {groups.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
            {groups.length}
          </span>
        )}
      </header>

      {groups.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 rounded-xl border border-dashed border-slate-200">
          <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-slate-50 text-lg text-slate-400">
            <HiUserGroup aria-hidden="true" />
          </span>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-medium text-slate-700">{t("teacherHome.noGroups")}</p>
            <p className="text-xs text-slate-400">{t("teacherHome.noGroupsHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map((g) => {
              const code = groupCode(g);
              const active = g.status === "active";
              const days = DAY_ORDER.filter((d) => g.days?.includes(d));
              return (
                <li key={g._id} className="min-w-0">
                  <Link
                    to={`/groups/${g._id}`}
                    className="flex flex-col gap-2.5 h-full p-3.5 rounded-xl border border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-slate-900 truncate">{g.subject || g.label}</span>
                        {code && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 font-jet text-[11px] font-medium text-slate-500">
                            #{code}
                          </span>
                        )}
                      </div>
                      <span
                        className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          active ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-orange-400"}`}
                          aria-hidden="true"
                        />
                        {t(active ? "group.statusActive" : "group.statusPending")}
                      </span>
                    </div>

                    {/* Jadval: kunlar + vaqt */}
                    <div className="flex items-center gap-2 min-w-0 text-xs text-slate-600">
                      <HiClock className="shrink-0 text-slate-400" aria-hidden="true" />
                      {days.length > 0 ? (
                        <span className="truncate">{days.map((d) => t(`group.dayShort.${d}`)).join(" · ")}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {g.startTime && (
                        <span className="shrink-0 font-jet text-slate-500">
                          {g.startTime}–{g.endTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <HiUsers className="text-slate-400" aria-hidden="true" />
                        {g.maxStudents ? (
                          <span className="font-jet">
                            {g.studentsCount}/{g.maxStudents}
                          </span>
                        ) : (
                          t("group.studentsShort", { count: g.studentsCount })
                        )}
                      </span>
                      {g.room?.name && (
                        <span className="flex items-center gap-1 min-w-0">
                          <HiHome className="text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate">{g.room.name}</span>
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {sorted.length > INITIAL && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-center h-10 px-4 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              {expanded ? t("teacherHome.showLess") : t("teacherHome.showAll", { count: sorted.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default MyGroups;
