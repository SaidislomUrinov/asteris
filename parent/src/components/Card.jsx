import { createElement, useState } from "react";
import { cn } from "../utils/cn";

export const Card = ({ className, children, onClick, as = "div", ...rest }) => {
  const Tag = as;
  return (
  <Tag
    onClick={onClick}
    className={cn(
      "bg-card rounded-2xl p-3.5 text-ink border border-line/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      onClick && "active:scale-[0.985] active:opacity-90 transition-[transform,opacity] duration-100 cursor-pointer w-full text-left",
      className,
    )}
    {...rest}
  >
    {children}
  </Tag>
  );
};

export const SectionLabel = ({ children, className, right }) => (
  <div className={cn("flex items-center justify-between gap-2 px-1 mt-1", className)}>
    <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-hint">{children}</div>
    {right}
  </div>
);

export const Divider = ({ className }) => <div className={cn("h-px bg-line my-2.5", className)} />;

export const Pill = ({ tone = "mut", children, className }) => {
  const tones = {
    ok: "bg-ok-bg text-ok",
    bad: "bg-bad-bg text-bad",
    warn: "bg-warn-bg text-warn",
    mut: "bg-ink/6 text-hint",
    acc: "bg-accent/10 text-accent",
  };
  return (
    <span className={cn("inline-block text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
};

// `src` berilsa — rasm (bir xil o'lcham/shakl, object-cover), aks holda initsiallar.
// Rasm yuklanmasa (404/tarmoq) — shu `src` uchun initsiallarga qaytadi; `src`
// o'zgarsa (yangi rasm) qayta urinadi.
export const Avatar = ({ text, tone = 0, src, alt = "", className }) => {
  const [failedSrc, setFailedSrc] = useState("");
  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={cn("w-10 h-10 rounded-xl object-cover bg-ink/6 shrink-0", className)}
      />
    );
  }
  const tones = [
    "bg-accent/10 text-accent",
    "bg-purple-500/10 text-purple-600 dark:text-purple-300",
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  ];
  return (
    <div className={cn("w-10 h-10 rounded-xl grid place-items-center font-extrabold text-sm shrink-0", tones[tone % tones.length], className)}>
      {text}
    </div>
  );
};

// Ikonkali kvadrat quti — ro'yxat kartalarida chap tomonda.
export const IconBox = ({ Icon, tone = "acc", className }) => {
  const tones = {
    acc: "bg-accent/10 text-accent",
    ok: "bg-ok-bg text-ok",
    bad: "bg-bad-bg text-bad",
    warn: "bg-warn-bg text-warn",
    mut: "bg-ink/6 text-hint",
  };
  return (
    <div className={cn("w-10 h-10 rounded-xl grid place-items-center shrink-0", tones[tone], className)}>
      {createElement(Icon, { className: "w-5 h-5" })}
    </div>
  );
};

export const KV = ({ label, value, className, valueClassName }) => (
  <div className={cn("flex justify-between items-start gap-3 py-1.5", className)}>
    <span className="text-hint text-sm min-w-0 break-words">{label}</span>
    <span className={cn("font-bold text-sm text-right shrink-0", valueClassName)}>{value}</span>
  </div>
);
