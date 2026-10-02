import { cn } from "../utils/cn";

// Sahifa konteyneri: 16px yon bo'shliq; tab bar bo'lsa pastdan joy qoldiradi.
export const Page = ({ title, subtitle, right, children, className, withTabBar = true }) => (
  <div
    className={cn("w-full max-w-lg mx-auto px-4 pt-3 flex flex-col gap-3", className)}
    style={{ paddingBottom: withTabBar ? "calc(84px + env(safe-area-inset-bottom))" : "24px" }}
  >
    {(title || right) && (
      <header className="flex items-start justify-between gap-3 mb-0.5">
        <div className="min-w-0">
          {title && <h1 className="text-[22px] font-extrabold text-ink leading-tight tracking-tight break-words">{title}</h1>}
          {subtitle && <div className="text-[13px] text-hint mt-1 break-words">{subtitle}</div>}
        </div>
        {right}
      </header>
    )}
    {children}
  </div>
);
