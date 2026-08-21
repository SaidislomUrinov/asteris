function NumberText({ children, className = "", ...props }) {
  return (
    <span
      {...props}
      className={`font-semibold font-jet text-sm text-black ${className}`}
    >
      {children}
    </span>
  );
}

export default NumberText;
