import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiClipboardDocumentList, HiEyeSlash, HiReceiptPercent } from "react-icons/hi2";
import NumberText from "../../ui/NumberText";
import TelegramBotLink from "../../ui/TelegramBotLink";
import useBotLink from "../../hooks/useBotLink";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

// Dastlab eng so'nggi shuncha tranzaksiya — qolgani shu joyda ochiladi.
const INITIAL_TX = 4;

const TX_DOT = {
  bonus: "bg-emerald-500",
  advance: "bg-blue-400",
  withdrawal: "bg-violet-400",
  penalty: "bg-rose-400",
};

/**
 * Oylik tranzaksiyalari tarixi + pastki qatorda o'quvchilar boti havolasi —
 * bitta karta. Tranzaksiyalar "Ish haqi" panelidagi tanlangan oyga tegishli
 * (oy nomi sarlavhada). Moliya yashirilgan bo'lsa summalar chizilmaydi, bot
 * qatori esa baribir ko'rinadi (u moliyaga aloqador emas).
 *
 * @param {Object} props
 * @param {Object|null} props.salary - API `salary`
 * @param {boolean} props.loading - boshqa oy yuklanmoqda
 * @param {boolean} props.hidden - `useHideFinance`
 * @param {string} props.monthLabel
 */
function TransactionsCard({ salary, loading, hidden, monthLabel }) {
  const { t } = useTranslation();
  const botLink = useBotLink();
  const [expanded, setExpanded] = useState(false);

  const transactions = salary?.transactions || [];
  const visibleTx = expanded ? transactions : transactions.slice(0, INITIAL_TX);

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-col gap-2 p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-blue-50 text-blue-600">
              <HiReceiptPercent aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-slate-800 truncate">{t("salary.transactions")}</h2>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600 capitalize">
            {monthLabel}
          </span>
        </header>

        {loading ? (
          <div className="flex flex-col gap-2 pt-1 animate-pulse" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : hidden ? (
          <div className="flex items-center gap-2.5 py-3 text-slate-400">
            <HiEyeSlash className="text-lg shrink-0" aria-hidden="true" />
            <p className="text-xs">{t("common.financeHidden")}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center gap-2.5 py-3 text-slate-400">
            <HiClipboardDocumentList className="text-lg shrink-0" aria-hidden="true" />
            <p className="text-xs">{t("teacherHome.noTransactions")}</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-slate-100">
              {visibleTx.map((tx) => {
                const cancelled = tx.status === "cancelled";
                const positive = tx.type === "bonus";
                return (
                  <li key={tx._id} className={`flex items-center gap-3 py-2.5 ${cancelled ? "opacity-50" : ""}`}>
                    <span
                      className={`w-2 h-2 shrink-0 rounded-full ${TX_DOT[tx.type] || "bg-slate-300"}`}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className={`text-sm font-medium text-slate-700 ${cancelled ? "line-through" : ""}`}>
                        {t(`salary.txType.${tx.type}`)}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {[tx.date?.split(" | ")[0], tx.note].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <NumberText
                      className={`shrink-0 ${
                        cancelled ? "line-through !text-slate-400" : positive ? "!text-emerald-600" : "!text-slate-700"
                      }`}
                    >
                      {positive ? "+" : "−"}
                      {money(tx.amount)}
                    </NumberText>
                  </li>
                );
              })}
            </ul>
            {transactions.length > INITIAL_TX && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="self-center h-10 px-4 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                {expanded ? t("teacherHome.showLess") : t("teacherHome.showAll", { count: transactions.length })}
              </button>
            )}
          </>
        )}
      </div>

      {/* O'quvchilar boti — kartaning pastki yordamchi qatori */}
      {botLink && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">{t("student.botLinkLabel")}</h3>
            <p className="text-xs text-slate-400">{t("student.botLinkHint")}</p>
          </div>
          <div className="min-w-0 max-w-full">
            <TelegramBotLink className="max-w-full" />
          </div>
        </div>
      )}
    </section>
  );
}

export default TransactionsCard;
