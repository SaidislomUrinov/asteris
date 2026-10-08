import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiCalendarDays } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const TYPE_OPTIONS = [
  { value: "cash", label: "student.paymentTypeCash" },
  { value: "card", label: "student.paymentTypeCard" },
  { value: "mixed", label: "student.paymentTypeMixed" },
  { value: "previousMonth", label: "student.paymentTypePreviousMonth" },
];

// Bitta guruh bog'lanishiga (Student.groups[] elementi) to'lov qo'shadi —
// bo'lib-bo'lib to'lash shu orqali amalga oshadi (har bosqich alohida yozuv).
// Muvaffaqiyatli saqlangach `onPaid` chaqiriladi — shu orqali parent
// "Chek yuklansinmi?" modalini ochadi (receipt uchun kerakli ma'lumot bilan).
//
// `currentCyclePrice`/`paidForCurrentCycle`/`currentCycleMonth`/`courseStartMonth`
// — server (student.service.js "computeBilling") tomonidan filial sozlamasiga
// (sanadan-sanaga yoki oy boshidan oy boshiga) mos hisoblangan sikl
// ma'lumotlari: summa maydoniga shu sikl bo'yicha QOLGAN summa
// ("currentCyclePrice" - "paidForCurrentCycle") default qilib qo'yiladi,
// "qaysi oy uchun" esa kurs boshlangan oydan oldinga tanlanmaydi (guruh hali
// faollashtirilmagan bo'lsa — courseStartMonth yo'q — bu maydon o'chiq turadi).
function PaymentDialog({
  open,
  onClose,
  studentId,
  groupEntryId,
  debt = 0,
  currentCyclePrice = 0,
  paidForCurrentCycle = 0,
  currentCycleMonth = "",
  courseStartMonth = "",
  // min(eng eski boshlang'ich qarz oyi, courseStartMonth) — server beradi
  // (API_CONTRACT_opening_debts.md §2). Guruh faollashmagan bo'lsa ham
  // boshlang'ich qarz bo'lsa shu qiymat bor va oy tanlash yoqiq bo'ladi.
  earliestPayableMonth = null,
  // "Qarzdorliklar" ro'yxatidan aynan bitta O'TGAN oy uchun to'lash
  // bosilganda beriladi — shu holatda summa/oy joriy sikl asosida emas,
  // TO'G'RIDAN-TO'G'RI shu oyning qarzi bilan to'ldiriladi.
  presetAmount,
  presetForMonth,
  onSaved,
  onPaid,
}) {
  const { t } = useTranslation();
  // Shu sikl uchun qolgan ("Jami" - "To'langan") summa — currentMonthDue
  // (faqat O'TGAN kunlar uchun hisoblangan qism) o'rniga endi shu
  // ishlatiladi, chunki "To'langan/Jami" ustuni va yuqoridagi qarzdorlik
  // charti ham shu asosda ko'rsatiladi — summa maydoni ularga mos bo'lishi
  // kerak.
  const remainingCycleAmount = Math.max(0, currentCyclePrice - paidForCurrentCycle);
  const defaultAmount = presetAmount > 0 ? presetAmount : remainingCycleAmount;
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [type, setType] = useState("cash");
  const [note, setNote] = useState("");
  const minMonth = earliestPayableMonth || courseStartMonth || "";
  // Preset (Qarzdorliklar ro'yxatidan) berilgan bo'lsa — aynan shu oy; oyi
  // noma'lum boshlang'ich qarz (`month === null`) uchun bo'sh qoladi.
  const [forMonth, setForMonth] = useState(
    presetForMonth !== undefined ? presetForMonth || "" : currentCycleMonth || "",
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      const val = Number(amount);
      if (!amount || Number.isNaN(val) || val <= 0) throw new Error("student.invalidAmount");
      setDisabled(true);

      const res = await api.post(`/students/${studentId}/groups/${groupEntryId}/payments`, {
        amount: val,
        type,
        note: note.trim(),
        forMonth: minMonth && forMonth ? forMonth : undefined,
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg(msg);
      onSaved?.(data);
      const updatedEntry = data.groups?.find((g) => g._id === groupEntryId);
      // Chekdagi qarzdorlik — JAMI qarz (`debt`), ya'ni o'tgan sikllar
      // qoldig'i + joriy sikl qoldig'i. Avval bu yerda faqat joriy sikl
      // qoldig'i hisoblanardi, shuning uchun o'tgan oylardan qarzi bor
      // o'quvchi bu oy uchun to'lasa chekda "Qarzi yo'q" chiqib qolardi.
      // `debtBreakdown` esa o'sha qarzni oylar kesimida ko'rsatadi
      // (API_CONTRACT_receipt_debt_breakdown.md).
      const remainingDebt = updatedEntry?.debt || 0;
      const debtBreakdown = updatedEntry?.debtBreakdown || [];
      const lastPayment = updatedEntry?.payments?.[updatedEntry.payments.length - 1];
      const paymentId = lastPayment?.code || lastPayment?._id;
      onPaid?.({ amount: val, forMonth, remainingDebt, debtBreakdown, paymentId });
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("student.addPayment")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="emerald" loading={disabled} onClick={submit}>
            {t("student.addPayment")}
          </Button>
        </>
      }
    >
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-3 w-full">
        {debt > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("student.debt")}: {debt.toLocaleString("uz-UZ")} {t("student.somSuffix")}
          </p>
        )}
        {remainingCycleAmount > 0 && (
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {t("student.currentMonthDueHint", {
              amount: remainingCycleAmount.toLocaleString("uz-UZ"),
            })}
          </p>
        )}
        <Input
          type="number"
          label={t("student.paymentAmount")}
          placeholder="0"
          required
          icon={<HiBanknotes />}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select
          label={t("student.paymentType")}
          required
          value={type}
          onChange={setType}
          options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
        />
        <Input
          type="month"
          label={t("student.forMonth")}
          icon={<HiCalendarDays />}
          value={forMonth}
          min={minMonth || undefined}
          disabled={!minMonth}
          onChange={(e) => setForMonth(e.target.value)}
        />
        {!minMonth && (
          <p className="pl-2 -mt-2 text-xs text-slate-400 dark:text-slate-500">{t("student.forMonthDisabledHint")}</p>
        )}
        <Input
          label={t("student.paymentNote")}
          placeholder={t("student.paymentNote")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

export default PaymentDialog;
