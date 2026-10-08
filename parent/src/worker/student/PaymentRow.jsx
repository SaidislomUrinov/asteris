import { useTranslation } from "react-i18next";
import { Pill } from "../../components/Card";
import { fmtDate, fmtMonth, fmtTime, money } from "../../utils/format";
import { cn } from "../../utils/cn";

// To'lov tarixi qatori: sana, summa, tur, oy, guruh; bekor qilingani xira.
export const PaymentRow = ({ payment: p, groupName }) => {
  const { t } = useTranslation();
  const paid = p.status === "paid";
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2.5", !paid && "opacity-55")}>
      <div className="min-w-0 flex-1">
        <div className={cn("font-bold text-[14px] truncate", !paid && "line-through")}>{groupName}</div>
        <div className="text-[12px] text-hint truncate mt-0.5">
          {[
            `${fmtDate(p.date)} ${fmtTime(p.date)}`,
            t(`worker.payType.${p.type}`, { defaultValue: p.type }),
            p.forMonth && t("worker.student.forMonth", { month: fmtMonth(p.forMonth) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {p.note && <div className="text-[12px] text-hint break-words">{p.note}</div>}
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className={cn("tabular font-bold text-[15px] whitespace-nowrap", paid ? "text-ok" : "line-through text-hint")}>
          +{money(p.amount)}
        </span>
        {!paid && <Pill tone="bad">{t(`worker.student.payStatus.${p.status}`, { defaultValue: p.status })}</Pill>}
      </div>
    </div>
  );
};
