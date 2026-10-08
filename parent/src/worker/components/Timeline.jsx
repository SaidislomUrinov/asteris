// "Bugun" lentasi konteyneri: chapda vertikal chiziq (rail). Ustunlar:
// vaqt (44px) · nuqta (16px) · karta.
export const Timeline = ({ children }) => (
  <div className="relative flex flex-col gap-2">
    <div className="absolute left-[51px] top-2 bottom-2 w-0.5 rounded-full bg-line" aria-hidden="true" />
    {children}
  </div>
);
