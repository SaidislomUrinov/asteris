import { cn } from "../../utils/cn";

// Ixcham ro'yxat qatori: chapda sarlavha/izoh, o'ngda qiymat (JetBrains Mono).
// `leading` — ixtiyoriy chap element (masalan o'quvchi avatari); berilmasa qator o'zgarmaydi.
export const ListRow = ({ title, sub, right, rightTone, extra, leading, onClick, className }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full flex justify-between gap-3 py-2.5 text-left",
        leading ? "items-center" : "items-start",
        onClick && "active:opacity-70 transition-opacity",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[14px] truncate">{title}</div>
        {sub && <div className="text-[12.5px] text-hint truncate">{sub}</div>}
        {extra}
      </div>
      {right != null && (
        <div
          className={cn(
            "tabular font-bold text-[14px] shrink-0",
            rightTone === "ok" && "text-ok",
            rightTone === "bad" && "text-bad",
          )}
        >
          {right}
        </div>
      )}
    </Tag>
  );
};
