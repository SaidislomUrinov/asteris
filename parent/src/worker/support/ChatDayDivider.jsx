import { chatDayLabel } from "./chatUtils";

// Sana ajratgichi — kun almashganda xabarlar orasida.
export const ChatDayDivider = ({ day }) => (
  <div className="self-center my-2 px-3 py-0.5 rounded-full bg-ink/6 text-[12px] font-semibold text-hint">{chatDayLabel(day)}</div>
);
