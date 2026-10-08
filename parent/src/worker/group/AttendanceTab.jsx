import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineCalendarDays } from "react-icons/hi2";
import { Button } from "../../components/Button";
import { Card, Pill } from "../../components/Card";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { useScopedLive } from "../useScopedLive";
import { useSocketEvents } from "../useSocket";
import { workerApi } from "../api";
import { asErr, errText, tashkentMonth } from "../utils";
import { AttendanceRow } from "../components/AttendanceRow";
import { MonthSwitch } from "./MonthSwitch";
import { DateStrip } from "./DateStrip";
import { ExcuseSheet } from "./ExcuseSheet";
import { LockNote } from "./LockNote";
import { lockReason, pickDate } from "./pickDate";
import { QrLaunchButton } from "../qr/QrLaunchButton";

const key = (sid, date) => `${sid}|${date}`;

// "Davomat" tabi (details §2): shu oyning dars kunlari chiplari, tanlangan
// kun uchun Keldi/Kelmadi/Sababli. Manba: GET /attendance/:groupId/month,
// belgilash: POST /attendance/:groupId/mark { studentId, status, reason, date }.
// O'qituvchi/yordamchi kechagi kundan oldinga belgilay olmaydi (`minDate`).
export const AttendanceTab = ({ group, students, canMark, minDate }) => {
  const { t } = useTranslation();
  const { readOnly } = useWorker();
  const [month, setMonth] = useState(tashkentMonth);
  const [selected, setSelected] = useState("");
  const [local, setLocal] = useState({}); // "sid|date" → { status, late, reason }
  const [saving, setSaving] = useState({});
  const [bulk, setBulk] = useState(false);
  const [excuse, setExcuse] = useState(null); // student

  const load = useCallback(() => workerApi.attendanceMonth(group._id, month), [group._id, month]);
  const { data, loading, error, reload } = useScopedLive(load, [load], {
    events: ["group:changed"],
    match: (_ev, p) => p?.groupId === String(group._id),
  });

  // Boshqa qurilma/QR belgilasa — katak darhol (qayta yuklashsiz).
  useSocketEvents(["attendance:marked"], (_ev, p) => {
    if (p?.groupId !== String(group._id) || !p?.date) return;
    setLocal((m) => ({ ...m, [key(p.studentId, p.date)]: { status: p.status, late: !!p.late, reason: p.reason || "" } }));
  });

  const days = data?.days || [];
  const date = pickDate(days, data?.today, selected);
  const day = days.find((d) => d.date === date) || null;
  const lock = readOnly ? "readOnly" : !canMark ? null : lockReason(day, minDate);
  const writable = canMark && !lock;

  const recordOf = useCallback(
    (sid) => {
      const k = key(sid, date);
      if (local[k]) return local[k];
      return (data?.students || []).find((x) => x.studentId === sid)?.records?.[date] || null;
    },
    [local, data, date],
  );

  const mark = async (s, status, reason = "") => {
    const k = key(s._id, date);
    const prev = local[k];
    haptic("light");
    setLocal((m) => ({ ...m, [k]: { status, late: recordOf(s._id)?.late || false, reason } }));
    setSaving((m) => ({ ...m, [s._id]: true }));
    try {
      await workerApi.markAttendance(group._id, s._id, status, reason, date);
    } catch (e) {
      setLocal((m) => {
        const next = { ...m };
        if (prev) next[k] = prev;
        else delete next[k];
        return next;
      });
      haptic("error");
      toast.error(errText(e));
    } finally {
      setSaving((m) => ({ ...m, [s._id]: false }));
    }
  };

  const unmarked = students.filter((s) => !recordOf(s._id)?.status);
  const markRest = async () => {
    if (!unmarked.length) return;
    setBulk(true);
    const ids = unmarked.map((s) => s._id);
    setLocal((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [key(id, date), { status: "present", late: false, reason: "" }])) }));
    // Bulk endpoint yo'q — client MonthlyAttendance kabi har biri uchun /mark.
    const res = await Promise.allSettled(ids.map((id) => workerApi.markAttendance(group._id, id, "present", "", date)));
    const failed = ids.filter((_, i) => res[i].status === "rejected");
    if (failed.length) {
      setLocal((m) => {
        const next = { ...m };
        failed.forEach((id) => delete next[key(id, date)]);
        return next;
      });
      haptic("error");
      toast.error(errText(res.find((r) => r.status === "rejected")?.reason));
    } else {
      haptic("success");
      toast.success(t("worker.att.allMarked"));
    }
    setBulk(false);
  };

  const counts = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  students.forEach((s) => {
    const st = recordOf(s._id)?.status;
    counts[st && counts[st] !== undefined ? st : "unmarked"] += 1;
  });

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
        <RowsSkeleton count={5} />
      ) : error && !data ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : days.length === 0 ? (
        <EmptyState icon={HiOutlineCalendarDays} title={t("worker.group.att.noDays")} text={t("worker.group.att.noDaysText")} />
      ) : (
        <>
          <DateStrip days={days} value={date} today={data.today} onChange={setSelected} />
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {["present", "absent", "excused", "unmarked"].map((k) =>
              counts[k] > 0 ? (
                <Pill key={k} tone={{ present: "ok", absent: "bad", excused: "warn", unmarked: "mut" }[k]}>
                  {t(`worker.att.count.${k}`, { count: counts[k] })}
                </Pill>
              ) : null,
            )}
          </div>
          {canMark && <LockNote reason={lock} />}
          {/* QR skan faqat BUGUNGI darsni belgilaydi — boshqa kun tanlansa ko'rinmaydi. */}
          {writable && date === data.today && <QrLaunchButton />}
          {students.length === 0 ? (
            <EmptyState title={t("worker.att.noStudents")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {students.map((s) => {
                const rec = recordOf(s._id);
                return (
                  <AttendanceRow
                    key={s._id}
                    name={s.fullName}
                    sub={rec?.status === "excused" && rec.reason ? rec.reason : null}
                    mark={rec}
                    saving={!!saving[s._id] || bulk}
                    disabled={!writable}
                    onMark={(status) => (status === "excused" ? setExcuse(s) : mark(s, status))}
                  />
                );
              })}
            </Card>
          )}
          {writable && unmarked.length > 0 && (
            <Button onClick={markRest} loading={bulk}>
              {t("worker.att.markRest", { count: unmarked.length })}
            </Button>
          )}
        </>
      )}
      {excuse && (
        <ExcuseSheet
          name={excuse.fullName}
          initial={recordOf(excuse._id)?.reason || ""}
          onClose={() => setExcuse(null)}
          onSave={(reason) => {
            const s = excuse;
            setExcuse(null);
            mark(s, "excused", reason);
          }}
        />
      )}
    </>
  );
};
