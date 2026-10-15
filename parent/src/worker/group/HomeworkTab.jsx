import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineBookOpen, HiOutlineCalendarDays } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { fmtDate } from "../../utils/format";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr, errText, tashkentDate, tashkentMonth } from "../utils";
import { MonthSwitch } from "./MonthSwitch";
import { DateStrip } from "./DateStrip";
import { HomeworkItem } from "./HomeworkItem";
import { HomeworkResults } from "./HomeworkResults";
import { LockNote } from "./LockNote";
import { pickDate } from "./pickDate";

const MAX_TEXT = 2000; // server homework.service MAX_TEXT

const withResults = (data, date, results) =>
  data ? { ...data, items: data.items.map((i) => (i.date === date ? { ...i, results: results || {} } : i)) } : data;

// Oy: vazifalar + dars kunlari (dam olish/o'tkazilgan kunlarsiz).
const loadMonth = async (groupId, month) => {
  const [hw, att] = await Promise.all([
    workerApi.homework(groupId, month),
    workerApi.attendanceMonth(groupId, month).catch(() => null),
  ]);
  return {
    items: hw?.items || [],
    today: att?.today || "",
    days: (att?.days || []).filter((d) => !d.holiday && !d.transferred),
  };
};

// "Uyga vazifa" tabi (details §2, tarif `homework.manage`): sana → matn →
// "Yuborish". PUT /homework/:groupId/:date { text } (upsert); bo'sh matn =
// o'chirish (server qoidasi, ConfirmDialog bilan). Server ~2 daqiqa
// debounce bilan o'quvchilarga Telegram orqali yuboradi. Yakunlangan
// guruhda yozish yopiq (`homework.groupFinished`).
export const HomeworkTab = ({ group, canWrite, students = [], studentsState }) => {
  const { t } = useTranslation();
  const { readOnly } = useWorker();
  const [month, setMonth] = useState(tashkentMonth);
  const [selected, setSelected] = useState("");
  const [drafts, setDrafts] = useState({}); // date → matn (saqlanmagan)
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const gid = String(group._id);
  const load = useCallback(() => loadMonth(group._id, month), [group._id, month]);
  const { data, loading, error, reload, mutate } = useScopedLive(load, [load], {
    events: ["homework:updated", "homework:results", "group:changed"],
    match: (_ev, p) => p?.groupId === gid,
    // Natija — refetchsiz joyida (boshqa qurilma yoki o'zimiz).
    patch: (ev, p) => (ev === "homework:results" && p?.date ? (d) => withResults(d, p.date, p.results) : null),
  });
  const onResultsSaved = (d, results) => mutate((cur) => withResults(cur, d, results));

  const days = data?.days || [];
  const date = pickDate(days, data?.today, selected);
  const item = (data?.items || []).find((i) => i.date === date) || null;
  const text = drafts[date] ?? item?.text ?? "";
  const trimmed = text.trim();
  const dirty = trimmed !== (item?.text || "");
  const finished = group.status === "finished";
  const lock = finished ? "groupFinished" : readOnly ? "readOnly" : null;
  const writable = canWrite && !lock;

  const save = async () => {
    setBusy(true);
    try {
      await workerApi.setHomework(group._id, date, trimmed);
      haptic("success");
      toast.success(t(trimmed ? "worker.homework.saved" : "worker.homework.deleted"));
      setDrafts((m) => {
        const next = { ...m };
        delete next[date];
        return next;
      });
      setConfirmDelete(false);
      await reload(true);
    } catch (e) {
      haptic("error");
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!trimmed) {
      if (item) setConfirmDelete(true);
      return;
    }
    save();
  };

  const history = [...(data?.items || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <MonthSwitch
        month={month}
        onChange={(m) => {
          setMonth(m);
          setSelected("");
        }}
      />
      {loading && !data ? (
        <RowsSkeleton count={3} />
      ) : error && !data ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : (
        <>
          {days.length === 0 ? (
            <EmptyState icon={HiOutlineCalendarDays} title={t("worker.group.att.noDays")} text={t("worker.group.att.noDaysText")} />
          ) : (
            <>
              <DateStrip days={days} value={date} today={data.today} onChange={setSelected} />
              {canWrite && <LockNote reason={lock} />}
              <Card className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-extrabold">{t("worker.homework.forDate", { date: fmtDate(date) })}</span>
                  {writable && <span className="tabular text-[11px] text-hint">{text.length}/{MAX_TEXT}</span>}
                </div>
                {writable ? (
                  <textarea
                    value={text}
                    onChange={(e) => setDrafts((m) => ({ ...m, [date]: e.target.value }))}
                    maxLength={MAX_TEXT}
                    rows={5}
                    placeholder={t("worker.homework.placeholder")}
                    className="rounded-xl border border-line/70 px-3 py-2.5 bg-bg outline-none text-[15px] text-ink placeholder:text-hint/70 focus:border-accent resize-y min-h-28"
                  />
                ) : (
                  <div className="text-[14px] whitespace-pre-line break-words min-h-6">
                    {item?.text || <span className="text-hint">{t("worker.homework.none")}</span>}
                  </div>
                )}
                {writable && (
                  <>
                    <Button onClick={submit} loading={busy} disabled={!dirty || (!trimmed && !item)}>
                      {trimmed || !item ? t("worker.homework.send") : t("worker.homework.delete")}
                    </Button>
                    <div className="text-[12px] leading-snug text-hint">{t("worker.homework.hint")}</div>
                  </>
                )}
              </Card>
              {item && date <= (data.today || tashkentDate()) && (
                <HomeworkResults
                  group={group}
                  date={date}
                  results={item.results}
                  students={students}
                  studentsState={studentsState}
                  writable={canWrite && !readOnly}
                  onSaved={onResultsSaved}
                />
              )}
            </>
          )}
          <SectionLabel>{t("worker.homework.history")}</SectionLabel>
          {history.length === 0 ? (
            <EmptyState icon={HiOutlineBookOpen} title={t("worker.homework.empty")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {history.map((h) => (
                <HomeworkItem key={h._id || h.date} item={h} active={h.date === date} onClick={() => setSelected(h.date)} />
              ))}
            </Card>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        danger
        loading={busy}
        title={t("worker.homework.deleteTitle")}
        text={t("worker.homework.deleteText")}
        confirmText={t("worker.homework.delete")}
        cancelText={t("common.cancel")}
        onConfirm={save}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
};
