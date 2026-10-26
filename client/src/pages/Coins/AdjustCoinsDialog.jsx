import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowRight, HiMinus, HiPlus } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Avatar from "../../ui/Avatar";
import CoinAmount from "./CoinAmount";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const QUICK = [5, 10, 20, 50];
const AMOUNT_MAX = 10000;
const REASON_MAX = 140;

/**
 * O'quvchiga qo'lda WECOIN berish (+) yoki ayirish (−)
 * (docs/API_CONTRACT_coin_adjust.md). Filial doirasida; o'quvchi bir nechta
 * WECOIN-filialda bo'lsa filial tanlanadi. Ota komponent har ochilishda
 * `key` almashtiradi (ichki state ochilishda olinadi).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {{_id: string, fullName: string, photo?: string|null}} props.student
 * @param {{_id: string, name: string}[]} props.centers - WECOIN ishlaydigan filiallar
 * @param {() => void} props.onClose
 * @param {(centerId: string, balance: number) => void} [props.onSaved]
 */
function AdjustCoinsDialog({ open, student, centers, onClose, onSaved }) {
  const { t } = useTranslation();
  const [centerId, setCenterId] = useState(centers[0]?._id || "");
  const [sign, setSign] = useState(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [balances, setBalances] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !student?._id) return undefined;
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const res = await api.get(`/coins/student/${student._id}`);
        if (!alive || !res.data.ok) return;
        setBalances(Object.fromEntries(res.data.data.centers.map((c) => [c.center._id, c.balance])));
      } catch {
        if (alive) setBalances({});
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, student?._id]);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && n <= AMOUNT_MAX;
  const balance = balances?.[centerId];
  const next = balance != null && valid ? balance + sign * n : null;
  const tooMuch = sign < 0 && next != null && next < 0;

  const submit = async () => {
    if (saving) return;
    try {
      if (!valid) throw new Error("coin.invalidAmount");
      if (tooMuch) throw new Error("coin.notEnoughBalance");
      setSaving(true);
      const res = await api.post(`/coins/${centerId}/students/${student._id}/adjust`, {
        amount: sign * n,
        reason: reason.trim(),
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved?.(centerId, data.balance);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const give = sign > 0;
  const tone = give
    ? {
        seg: "text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/30",
        field: "focus-within:border-emerald-500 ring-emerald-500/15",
        sign: "text-emerald-600 dark:text-emerald-400",
        chip: "hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300",
      }
    : {
        seg: "text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/30",
        field: "focus-within:border-red-500 ring-red-500/15",
        sign: "text-red-600 dark:text-red-400",
        chip: "hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300",
      };

  const segment = (active) =>
    `h-10 min-w-0 px-2 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
      active
        ? `bg-white dark:bg-night-700 ring-1 ring-inset shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${tone.seg}`
        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
    }`;

  const centerName = centers.find((c) => c._id === centerId)?.name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("coins.adjust.title")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color={give ? "emerald" : "red"} loading={saving} disabled={!valid || tooMuch} onClick={submit}>
            {give ? t("coins.adjust.give") : t("coins.adjust.take")}
          </Button>
        </>
      }
    >
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-4 w-full">
        <div className="flex items-center gap-3 min-w-0 rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 p-3">
          <Avatar user={{ _id: student._id, name: student.fullName, avatar: student.photo }} size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{student.fullName}</div>
            {centers.length === 1 && centerName && (
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{centerName}</div>
            )}
          </div>
          <CoinAmount value={balance ?? 0} size={20} className="text-lg shrink-0" />
        </div>

        {centers.length > 1 && (
          <Select
            label={t("coins.adjust.center")}
            variant="slate"
            value={centerId}
            onChange={setCenterId}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800">
          <button type="button" className={segment(give)} onClick={() => setSign(1)}>
            <HiPlus className="size-4 shrink-0" />
            <span className="truncate">{t("coins.adjust.give")}</span>
          </button>
          <button type="button" className={segment(!give)} onClick={() => setSign(-1)}>
            <HiMinus className="size-4 shrink-0" />
            <span className="truncate">{t("coins.adjust.take")}</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("coins.adjust.amount")}</span>
          <div
            className={`flex items-center gap-2 h-14 px-4 rounded-xl border bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ring-4 ring-transparent transition-colors ${tone.field}`}
          >
            <span className={`text-2xl font-bold leading-none ${tone.sign}`}>{give ? "+" : "−"}</span>
            <input
              inputMode="numeric"
              placeholder="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="min-w-0 flex-1 bg-transparent outline-none text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-night-600"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`h-9 rounded-lg text-sm font-semibold tabular-nums cursor-pointer transition-colors ${
                  n === q
                    ? give
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                    : `bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300 ${tone.chip}`
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t("coins.adjust.reason")}
          placeholder={t("coins.adjust.reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
        />

        {next != null && (
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
              tooMuch
                ? "border-red-200 dark:border-red-400/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 text-slate-500 dark:text-slate-400"
            }`}
          >
            <span className="font-medium">{tooMuch ? t("coin.notEnoughBalance") : t("coins.adjust.result")}</span>
            {!tooMuch && (
              <span className="inline-flex items-center gap-2 shrink-0">
                <span className="tabular-nums text-slate-400 dark:text-slate-500">{balance.toLocaleString("ru-RU")}</span>
                <HiArrowRight className="size-4 text-slate-400 dark:text-slate-500" />
                <CoinAmount value={next} size={18} className="text-base" />
              </span>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default AdjustCoinsDialog;
