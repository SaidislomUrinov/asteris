import { useTranslation } from "react-i18next";
import { HiOutlineTrash } from "react-icons/hi2";
import { Avatar, Pill } from "../../components/Card";
import { initials } from "../../utils/format";
import { photoSrc } from "../../lib/studentPhoto";
import { cn } from "../../utils/cn";
import { Num } from "../../components/Num";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Baholar tabidagi o'quvchi qatori: kelmagan bo'lsa pill (baho yo'q), aks
// holda qiymat; ochilsa 1–10 tez tanlash va (ruxsat bo'lsa) o'chirish.
export const GradeRow = ({ name, photo, tone = 0, avg, value, blocked, open, editable, deletable, busy, onToggle, onRate, onRemove }) => {
  const { t } = useTranslation();
  const interactive = !blocked && (editable || (deletable && value));
  return (
    <div className={cn("py-2.5", blocked && "opacity-60")}>
      <button
        type="button"
        disabled={!interactive}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 text-left disabled:cursor-default active:opacity-80"
      >
        <Avatar text={initials(name)} tone={tone} src={photoSrc(photo)} alt={name} className="w-9 h-9 text-[12px]" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[14.5px] leading-tight truncate">{name}</div>
          <div className="text-[12px] text-hint mt-0.5">{avg ? <Num text={t("worker.grades.avg", { v: avg })} v={String(avg)} /> : t("worker.grades.noAvg")}</div>
        </div>
        {blocked ? (
          <Pill tone={blocked === "excused" ? "warn" : "bad"}>{t(`worker.att.status.${blocked}`)}</Pill>
        ) : value ? (
          <span className="w-10 h-10 rounded-xl grid place-items-center tabular font-bold text-[17px] bg-ok-bg text-ok shrink-0">
            {value}
          </span>
        ) : (
          <Pill tone={editable ? "warn" : "mut"}>{t("worker.grades.pending")}</Pill>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2 mt-2.5">
          {editable && (
            <div className="grid grid-cols-5 gap-2">
              {VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={busy}
                  onClick={() => onRate(v)}
                  className={cn(
                    "h-11 rounded-xl tabular font-bold text-[16px] active:opacity-80 disabled:opacity-50",
                    value === v ? "bg-accent text-accent-fg" : "bg-ink/6 text-ink",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {deletable && value && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="self-start inline-flex items-center gap-1 px-3 h-9 rounded-xl text-[13px] font-bold text-bad bg-bad-bg disabled:opacity-50"
            >
              <HiOutlineTrash className="w-4 h-4" />
              {t("worker.group.grades.remove")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
