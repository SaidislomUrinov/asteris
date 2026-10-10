import { useTranslation } from "react-i18next";
import { HiEllipsisVertical } from "react-icons/hi2";
import { Avatar, Pill } from "../../components/Card";
import { initials, money } from "../../utils/format";
import { cn } from "../../utils/cn";
import { Num } from "../../components/Num";
import { photoSrc } from "../../lib/studentPhoto";

const MARK_TONE = { present: "ok", absent: "bad", excused: "warn" };

// Guruhdagi o'quvchi qatori (details §2): avatar, ism (bir qator, kesiladi),
// telefon; ostida pill'lar bir tekis qatorda — bugungi davomat va qarz.
// O'ngda amallar menyusi. `billing` — tanlangan oy bo'yicha qator holati
// (`monthRowOf`, faqat moliya ko'radigan rolda; aks holda null): qarz pill'i,
// o'tgan oyda to'liq to'langan bo'lsa yashil "To'langan", sikl davri kalendar
// oyiga to'g'ri kelmasa kichik kulrang `25.09 – 24.10`.
export const StudentRow = ({ index, student: s, billing, mark, sub, onOpen, onMenu }) => {
  const { t } = useTranslation();
  const Main = onOpen ? "button" : "div";
  const debt = billing?.debt || 0;
  const paidOff = !!billing && !billing.isCurrent && debt <= 0 && (billing.due || 0) > 0;
  const period = billing?.period || null;
  const hasPills = !!mark?.status || debt > 0 || paidOff || !!period;
  return (
    <div className="flex items-center gap-1 py-2">
      <Main
        type={onOpen ? "button" : undefined}
        onClick={onOpen}
        className={cn("flex items-center gap-3 min-w-0 flex-1 text-left", onOpen && "active:opacity-70")}
      >
        <Avatar text={initials(s.fullName)} tone={index} src={photoSrc(s.photo)} alt={s.fullName} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[14.5px] leading-tight truncate">{s.fullName}</span>
          {sub && <span className="block tabular text-[12px] text-hint truncate mt-0.5">{sub}</span>}
          {hasPills && (
            <span className="flex flex-wrap items-center gap-1 mt-1">
              {mark?.status && <Pill tone={MARK_TONE[mark.status] || "mut"}>{t(`worker.att.status.${mark.status}`)}</Pill>}
              {mark?.late && mark.status === "present" && <Pill tone="warn">{t("worker.att.late")}</Pill>}
              {debt > 0 && <Pill tone="bad"><Num text={t("common.debtShort", { v: money(debt) })} v={money(debt)} /></Pill>}
              {paidOff && <Pill tone="ok">{t("worker.group.month.paid")}</Pill>}
              {period && <span className="tabular text-[11px] font-medium text-hint whitespace-nowrap">{period}</span>}
            </span>
          )}
        </span>
      </Main>
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label={t("worker.group.actions")}
          className="w-10 h-10 -mr-1.5 rounded-full grid place-items-center text-hint active:bg-ink/6 shrink-0"
        >
          <HiEllipsisVertical className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
