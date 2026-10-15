import { useTranslation } from "react-i18next";
import { HiStar, HiClipboardDocumentCheck, HiCalendarDays, HiTrophy } from "react-icons/hi2";
import { Card, IconBox, SectionLabel } from "../../components/Card";
import { CoinIcon } from "../../components/CoinIcon";
import { Medal } from "../../components/Medal";
import { cn } from "../../utils/cn";
import { useRoleT } from "../../hooks/useRoleT";

const PART_ICON = {
  grades: HiStar,
  homework: HiClipboardDocumentCheck,
  attendance: HiCalendarDays,
  medals: HiTrophy,
};

// Vazifa kartasi: chapda belgi (baho raqami / medal / ikonka), o'ngda mukofot.
const Quest = ({ lead, label, coins }) => (
  <div className="flex items-center gap-2.5 rounded-xl bg-ink/4 px-2.5 py-2 min-w-0">
    <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-card text-[15px] font-extrabold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {lead}
    </span>
    <span className="flex-1 min-w-0 text-[13px] font-semibold break-words leading-tight">{label}</span>
    <span className="inline-flex items-center gap-1 text-[14px] font-extrabold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
      +{coins}
      <CoinIcon size={15} />
    </span>
  </div>
);

// "Qanday topiladi" — shu oy natijasi va filial qoidalari (o'yin vazifalari kabi).
export const EarnTab = ({ wallet }) => {
  const { t } = useTranslation();
  const rt = useRoleT();
  const { rules, month } = wallet;
  const b = month.breakdown;
  const sections = [
    {
      key: "grades",
      tone: "acc",
      grid: true,
      rows: rules.grades.map((g) => ({ lead: g.value, label: t("coins.rule.grade", { value: g.value }), coins: g.coins })),
    },
    {
      key: "homework",
      tone: "ok",
      rows: [
        rules.homework.done && { lead: <HiClipboardDocumentCheck className="w-[18px] h-[18px] text-ok" />, label: t("hw.status.done"), coins: rules.homework.done },
        rules.homework.partial && { lead: <HiClipboardDocumentCheck className="w-[18px] h-[18px] text-warn" />, label: t("hw.status.partial"), coins: rules.homework.partial },
      ].filter(Boolean),
    },
    {
      key: "attendance",
      tone: "warn",
      rows: rules.attendance.present
        ? [{ lead: <HiCalendarDays className="w-[18px] h-[18px] text-warn" />, label: t("coins.rule.present"), coins: rules.attendance.present }]
        : [],
    },
    {
      key: "medals",
      tone: "acc",
      rows: [
        rules.medals.gold && { lead: <Medal position={1} size={16} animated={false} />, label: t("coins.rule.place", { n: 1 }), coins: rules.medals.gold },
        rules.medals.silver && { lead: <Medal position={2} size={16} animated={false} />, label: t("coins.rule.place", { n: 2 }), coins: rules.medals.silver },
        rules.medals.bronze && { lead: <Medal position={3} size={16} animated={false} />, label: t("coins.rule.place", { n: 3 }), coins: rules.medals.bronze },
      ].filter(Boolean),
    },
  ].filter((s) => s.rows.length);

  return (
    <>
      <SectionLabel>{rt("coins.thisMonthTitle")}</SectionLabel>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <CoinIcon size={30} />
          <span className="text-[30px] leading-none font-extrabold tabular-nums">+{month.total}</span>
          <span className="text-[12px] font-semibold text-hint">{t("coins.monthTotal")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["grades", "homework", "attendance", "medals"].map((k) => {
            const Icon = PART_ICON[k];
            const got = b[k].coins > 0;
            return (
              <div key={k} className={cn("rounded-xl px-3 py-2.5 min-w-0", got ? "bg-amber-400/12 ring-1 ring-amber-400/25" : "bg-ink/4")}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-hint">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t(`coins.part.${k}`)}</span>
                </div>
                <div className={cn("flex items-center gap-1 mt-1 text-lg font-extrabold tabular-nums", !got && "text-hint")}>
                  <CoinIcon size={16} muted={!got} />
                  {b[k].coins}
                </div>
                <div className="text-[11px] text-hint tabular-nums">{t(`coins.count.${k}`, { n: b[k].count })}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <SectionLabel>{t("coins.howToEarn")}</SectionLabel>
      {sections.length === 0 ? (
        <Card className="text-sm text-hint text-center py-4">{t("coins.noRules")}</Card>
      ) : (
        sections.map((s) => (
          <Card key={s.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <IconBox Icon={PART_ICON[s.key]} tone={s.tone} className="w-8 h-8 rounded-lg" />
              <div className="text-sm font-bold">{t(`coins.part.${s.key}`)}</div>
            </div>
            <div className={cn("grid gap-2", s.grid ? "grid-cols-1 min-[380px]:grid-cols-2" : "grid-cols-1")}>
              {s.rows.map((r, i) => (
                <Quest key={i} {...r} />
              ))}
            </div>
          </Card>
        ))
      )}
      <div className="text-[12px] text-hint text-center px-4">{t("coins.monthEndNote")}</div>
    </>
  );
};
