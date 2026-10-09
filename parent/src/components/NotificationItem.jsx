import { useNavigate } from "react-router-dom";
import { fmtTime } from "../utils/format";
import { cn } from "../utils/cn";
import { BadgeIcon } from "./BadgeIcon";
import { BADGE_PALETTE } from "../utils/badges";

// Bosilganda tegishli guruh sahifasiga o'tadigan turlar (student roli).
const OPEN_PATH = {
  "parent:homework": (d) => `/child/${d.studentId}/group/${d.entryId}/homework`,
  "parent:lessonReminder": (d) => `/child/${d.studentId}/group/${d.entryId}/homework`,
  // Yutuq nishonlari — ikkala rol uchun (API_CONTRACT_badges_monthly_rank.md §C)
  "parent:badge": (d) => `/child/${d.studentId}/group/${d.entryId}/badges`,
};

const DOT = {
  "parent:attendance": (n) => (n.data?.status === "absent" ? "bg-bad" : n.data?.status === "excused" ? "bg-warn" : "bg-ok"),
  "parent:payment": () => "bg-accent",
  "parent:lessonFinished": () => "bg-accent",
  "parent:debt": () => "bg-bad",
  "parent:homework": () => "bg-accent",
  "parent:lessonReminder": () => "bg-warn",
  "parent:badge": () => "bg-amber-400",
};

const strip = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .trim();

// clickable=false — allaqachon bosiladigan konteyner ichida (masalan bosh
// sahifadagi "So'nggi xabarlar" karta-tugmasi) ichki <button> qo'shilmaydi.
export const NotificationItem = ({ n, showTime = true, clickable = true }) => {
  const navigate = useNavigate();
  const dot = (DOT[n.type] || (() => "bg-hint"))(n);
  const lines = strip(n.body).split("\n").map((l) => l.trim()).filter(Boolean);
  // 1-qator odatda title bilan bir xil — takrorlamaymiz
  const bodyLines = lines[0] === n.title?.trim() ? lines.slice(1) : lines;
  const meta = [bodyLines.includes(n.data?.centerName) ? null : n.data?.centerName, showTime ? fmtTime(n.createdAt) : null].filter(Boolean).join(" · ");
  const openPath = OPEN_PATH[n.type];
  const to = clickable && n.data?.studentId && n.data?.entryId ? openPath?.(n.data) : null;
  const Tag = to ? "button" : "div";
  // Noma'lum tur bo'lsa (eski/yangi versiya) emblem o'rniga oddiy nuqta.
  const firstBadge = n.type === "parent:badge" ? n.data?.types?.[0] : null;
  const badgeType = firstBadge && BADGE_PALETTE[firstBadge] ? firstBadge : null;
  return (
    <Tag
      type={to ? "button" : undefined}
      onClick={to ? () => navigate(to) : undefined}
      className={cn("flex gap-2.5 w-full text-left", to && "active:opacity-70")}
    >
      {badgeType ? (
        // Yutuq xabarida nuqta o'rniga birinchi nishonning mini emblemasi
        <BadgeIcon type={badgeType} size={18} animated={false} className="mt-0.5 -mx-[5px]" />
      ) : (
        <span className={cn("w-2 h-2 rounded-full mt-2 shrink-0", dot)} />
      )}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm break-words leading-snug", !n.read && "font-bold")}>{n.title}</div>
        {bodyLines.length > 0 && (
          <div className="text-xs text-hint mt-0.5 whitespace-pre-line break-words line-clamp-3">{bodyLines.join("\n")}</div>
        )}
        {meta && <div className="text-[11px] text-hint/80 mt-0.5 break-words">{meta}</div>}
      </div>
    </Tag>
  );
};
