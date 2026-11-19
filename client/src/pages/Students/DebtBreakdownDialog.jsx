import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiCheckCircle, HiOutlineCalendarDays, HiPencilSquare, HiPlus } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import { errorMsg } from "../../utils/alert";
import Chip from "../../ui/Chip";
import useHideFinance from "../../hooks/useHideFinance";
import { maskMoney } from "../../utils/moneyFormat";
import {
  OPENING_MAX_AMOUNT,
  formatAmount,
  formatMonthName,
  parseAmount,
  recentMonths,
} from "./openingDebts.util";
import { formatCycleRange } from "./paymentMonth.util";

const formatMonthLabel = (month, monthNames) => formatMonthName(month, monthNames) || "—";

// Guruh entry'sining `debtBreakdown` (student.service.js "computeBilling")
// ro'yxatini oy-oy ko'rsatadi — faqat qarzi bor O'TGAN oylar (joriy oy
// alohida, kartochkada ko'rsatiladi). Har qatordagi "To'lov" bosilsa
// `onPayMonth(item)` chaqiriladi — parent shu ma'lumot bilan PaymentDialog'ni
// aynan shu oy uchun (summasi ham avtomatik) ochadi.
//
// `onEditPrice(item, price)` berilsa (student:update) sikl qatorida oy narxini
// shu yerning o'zida tahrirlash tugmasi chiqadi. Narx `priceCycles` dan
// `cycleStart` bo'yicha olinadi; o'tgan oyda — shu oydan keyingi barcha oylarga
// amal qiladi (API_CONTRACT_past_cycle_price.md), joriy oyda — joriy sikldan.
//
// `onSaveOpening(nextOpeningDebts)` berilsa (student:update) ko'chirishdan oldingi
// qarzni shu yerda boshqarish mumkin: opening qatorining summasini tahrirlash va
// pastdagi forma orqali oy bo'yicha qarz qo'shish. Oy allaqachon mavjud bo'lsa
// YANGI qator qo'shilmaydi — mavjud qarz summasi yangilanadi.
function DebtBreakdownDialog({
  open,
  onClose,
  breakdown = [],
  priceCycles = [],
  openingDebts = [],
  onPayMonth,
  onEditPrice,
  onSaveOpening,
}) {
  const { t } = useTranslation();
  const [newMonth, setNewMonth] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const months = useMemo(() => recentMonths(), []);
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const itemKey = (item, index) => `${item.kind || "cycle"}-${item.month ?? "none"}-${index}`;
  const openingOf = (item) => openingDebts.find((o) => (o.month || null) === (item.month || null));
  // Tahrirlanadigan qiymat: sikl qatorida — oy narxi, opening qatorida — qarz summasi.
  const priceOf = (item) =>
    item.kind === "opening"
      ? openingOf(item)?.amount
      : priceCycles.find((c) => c.cycleStart === item.cycleStart)?.price;
  const canEditItem = (item) =>
    item.kind === "opening" ? !!onSaveOpening : !!onEditPrice;

  const upsertOpening = (month, amount) => {
    const exists = openingDebts.some((o) => (o.month || null) === (month || null));
    const next = exists
      ? openingDebts.map((o) => ((o.month || null) === (month || null) ? { ...o, amount } : o))
      : [...openingDebts, { month, amount, note: "" }];
    return onSaveOpening(next.map((o) => ({ month: o.month || null, amount: o.amount, note: o.note || "" })));
  };

  const existingNewMonth = newMonth ? openingDebts.find((o) => o.month === newMonth) : null;

  const pickNewMonth = (m) => {
    setNewMonth(m || "");
    const existing = m ? openingDebts.find((o) => o.month === m) : null;
    setNewAmount(existing ? existing.amount : "");
  };

  const submitNew = async () => {
    const amount = Number(newAmount);
    if (!newMonth) return errorMsg("student.openingMonthInvalid");
    if (!Number.isInteger(amount) || amount < 1 || amount > OPENING_MAX_AMOUNT) return errorMsg("student.invalidAmount");
    try {
      setAdding(true);
      await upsertOpening(newMonth, amount);
      setNewMonth("");
      setNewAmount("");
      setAddOpen(false);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item, key) => {
    setEditKey(key);
    setDraft(String(priceOf(item) ?? ""));
  };

  const saveEdit = async (item) => {
    const price = Number(draft);
    const isOpening = item.kind === "opening";
    if (draft === "" || !Number.isInteger(price) || price < (isOpening ? 1 : 0)) {
      errorMsg(isOpening ? "student.invalidAmount" : "student.invalidPrice");
      return;
    }
    if (price === priceOf(item)) {
      setEditKey(null);
      return;
    }
    try {
      setSaving(true);
      if (isOpening) await upsertOpening(item.month || null, price);
      else await onEditPrice(item, price);
      setEditKey(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const [hideFinance] = useHideFinance();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");

  const editLabel = (item) => (item.kind === "opening" ? t("student.openingAmountLabel") : t("student.price"));

  return (
    <Dialog open={open} onClose={onClose} title={t("student.debtBreakdownTitle")}>
      <div className="flex flex-col gap-3 w-full">
        {breakdown.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-5 text-emerald-600 dark:text-emerald-400">
            <HiCheckCircle className="text-3xl" />
            <p className="text-sm font-medium">{t("student.noDebt")}</p>
          </div>
        ) : (
          // Tartib server bergandek (opening → sikllar), qayta sort qilinmaydi.
          <div className="flex flex-col gap-2.5">
            {breakdown.map((item, index) => {
              const key = itemKey(item, index);
              const editing = editKey === key;
              const isOpening = item.kind === "opening";
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 p-3.5 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100 capitalize">
                        {isOpening && !item.month ? t("student.openingMonthUnknown") : formatMonthLabel(item.month, monthNames)}
                        {isOpening && <Chip value={t("student.openingBadge")} color="slate" className="!py-0.5 !px-1.5 normal-case" />}
                        {/* Sikl oralig'i — bir oyda ikki qator bo'lsa ularni ajratadi */}
                        {!isOpening && formatCycleRange(item.from, item.to) && (
                          <span className="text-[11px] font-medium normal-case text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-night-800 rounded-md px-1.5 py-0.5 tabular-nums whitespace-nowrap">
                            {formatCycleRange(item.from, item.to)}
                          </span>
                        )}
                      </span>
                      {isOpening && item.note && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.note}</span>
                      )}
                      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        {t("student.paidAmount")}: {maskMoney(item.paid, hideFinance)} / {maskMoney(item.due, hideFinance)} {somSuffix}
                      </span>
                    </div>
                    <span className="text-[15px] font-bold text-red-600 dark:text-red-400 shrink-0 tabular-nums whitespace-nowrap">
                      {maskMoney(item.debt, hideFinance)} {somSuffix}
                    </span>
                  </div>

                  {editing ? (
                    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 dark:bg-night-800 p-3">
                      <Input
                        variant="white"
                        label={editLabel(item)}
                        inputMode="numeric"
                        autoFocus
                        value={formatAmount(draft)}
                        onChange={(e) => setDraft(parseAmount(e.target.value))}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(item)}
                      />
                      <div className="flex items-center gap-2">
                        <Button color="black" variant="text" className="flex-1" disabled={saving} onClick={() => setEditKey(null)}>
                          {t("common.cancel")}
                        </Button>
                        <Button className="flex-1" loading={saving} onClick={() => saveEdit(item)}>
                          {t("common.save")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button color="emerald" className="gap-1.5 flex-1" onClick={() => onPayMonth?.(item)}>
                        <HiBanknotes className="text-base" />
                        {t("student.addPayment")}
                      </Button>
                      {canEditItem(item) && priceOf(item) != null && (
                        <Button
                          variant="outlined"
                          color="black"
                          className="gap-1.5"
                          title={`${editLabel(item)}: ${maskMoney(priceOf(item), hideFinance)} ${somSuffix}`}
                          onClick={() => startEdit(item, key)}
                        >
                          <HiPencilSquare className="text-base" />
                          {t("common.edit")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {onSaveOpening &&
          (addOpen ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 dark:bg-night-800 p-3.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("student.openingAddTitle")}</span>
              <Select
                placeholder={t("student.openingMonthPlaceholder")}
                icon={<HiOutlineCalendarDays />}
                value={newMonth}
                onChange={pickNewMonth}
                options={months.map((m) => ({ value: m, label: formatMonthName(m, monthNames) }))}
              />
              <Input
                variant="white"
                inputMode="numeric"
                placeholder={t("student.openingAmountLabel")}
                value={formatAmount(newAmount)}
                onChange={(e) => setNewAmount(parseAmount(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && submitNew()}
              />
              {existingNewMonth && (
                <span className="text-xs text-amber-600 dark:text-amber-400">{t("student.openingMonthExists")}</span>
              )}
              <div className="flex items-center gap-2">
                <Button color="black" variant="text" className="flex-1" disabled={adding} onClick={() => setAddOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button className="flex-1" loading={adding} onClick={submitNew}>
                  {existingNewMonth ? t("common.update") : t("common.add")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outlined" color="blue" className="gap-1.5 w-full border-dashed" onClick={() => setAddOpen(true)}>
              <HiPlus className="text-base" />
              {t("student.openingAddTitle")}
            </Button>
          ))}
      </div>
    </Dialog>
  );
}

export default DebtBreakdownDialog;
