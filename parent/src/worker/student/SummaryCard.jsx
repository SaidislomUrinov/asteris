import { useTranslation } from "react-i18next";
import { Card, Pill } from "../../components/Card";
import { cn } from "../../utils/cn";
import { Num } from "../../components/Num";

// Bitta guruh bo'yicha davomat va baho xulosasi.
export const SummaryCard = ({ name, att, grade }) => {
  const { t } = useTranslation();
  const marked = att ? att.present + att.absent + att.excused : 0;
  const rate = marked ? Math.round((att.present / marked) * 100) : null;
  return (
    <Card className="flex flex-col gap-2">
      <div className="font-title font-bold text-[15px] leading-tight break-words">{name}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-ink/6 px-3 py-2 min-w-0">
          <div className="text-[11px] font-bold text-hint truncate">{t("worker.student.attendance")}</div>
          <div className={cn("tabular font-bold text-[18px]", rate != null && (rate >= 80 ? "text-ok" : rate < 60 ? "text-bad" : "text-warn"))}>
            {rate == null ? "—" : `${rate}%`}
          </div>
        </div>
        <div className="rounded-xl bg-ink/6 px-3 py-2 min-w-0">
          <div className="text-[11px] font-bold text-hint truncate">{t("worker.student.gradeAvg")}</div>
          <div className="tabular font-bold text-[18px]">
            {grade?.count ? grade.average : "—"}
            {grade?.count ? <span className="text-[12px] text-hint font-bold"> / 10</span> : null}
          </div>
        </div>
      </div>
      {att && marked > 0 && (
        <div className="flex flex-wrap gap-1">
          {["present", "absent", "excused"].map((k) =>
            att[k] > 0 ? (
              <Pill key={k} tone={{ present: "ok", absent: "bad", excused: "warn" }[k]}>
                <Num text={t(`worker.att.count.${k}`, { count: att[k] })} v={String(att[k])} />
              </Pill>
            ) : null,
          )}
          {att.late > 0 && <Pill tone="warn"><Num text={t("worker.att.count.late", { count: att.late })} v={String(att.late)} /></Pill>}
          {grade?.count > 0 && <Pill tone="acc"><Num text={t("worker.student.gradesCount", { count: grade.count })} v={String(grade.count)} /></Pill>}
        </div>
      )}
    </Card>
  );
};
