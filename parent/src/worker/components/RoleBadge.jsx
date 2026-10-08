// Rol belgisi: rang nuqta + "ROL · FILIAL". Rol rangi shu yerda ishlatiladi.
export const RoleBadge = ({ color, children }) => (
  <span
    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.06em] uppercase min-w-0 max-w-full"
    style={{ color }}
  >
    <i className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
    <span className="truncate">{children}</span>
  </span>
);
