import { HiCheck, HiMinus, HiXMark } from "react-icons/hi2";

// Uyga vazifa natija turlari (API_CONTRACT_wecoin.md §1.1) — tartib UI'dagi
// tanlov tartibi. Ranglar davomatdan (emerald/red/amber, kvadrat katak)
// ATAYLAB farqli: osmon/to'q sariq/qizg'ish + dumaloq katak — ikki matritsa
// bir qarashda chalkashmaydi.
//   `cell` — dumaloq katak (yumshoq fon + ichki ring),
//   `dot`  — izoh/xulosa nuqtasi, `text` — xulosa raqami rangi.
export const RESULT_OPTIONS = [
  {
    key: "done",
    icon: HiCheck,
    cell: "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/35",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "partial",
    icon: HiMinus,
    cell: "bg-orange-500/12 text-orange-600 dark:text-orange-400 ring-orange-500/35",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "missed",
    icon: HiXMark,
    cell: "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/35",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
];

export const RESULT_BY_KEY = Object.fromEntries(RESULT_OPTIONS.map((o) => [o.key, o]));

// Asia/Tashkent bo'yicha bugungi kun — Homework.date ham shu kalendarda.
export const tashkentToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());

export const monthOf = (str) => Number(str.slice(5, 7)) - 1;
export const yearOf = (str) => Number(str.slice(0, 4));

export const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const dayCodeOf = (date) => JS_DAY_TO_CODE[new Date(`${date}T00:00:00`).getDay()];

// Oyning barcha kunlari ("YYYY-MM-DD"[]).
export const daysOfMonth = (month) => {
  const count = new Date(yearOf(month), monthOf(month) + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
};

// "Chorshanba, 8-oktabr" — loyiha i18n'idan (Intl'da o'zbek oy nomlari yo'q).
export const formatHomeworkDate = (t, date) =>
  t("homework.dateLabel", {
    weekday: t(`group.day.${dayCodeOf(date)}`),
    day: Number(date.slice(8, 10)),
    month: t("common.monthsGenitive", { returnObjects: true })[monthOf(date)],
  });
