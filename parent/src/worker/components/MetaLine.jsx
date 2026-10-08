import { createElement } from "react";

// Ikonka + matn qatori (sarlavha kartalarida).
export const MetaLine = ({ icon, children }) => (
  <div className="flex items-start gap-2 text-[13.5px] leading-5 min-w-0">
    {createElement(icon, { className: "w-[18px] h-[18px] text-hint shrink-0 mt-px" })}
    <span className="min-w-0 break-words">{children}</span>
  </div>
);
