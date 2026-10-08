import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineCalendarDays } from "react-icons/hi2";
import { Card } from "../../components/Card";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { workerApi } from "../api";
import { asErr, errText, tashkentMonth } from "../utils";
import { MonthSwitch } from "./MonthSwitch";
import { DateStrip } from "./DateStrip";
import { GradeRow } from "./GradeRow";
import { LockNote } from "./LockNote";
import { lockReason, pickDate } from "./pickDate";

// Oy: dars kunlari + davomat (kelmaganlarni bloklash) + baholar.
const loadMonth = async (groupId, month) => {
  const [att, grades] = await Promise.all([
    workerApi.attendanceMonth(groupId, month),
    workerApi.grades(groupId, month),
  ]);
  return { att, grades: grades?.grades || {}, averages: grades?.averages || {} };
};

// "Baholar" tabi (details §2, tarif `student.rate`): sana tanlash → 1–10.
// POST /grades/:groupId { studentId, value, date }; o'chirish —
// GET /grades/:groupId/student/:studentId dan id topib DELETE (client
// GradesTab bilan bir xil). Kelmagan/sababli o'quvchiga baho qo'yilmaydi.
// Yozish — faqat o'qituvchi/yordamchi; o'chirish — Boshliq, o'qituvchi,
// yordamchi esa faqat o'zinikini (grade.service assertCanDelete).
export const GradesTab = ({ group, students, canWrite, canDeleteAny }) => {
  const { t } = useTranslation();
  const { me, readOnly } = useWorker();
  const [month, setMonth] = useState(tashkentMonth);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  // Optimistik o'zgarishlar: "sid|date" → { value } | null (o'chirilgan).
  // `base` — qaysi server javobiga nisbatan; yangi javob kelsa (socket →
  // qayta yuklash) eskilari tashlanadi, haqiqat manbai — server.
  const [local, setLocal] = useState({ base: null, map: {} });

  const load = useCallback(() => loadMonth(group._id, month), [group._id, month]);
  const gid = String(group._id);
  const { data, loading, error, reload } = useScopedLive(load, [load], {
    events: ["grade:set", "grade:removed", "attendance:marked", "group:changed"],
    match: (_ev, p) => p?.groupId === gid,
  });

  const days = data?.att?.days || [];
  const date = pickDate(days, data?.att?.today, selected);
  const day = days.find((d) => d.date === date) || null;
  const lock = readOnly ? "readOnly" : lockReason(day);
  const write = canWrite && !lock;

  const statusOf = (sid) => (data?.att?.students || []).find((x) => x.studentId === sid)?.records?.[date]?.status;
  const overrides = local.base === data ? local.map : {};
  const recOf = (sid) => {
    const k = `${sid}|${date}`;
    if (k in overrides) return overrides[k];
    return data?.grades?.[sid]?.[date] || null;
  };

  const patch = (sid, rec) =>
    setLocal((l) => ({ base: data, map: { ...(l.base === data ? l.map : {}), [`${sid}|${date}`]: rec } }));
  const unpatch = (sid) =>
    setLocal((l) => {
      const map = { ...(l.base === data ? l.map : {}) };
      delete map[`${sid}|${date}`];
      return { base: data, map };
    });

  const rate = async (sid, value) => {
    setBusy(sid);
    patch(sid, { value, teacher: me?._id || null });
    try {
      await workerApi.setGrade(group._id, sid, value, date);
      haptic("success");
      setOpen(null);
    } catch (e) {
      unpatch(sid);
      haptic("error");
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (sid) => {
    setBusy(sid);
    try {
      const list = await workerApi.studentGrades(group._id, sid);
      const found = (list || []).find((g) => g.date === date && !g.transferred);
      if (found) await workerApi.removeGrade(group._id, found._id);
      patch(sid, null);
      haptic("success");
      toast.success(t("worker.group.grades.removed"));
      setOpen(null);
    } catch (e) {
      haptic("error");
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <MonthSwitch
        month={month}
        onChange={(m) => {
          setMonth(m);
          setSelected("");
          setOpen(null);
        }}
      />
      {loading && !data ? (
        <RowsSkeleton count={5} />
      ) : error && !data ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : days.length === 0 ? (
        <EmptyState icon={HiOutlineCalendarDays} title={t("worker.group.att.noDays")} text={t("worker.group.att.noDaysText")} />
      ) : (
        <>
          <DateStrip
            days={days}
            value={date}
            today={data.att.today}
            onChange={(d) => {
              setSelected(d);
              setOpen(null);
            }}
          />
          {(canWrite || canDeleteAny) && <LockNote reason={lock} />}
          {students.length === 0 ? (
            <EmptyState title={t("worker.att.noStudents")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {students.map((s, i) => {
                const st = statusOf(s._id);
                const blocked = st === "absent" || st === "excused" ? st : null;
                const rec = recOf(s._id);
                const carried = !!rec?.transferred;
                const mine = !rec?.teacher || String(rec.teacher) === String(me?._id);
                const editable = write && !carried && (canDeleteAny || mine);
                const deletable = !readOnly && !!rec && !carried && (canDeleteAny || (canWrite && mine));
                return (
                  <GradeRow
                    key={s._id}
                    name={s.fullName}
                    photo={s.photo}
                    tone={i}
                    avg={data.averages[s._id]}
                    value={rec?.value || null}
                    blocked={blocked}
                    open={open === s._id}
                    editable={editable}
                    deletable={deletable}
                    busy={busy === s._id}
                    onToggle={() => setOpen(open === s._id ? null : s._id)}
                    onRate={(v) => rate(s._id, v)}
                    onRemove={() => remove(s._id)}
                  />
                );
              })}
            </Card>
          )}
        </>
      )}
    </>
  );
};
