// Lenta kartasidagi kichik amal tugmasi ("Ro'yxat", "Davomat"...).
export const MiniAction = ({ children, onClick }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="mt-2 inline-flex items-center px-3 h-7 rounded-lg text-[12px] font-extrabold bg-accent text-accent-fg active:opacity-80"
  >
    {children}
  </button>
);
