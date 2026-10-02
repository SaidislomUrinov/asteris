import { cn } from "../utils/cn";

export const Button = ({ variant = "primary", className, loading, disabled, children, ...rest }) => {
  const variants = {
    primary: "bg-accent text-accent-fg",
    soft: "bg-accent/10 text-accent",
    danger: "bg-bad-bg text-bad",
    ghost: "bg-transparent text-accent",
  };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "w-full rounded-xl px-4 py-3 font-bold text-[15px] flex items-center justify-center gap-2 transition-opacity active:opacity-75 disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading && <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {children}
    </button>
  );
};
