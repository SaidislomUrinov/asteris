import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiXMark, HiDocumentCheck } from "react-icons/hi2";
import { Avatar, Pill } from "../../components/Card";
import { initials } from "../../utils/format";
import { photoSrc } from "../../lib/studentPhoto";
import { cn } from "../../utils/cn";

// Server qabul qiladigan 3 holat (attendance.service mark()):
// keldi / kelmadi / sababli. "Kechikdi" — server o'zi qo'yadigan belgi
// (filial sozlamasidagi kechikish daqiqasi bo'yicha), shu yerda pill.
const BUTTONS = [
  { status: "present", icon: HiCheck, on: "bg-ok text-white" },
  { status: "absent", icon: HiXMark, on: "bg-bad text-white" },
  { status: "excused", icon: HiDocumentCheck, on: "bg-late text-white" },
];

// `sub` — ixtiyoriy izoh qatori (masalan sababli kelmaganlik sababi).
// `photo`/`tone` — chapdagi kichik avatar (rasm yo'q bo'lsa initsiallar).
export const AttendanceRow = ({ name, photo, tone = 0, sub, mark, saving, disabled, onMark }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-2">
      <Avatar text={initials(name)} tone={tone} src={photoSrc(photo)} alt={name} className="w-8 h-8 text-[11px] mr-1" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[14px] truncate">{name}</div>
        {sub && <div className="text-[12px] text-hint break-words">{sub}</div>}
        {mark?.late && mark.status === "present" && <Pill tone="warn" className="mt-0.5">{t("worker.att.late")}</Pill>}
      </div>
      <div className={cn("flex gap-1.5 shrink-0", saving && "opacity-60")}>
        {BUTTONS.map((b) => {
          const active = mark?.status === b.status;
          return (
            <button
              key={b.status}
              type="button"
              disabled={disabled || saving}
              onClick={() => !active && onMark(b.status)}
              aria-pressed={active}
              aria-label={t(`worker.att.status.${b.status}`)}
              title={t(`worker.att.status.${b.status}`)}
              className={cn(
                "w-10 h-10 rounded-xl grid place-items-center transition-colors disabled:cursor-not-allowed",
                active ? b.on : "bg-ink/6 text-hint",
              )}
            >
              {createElement(b.icon, { className: "w-5 h-5" })}
            </button>
          );
        })}
      </div>
    </div>
  );
};
