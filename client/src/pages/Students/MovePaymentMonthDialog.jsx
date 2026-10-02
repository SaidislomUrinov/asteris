import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCalendar, HiCalendarDays, HiExclamationTriangle } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import useHideFinance from "../../hooks/useHideFinance";
import { maskMoney } from "../../utils/moneyFormat";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { formatMonthName } from "./openingDebts.util";
import { moveMonthOptions, paymentEffectiveMonth } from "./paymentMonth.util";

// Mavjud to'lovning "qaysi oy uchun" (`forMonth`) belgisini o'zgartiradi —
// summa/sana/kod o'zgarmaydi (API_CONTRACT_payment_move_month.md).
// `entry` — a'zolik (openingDebts/courseStartMonth/currentCycleMonth/debtBreakdown).
function MovePaymentMonthDialog({ open, onClose, studentId, entry, payment, onSaved }) {
  const { t } = useTranslation();
  const [hideFinance] = useHideFinance();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const somSuffix = t("student.somSuffix");
  const [forMonth, setForMonth] = useState("");
  const [saving, setSaving] = useState(false);

  const currentMonth = paymentEffectiveMonth(payment);
  const options = useMemo(
    () =>
      moveMonthOptions(entry, payment).map(({ month, debt }) => ({
        value: month,
        label: (
          <span>
            {formatMonthName(month, monthNames)}
            {debt > 0 && (
              <span className="text-red-600">
                {" — "}
                {maskMoney(debt, hideFinance)} {somSuffix} {t("student.moveMonthDebtSuffix")}
              </span>
            )}
          </span>
        ),
      })),
    [entry, payment, monthNames, hideFinance, somSuffix, t],
  );

  const submit = async () => {
    if (!forMonth) return;
    try {
      setSaving(true);
      const res = await api.patch(
        `/students/${studentId}/groups/${entry._id}/payments/${payment._id}/month`,
        { forMonth },
      );
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "student.paymentMonthMoved");
      onSaved?.(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("student.movePaymentMonthTitle")}
      zIndex="z-40"
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="blue" loading={saving} disabled={!forMonth} onClick={submit}>
            {t("student.moveMonthConfirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-800">
              {maskMoney(payment?.amount, hideFinance)} {somSuffix}
            </span>
            {payment?.type && (
              <Chip
                value={t(`student.paymentType${payment.type[0].toUpperCase()}${payment.type.slice(1)}`)}
                color="slate"
                variant="ghost"
              />
            )}
            <span className="flex items-center gap-1 ml-auto text-xs text-slate-400">
              <HiCalendar />
              {payment?.date ? new Date(payment.date * 1000).toLocaleDateString("uz-UZ") : "—"}
            </span>
          </div>
          <span className="text-sm text-slate-500">
            {t("student.moveMonthCurrentLabel")}:{" "}
            <span className="font-medium text-slate-700">{formatMonthName(currentMonth, monthNames) || "—"}</span>
          </span>
        </div>

        <Select
          label={t("student.moveMonthNewLabel")}
          required
          icon={<HiCalendarDays />}
          placeholder={t("student.moveMonthNewLabel")}
          value={forMonth}
          onChange={setForMonth}
          options={options}
        />

        {forMonth && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <HiExclamationTriangle className="text-base shrink-0" />
            <span>{t("student.moveMonthWarning")}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default MovePaymentMonthDialog;
