function NumberText({ children, className = "", ...props }) {
  return (
    <span
      {...props}
      className={`font-semibold font-jet text-sm text-black dark:text-slate-100 ${className}`}
    >
      {children}
    </span>
  );
}

export default NumberText;
