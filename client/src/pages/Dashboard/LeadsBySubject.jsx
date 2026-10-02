import { useTranslation } from "react-i18next";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";

// Oy davomida qaysi fanga qancha odam kelgani va ulardan nechtasi guruhga
// o'tgani — guruh ochish kerak bo'lgan fanlarni ko'rsatadi.
function LeadsBySubject({ rows = [], subjectNames = {} }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full min-h-0">
      <div className="shrink-0">
        <p className="font-semibold text-slate-800">{t("lead.dashBySubject")}</p>
        <p className="text-xs text-slate-400">{t("lead.dashBySubjectDesc")}</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 py-6 text-slate-400">
          <HiOutlineViewfinderCircle className="text-3xl text-slate-300" />
          <p className="text-sm">{t("lead.dashEmpty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.subject} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-slate-700 truncate">{subjectNames[r.subject] || "—"}</span>
                <span className="shrink-0 text-slate-500 tabular-nums">
                  <span className="font-semibold text-slate-800">{r.total}</span>
                  <span className="text-xs"> · {t("lead.dashEnrolledOf", { count: r.enrolled })}</span>
                </span>
              </div>
              {/* Tashqi chiziq — kelganlar, ichidagi yashil qism — guruhga o'tganlar. */}
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="relative h-full rounded-full bg-blue-200" style={{ width: `${(r.total / max) * 100}%` }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                    style={{ width: `${(r.enrolled / r.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeadsBySubject;
