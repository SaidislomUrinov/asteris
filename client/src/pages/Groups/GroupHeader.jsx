import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowTopRightOnSquare,
  HiInformationCircle,
  HiPencilSquare,
  HiPlus,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno (ui/TelegramBotLink.jsx).
import { FaTelegram } from "react-icons/fa";
import Chip from "../../ui/Chip";
import Dialog from "../../ui/Dialog";
import IconButton from "../../ui/IconButton";
import TelegramBotLink from "../../ui/TelegramBotLink";
import useBotLink from "../../hooks/useBotLink";
import useClosingValue from "../../hooks/useClosingValue";
import HeaderCard from "./HeaderCard";
import GroupTelegramDialog from "./GroupTelegramDialog";

// `https://t.me/+AbC` → `t.me/+AbC` — kartada qisqa ko'rinishi uchun.
const shortLink = (url) => url.replace(/^https?:\/\//, "");

function TelegramRow({ label, children }) {
  return (
    <div className="flex items-center gap-2 min-w-0 min-h-7">
      <span className="w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Guruh detali (`/groups/:id`) va Dars (`/lesson`) sahifalarining UMUMIY
 * tepa qatori — ikkala sahifa ham aynan shu komponentni chizadi, shu sabab
 * uslub hech qachon ajralib ketmaydi.
 *
 *  1. Guruh — nom, holat, dars kunlari; batafsil ma'lumot (i) oynasida.
 *  2. O'quvchilar soni.
 *  3. `extra` — rolga qarab: oylik to'lov (boshliq/resepshin) yoki
 *     "Bugungi dars" (o'qituvchi). Berilmasa katak chizilmaydi.
 *  4. Telegram — o'quvchi/ota-ona boti (nusxalash) va guruhning Telegram
 *     guruhi (`telegramLink`, `PATCH /groups/:id/telegram`).
 *
 * @param {Object} props
 * @param {Object} props.group - kamida `{ _id, days, maxStudents, telegramLink }`
 * @param {string} props.label - "Fan - N"
 * @param {React.ReactNode} props.status - holat chipi
 * @param {React.ReactNode} props.details - (i) oynasidagi meta qatorlari
 * @param {number} props.studentsCount
 * @param {React.ReactNode} [props.studentsFooter] - masalan to'lganlik ProgressBar
 * @param {React.ReactNode} [props.extra] - 3-karta
 * @param {React.ReactNode} [props.titleBadge] - sarlavha yonidagi belgi (masalan IND)
 * @param {React.ReactNode} [props.studentsCard] - berilsa o'quvchilar soni kartasi o'rniga
 * @param {React.ReactNode} [props.homework] - "Oxirgi vazifa" kartasi (Telegram oldidan)
 * @param {boolean} [props.canEditTelegram]
 * @param {(group: Object) => void} [props.onTelegramSaved]
 */
// Keng ekranda ustunlar: nom · o'quvchilar · [3-karta] · [vazifa] · Telegram.
// Kalit: `${extra}${homework}`. Tailwind klasslari to'liq yozilishi shart.
const XL_COLS = {
  "11": "xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]",
  "10": "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.15fr)]",
  "01": "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.15fr)]",
  "00": "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,1.15fr)]",
};

function GroupHeader({
  group,
  label,
  status,
  details,
  studentsCount,
  studentsFooter,
  extra,
  titleBadge,
  studentsCard,
  homework,
  canEditTelegram = false,
  onTelegramSaved,
}) {
  const { t } = useTranslation();
  const bot = useBotLink();
  const [infoOpen, setInfoOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const telegramView = useClosingValue(telegramOpen ? group : null);
  const link = group.telegramLink || null;

  return (
    <div
      className={`grid grid-cols-2 gap-3 max-sm:gap-2 ${
        XL_COLS[`${extra ? 1 : 0}${homework ? 1 : 0}`]
      }`}
    >
      <HeaderCard
        className="col-span-2 xl:col-span-1"
        icon={<HiUserGroup />}
        title={
          titleBadge ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate">{label}</span>
              {titleBadge}
            </span>
          ) : (
            label
          )
        }
        accent="blue"
        strong
        badge={
          <div className="max-sm:[&_button]:min-w-8 max-sm:[&_button]:max-w-8 max-sm:[&_button]:min-h-8 max-sm:[&_button]:max-h-8">
            <IconButton
              variant="ghost"
              color="slate"
              title={t("group.infoCardDesc")}
              onClick={() => setInfoOpen(true)}
            >
              <HiInformationCircle />
            </IconButton>
          </div>
        }
      >
        {/* Holat chipi kun chiplari bilan bir qatorda — sarlavha to'liq ko'rinadi. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {status}
          {group.days?.length ? (
            group.days.map((d) => (
              <Chip key={d} value={t(`group.day.${d}`)} color="slate" variant="ghost" />
            ))
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500">{t("group.days")}: —</span>
          )}
        </div>
      </HeaderCard>

      {studentsCard || (
        <HeaderCard
          className={extra ? "" : "col-span-2 xl:col-span-1"}
          icon={<HiUsers />}
          title={t("group.studentsCount")}
          value={studentsCount}
          suffix={group.maxStudents && group.kind !== "individual" ? `/ ${group.maxStudents}` : null}
          accent="violet"
        >
          {studentsFooter}
        </HeaderCard>
      )}

      {extra}

      {homework}

      <HeaderCard
        // Vazifa kartasi bo'lsa planshetda ikkalasi yonma-yon, telefonda ustma-ust.
        className={homework ? "max-sm:col-span-2" : "col-span-2 xl:col-span-1"}
        icon={<FaTelegram />}
        title="Telegram"
        accent="cyan"
        headMobileHidden
      >
        <div className="flex flex-col gap-1.5 max-sm:gap-0.5">
          <TelegramRow label={t("group.telegramBot")}>
            {bot ? (
              <TelegramBotLink className="max-w-full !bg-[#229ED9] !text-white !ring-0 !text-sm !py-1.5 hover:!bg-[#1c8bc0]" />
            ) : (
              <span className="text-sm text-slate-400 dark:text-slate-500">{t("group.telegramBotMissing")}</span>
            )}
          </TelegramRow>

          <TelegramRow label={t("group.telegramGroup")}>
            {link ? (
              <>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link}
                  className="inline-flex items-center gap-1.5 min-w-0 rounded-full bg-emerald-50 dark:bg-emerald-500/15 pl-2 pr-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200/70 dark:ring-emerald-500/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/20 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{shortLink(link)}</span>
                  <HiArrowTopRightOnSquare className="text-sm shrink-0 opacity-70" aria-hidden="true" />
                </a>
                {canEditTelegram && (
                  <button
                    type="button"
                    title={t("group.telegramClickToEdit")}
                    aria-label={t("group.telegramClickToEdit")}
                    onClick={() => setTelegramOpen(true)}
                    className="ml-auto w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-base text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-night-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    <HiPencilSquare />
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-night-600 shrink-0" />
                  {t("group.telegramNotConnectedShort")}
                </span>
                {canEditTelegram && (
                  <button
                    type="button"
                    onClick={() => setTelegramOpen(true)}
                    className="ml-auto inline-flex items-center gap-1 shrink-0 rounded-lg px-2 h-7 text-xs font-semibold text-[#229ED9] hover:bg-[#229ED9]/10 transition-colors cursor-pointer"
                  >
                    <HiPlus className="text-sm" aria-hidden="true" />
                    {t("group.telegramConnect")}
                  </button>
                )}
              </>
            )}
          </TelegramRow>
        </div>
      </HeaderCard>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} title={label}>
        <div className="flex flex-col gap-2.5">{details}</div>
      </Dialog>

      {telegramView && (
        <GroupTelegramDialog
          open={telegramOpen}
          group={telegramView}
          label={label}
          onClose={() => setTelegramOpen(false)}
          onSaved={onTelegramSaved}
        />
      )}
    </div>
  );
}

export default GroupHeader;
