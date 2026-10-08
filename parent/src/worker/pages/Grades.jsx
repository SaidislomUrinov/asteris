import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineStar } from "react-icons/hi2";
import { WorkerPage } from "../components/WorkerPage";
import { Card, Pill } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { ListSkeleton } from "../../components/Skeleton";
import { cn } from "../../utils/cn";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr, errText, groupLabel, tashkentDate, tashkentMonth } from "../utils";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Bitta guruhning bugungi baholari: o'quvchilar + oylik baholar + bugungi davomat.
const loadGroup = async (groupId) => {
  const [studentsRes, grades, att] = await Promise.all([
    workerApi.groupStudents(groupId),
    workerApi.grades(groupId, tashkentMonth()),
    workerApi.attendanceToday(groupId),
  ]);
  const status = {};
  (att?.records || []).forEach((r) => {
    status[String(r.student)] = r.status;
  });
  const students = (studentsRes?.data || studentsRes || [])
    .slice()
    .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  return { students, grades: grades?.grades || {}, averages: grades?.averages || {}, status };
};

// Yordamchi — Baholar (tarif `student.rate`): bugungi dars uchun 1–10 baho.
// POST /grades/:groupId { studentId, value } — client GradesTab bilan bir xil.
export const Grades = () => {
  const { t } = useTranslation();
  const { readOnly, can, refresh } = useWorker();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(null);
  const [local, setLocal] = useState({}); // optimistik: studentId → value

  const groupsLoad = useCallback(() => workerApi.groups({ status: "active" }), []);
  const groupsReq = useLive(groupsLoad, [groupsLoad]);
  const groups = groupsReq.data?.data || groupsReq.data || [];
  const groupId = params.get("group") || groups[0]?._id || "";

  const detailLoad = useCallback(() => loadGroup(groupId), [groupId]);
  const detail = useLive(detailLoad, [detailLoad], { enabled: !!groupId });
  const today = tashkentDate();
  const canRate = can("attendance:create") && !readOnly;

  const pickGroup = (id) => {
    setOpen(null);
    setLocal({});
    setParams(id ? { group: id } : {}, { replace: true });
  };

  const rate = async (studentId, value) => {
    setSaving(studentId);
    setLocal((m) => ({ ...m, [studentId]: value }));
    try {
      await workerApi.setGrade(groupId, studentId, value);
      haptic("success");
      setOpen(null);
      refresh();
    } catch (e) {
      setLocal((m) => {
        const next = { ...m };
        delete next[studentId];
        return next;
      });
      toast.error(errText(e));
    } finally {
      setSaving(null);
    }
  };

  const d = detail.data;

  return (
    <WorkerPage title={t("worker.grades.title")} subtitle={t("worker.grades.subtitle")}>
      {groupsReq.loading ? (
        <ListSkeleton count={4} />
      ) : groupsReq.error ? (
        <ErrorState error={asErr(groupsReq.error)} onRetry={groupsReq.reload} />
      ) : groups.length === 0 ? (
        <EmptyState icon={HiOutlineStar} title={t("worker.groups.empty")} />
      ) : (
        <>
          {groups.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
              {groups.map((g) => (
                <button
                  key={g._id}
                  type="button"
                  onClick={() => pickGroup(g._id)}
                  className={cn(
                    "shrink-0 px-3 h-8 rounded-full text-[13px] font-bold border",
                    groupId === g._id ? "bg-ink text-bg border-ink" : "bg-card text-hint border-line",
                  )}
                >
                  {groupLabel(g)}
                </button>
              ))}
            </div>
          )}
          {detail.loading ? (
            <ListSkeleton count={5} />
          ) : detail.error ? (
            <ErrorState error={asErr(detail.error)} onRetry={detail.reload} />
          ) : !d?.students?.length ? (
            <EmptyState title={t("worker.att.noStudents")} />
          ) : (
            <Card className="py-1 divide-y divide-line/70">
              {d.students.map((s) => {
                const value = local[s._id] ?? d.grades[s._id]?.[today]?.value;
                const st = d.status[s._id];
                const blocked = st === "absent" || st === "excused";
                const isOpen = open === s._id;
                return (
                  <div key={s._id} className="py-2">
                    <button
                      type="button"
                      disabled={!canRate || blocked}
                      onClick={() => setOpen(isOpen ? null : s._id)}
                      className="w-full flex items-center justify-between gap-3 text-left disabled:cursor-default"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[14px] truncate">{s.fullName}</div>
                        <div className="text-[12px] text-hint">
                          {d.averages[s._id] ? t("worker.grades.avg", { v: d.averages[s._id] }) : t("worker.grades.noAvg")}
                        </div>
                      </div>
                      {blocked ? (
                        <Pill tone="bad">{t(`worker.att.status.${st}`)}</Pill>
                      ) : value ? (
                        <span className="w-10 h-10 rounded-xl grid place-items-center tabular font-bold text-[16px] bg-ok-bg text-ok shrink-0">
                          {value}
                        </span>
                      ) : (
                        <Pill tone="warn">{t("worker.grades.pending")}</Pill>
                      )}
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-5 gap-1.5 mt-2">
                        {VALUES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            disabled={saving === s._id}
                            onClick={() => rate(s._id, v)}
                            className={cn(
                              "h-10 rounded-xl tabular font-bold text-[15px] disabled:opacity-50",
                              value === v ? "bg-accent text-accent-fg" : "bg-ink/6 text-ink",
                            )}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </WorkerPage>
  );
};
