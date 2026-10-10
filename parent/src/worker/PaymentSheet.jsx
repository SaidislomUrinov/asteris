import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import { Button } from "../components/Button";
import { SegmentTabs } from "../components/SegmentTabs";
import { ListSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { cn } from "../utils/cn";
import { fmtMonth, money } from "../utils/format";
import { haptic } from "../lib/telegram";
import { workerApi } from "./api";
import { useWorker } from "./useWorker";
import { useGroupNames } from "./useGroupNames";
import { PAYMENT_TYPES } from "./constants";
import { asErr, digitsOnly, errText } from "./utils";
import { BottomSheet } from "./components/BottomSheet";
import { MoneyInput } from "./components/MoneyInput";

// To'lov oynasi uchun to'lanadigan a'zoliklar: arxivlanganlar DTO'da yo'q;
// yakunlangan guruh — server rad etadi (student.groupFinished).
const payableEntries = (s) =>
  (s?.groups || []).filter((g) => g.groupStatus !== "finished" && (g.status === "active" || (g.debt || 0) > 0));

// Client paneldagi PaymentDialog bilan bir xil default: joriy sikl qoldig'i,
// u nol bo'lsa umumiy qarz.
const defaultAmount = (e) => {
  const rest = Math.max(0, (e?.currentCyclePrice || 0) - (e?.paidForCurrentCycle || 0));
  return rest > 0 ? rest : Math.max(0, e?.debt || 0);
};

// Boshlang'ich a'zolik: aniq berilgan (guruh/o'quvchi detalidan) bo'lsa
// o'sha, aks holda to'lanadigan a'zolik bitta bo'lsa — o'sha.
const initialEntry = (student, entryId) => {
  const list = payableEntries(student);
  return list.find((e) => e._id === entryId) || (list.length === 1 ? list[0] : null);
};

// Resepshn markaziy amali — to'lov qabul qilish (§5). Payload client
// PaymentDialog bilan bir xil: POST /students/:id/groups/:entryId/payments
// { amount, type, note, forMonth }. `initialEntryId` — guruh/o'quvchi
// detalidan ochilganda a'zolik oldindan tanlanadi (details §2, §3.1).
// `initialMonth`/`initialAmount` (ixtiyoriy, guruh oy filtridan — §D): to'lov
// shu oyga yoziladi va summa shu oy qarzi (0 bo'lsa bo'sh). Faqat boshlang'ich
// a'zolikka tegishli — boshqa a'zolik tanlansa odatiy qoida.
export const PaymentSheet = ({ open, initialStudent, initialEntryId = null, initialMonth = null, initialAmount, onClose }) => {
  const { t } = useTranslation();
  const { centerId, refresh } = useWorker();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ loading: false, error: null, data: null });
  const [student, setStudent] = useState(initialStudent || null);
  // Oyna oldindan tanlangan o'quvchi bilan ochilsa (Qarzdorlar, detal
  // sahifalari) — a'zolik darhol tanlanadi. Sheet har ochilishda qayta mount bo'ladi.
  const [entryId, setEntryId] = useState(() => initialEntry(initialStudent, initialEntryId)?._id || null);
  const [amount, setAmount] = useState(() => {
    const first = initialEntry(initialStudent, initialEntryId);
    const d =
      initialMonth && initialAmount !== undefined && first && first._id === initialEntryId
        ? Math.max(0, Number(initialAmount) || 0)
        : defaultAmount(first);
    return d > 0 ? String(d) : "";
  });
  const [type, setType] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const entries = payableEntries(student);
  const entry = entries.find((e) => e._id === entryId) || null;
  const nameOf = useGroupNames(entries.map((e) => e.group));

  const selectEntry = (e) => {
    setEntryId(e?._id || null);
    const d = defaultAmount(e);
    setAmount(d > 0 ? String(d) : "");
  };
  const selectStudent = (s) => {
    setStudent(s);
    const list = payableEntries(s);
    selectEntry(list.length === 1 ? list[0] : null);
  };

  // Qidiruv — 350ms debounce, kamida 2 belgi.
  useEffect(() => {
    if (student) return undefined;
    const q = query.trim();
    if (q.length < 2) return undefined;
    let alive = true;
    const id = setTimeout(async () => {
      setResults((r) => ({ ...r, loading: true, error: null }));
      try {
        const res = await workerApi.searchStudents(q, centerId);
        if (alive) setResults({ loading: false, error: null, data: res?.data || res || [] });
      } catch (e) {
        if (alive) setResults({ loading: false, error: e, data: null });
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query, student, centerId]);

  const minMonth = entry?.earliestPayableMonth || entry?.courseStartMonth || "";
  // Oldindan berilgan oy — faqat boshlang'ich a'zolikda va min oydan kech bo'lmasa.
  const presetMonth =
    initialMonth && entry && entry._id === initialEntryId && minMonth && initialMonth >= minMonth ? initialMonth : null;
  const forMonth = presetMonth || (minMonth && entry?.currentCycleMonth ? entry.currentCycleMonth : undefined);
  const value = Number(digitsOnly(amount)) || 0;

  const submit = async () => {
    if (!student || !entry) return;
    if (value <= 0) {
      toast.error(t("worker.errors.student.invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      await workerApi.addPayment(student._id, entry._id, { amount: value, type, note: note.trim(), forMonth });
      haptic("success");
      toast.success(t("worker.pay.success", { amount: money(value), name: student.fullName }));
      refresh();
      onClose();
    } catch (e) {
      haptic("error");
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const showResults = !student && query.trim().length >= 2;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      busy={busy}
      title={t("worker.pay.title")}
      footer={
        student && entry ? (
          <Button onClick={submit} loading={busy} disabled={value <= 0}>
            {t("worker.pay.submit", { amount: value > 0 ? money(value) : "" })}
          </Button>
        ) : null
      }
    >
      {/* 1. O'quvchi */}
      {student ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-hint">{t("worker.pay.student")}</div>
            <div className="font-bold truncate">{student.fullName}</div>
            <div className="tabular text-[12px] text-hint">{student.phone}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setStudent(null);
              setEntryId(null);
              setAmount("");
            }}
            aria-label={t("worker.pay.change")}
            className="w-8 h-8 rounded-full bg-ink/6 grid place-items-center text-hint shrink-0"
          >
            <HiXMark className="w-4.5 h-4.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 rounded-2xl border border-line px-3.5 h-12 focus-within:border-accent">
          <HiMagnifyingGlass className="w-5 h-5 text-hint shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("worker.pay.searchPh")}
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-hint/70"
          />
        </label>
      )}

      {showResults &&
        (results.loading && !results.data ? (
          <ListSkeleton count={3} />
        ) : results.error ? (
          <ErrorState error={asErr(results.error)} />
        ) : results.data?.length === 0 ? (
          <EmptyState title={t("worker.pay.notFound")} text={t("worker.pay.notFoundText")} />
        ) : (
          <div className="flex flex-col divide-y divide-line/70">
            {(results.data || []).slice(0, 20).map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => selectStudent(s)}
                className="flex items-center justify-between gap-3 py-2.5 text-left active:opacity-70"
              >
                <span className="font-bold truncate min-w-0">{s.fullName}</span>
                <span className="tabular text-[12px] text-hint shrink-0">{s.phone}</span>
              </button>
            ))}
          </div>
        ))}
      {!student && !showResults && <div className="text-[13px] text-hint px-1">{t("worker.pay.searchHint")}</div>}

      {/* 2. Guruh (a'zolik) */}
      {student && entries.length === 0 && (
        <EmptyState title={t("worker.pay.noEntries")} text={t("worker.pay.noEntriesText")} />
      )}
      {student && entries.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-bold text-hint px-1">{t("worker.pay.group")}</div>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <button
                key={e._id}
                type="button"
                onClick={() => selectEntry(e)}
                className={cn(
                  "px-3 h-9 rounded-xl text-[13px] font-bold border max-w-full truncate",
                  entryId === e._id ? "bg-ink text-bg border-ink" : "bg-card text-ink border-line",
                )}
              >
                {nameOf(e.group)}
              </button>
            ))}
          </div>
        </div>
      )}

      {entry && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-hint">{t("worker.pay.groupMonth")}</div>
              <div className="font-bold truncate">
                {nameOf(entry.group)}
                {forMonth ? ` · ${fmtMonth(forMonth)}` : ""}
              </div>
            </div>
          </div>
          {(entry.debt || 0) > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad-bg text-bad px-3.5 py-2.5">
              <span className="text-[13px] font-bold">{t("worker.pay.debt")}</span>
              <span className="tabular font-bold">{money(entry.debt)} <span className="font-sans">{t("common.sum")}</span></span>
            </div>
          ) : (
            <div className="rounded-2xl bg-ok-bg text-ok px-3.5 py-2.5 text-[13px] font-bold">{t("worker.pay.noDebt")}</div>
          )}

          {/* 3. Summa + turi */}
          <MoneyInput label={t("worker.pay.amount")} value={amount} onChange={setAmount} />
          <SegmentTabs
            items={PAYMENT_TYPES.map((v) => ({ value: v, label: t(`worker.payType.${v}`) }))}
            value={type}
            onChange={setType}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder={t("worker.pay.notePh")}
            className="rounded-2xl border border-line px-3.5 h-11 bg-transparent outline-none text-[14px] text-ink placeholder:text-hint/70 focus:border-accent"
          />
        </>
      )}
    </BottomSheet>
  );
};
