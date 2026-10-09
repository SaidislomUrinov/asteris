import { cn } from "../../utils/cn";
import { Num } from "../../components/Num";

// Lenta kartasi ichki qatori: sarlavha (+ o'ng tomonda summa) va izoh.
export const EventTitle = ({ title, amount, amountTone = "ok", sub, subNum }) => (
  <>
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <b className="font-title text-[14px] font-bold truncate min-w-0">{title}</b>
      {amount && (
        <span className={cn("tabular font-bold text-[13px] shrink-0", amountTone === "bad" ? "text-bad" : "text-ok")}>
          {amount}
        </span>
      )}
    </div>
    {sub && <div className="text-[12.5px] text-hint truncate"><Num text={sub} v={subNum} /></div>}
  </>
);
